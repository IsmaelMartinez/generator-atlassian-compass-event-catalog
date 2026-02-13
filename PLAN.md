# Implementation Plan

## Overview

Evolve this generator from a "Compass YAML file reader" into a full "Compass integration" for EventCatalog, in 5 incremental phases. Each phase is independently shippable as a release.

---

## Phase 1: Modernize & Fix Core Gaps

**Release**: v0.1.0 (minor -- new behavior: updates instead of skips)
**Effort**: Small

### 1.1 — Replace local `Service` type with SDK type

**File**: `src/types.ts`

Delete the local `Service` type entirely. Import `Service` from `@eventcatalog/sdk` instead. The SDK's `Service` type already includes `id`, `name`, `version`, `summary`, `markdown` plus `badges`, `owners`, `repository`, `specifications`, `deprecated`, `draft`, `styles`, `attachments`, and more.

Update `GeneratorProps` to add missing options:

```ts
import type { Service } from '@eventcatalog/sdk';

type ServiceOptions = {
  id?: string;
  path: string;
  version?: string;
};

export type GeneratorProps = {
  services: ServiceOptions[];
  compassUrl: string;
  domain?: DomainOption;
  debug?: boolean;
  // NEW: control update behavior
  overrideExisting?: boolean;
};

export type DomainOption = {
  id: string;
  name: string;
  version: string;
};

// Re-export for convenience
export type { Service };
```

### 1.2 — Update `loadService` to return richer data

**File**: `src/service.ts`

Map Compass fields that are currently ignored to SDK-supported Service properties:

| Compass field            | SDK Service property | Mapping                                                                  |
| ------------------------ | -------------------- | ------------------------------------------------------------------------ |
| `fields.lifecycle`       | `badges`             | `[{ content: "Active", backgroundColor: "#22c55e", textColor: "#fff" }]` |
| `fields.tier`            | `badges`             | `[{ content: "Tier 1", backgroundColor: "#3b82f6", textColor: "#fff" }]` |
| `labels`                 | `badges`             | One badge per label                                                      |
| `description`            | `summary`            | Already mapped                                                           |
| `links[type=REPOSITORY]` | `repository.url`     | First REPOSITORY link URL                                                |
| `ownerId`                | `owners`             | Extract team name or ID                                                  |

### 1.3 — Support updating existing services (don't skip)

**File**: `src/index.ts`

Current behavior: if `getService()` finds an existing service, it logs "already exists, skipped." This means Compass changes never propagate.

New behavior:

- If service exists and `overrideExisting` is true (default: true), call `writeService()` with `{ override: true }` to update it.
- If service exists and `overrideExisting` is false, skip (current behavior).
- Log whether created or updated.

```ts
const existing = await getService(serviceId);
if (existing && options.overrideExisting !== false) {
  await writeService(compassService, { override: true });
  console.log(chalk.cyan(` - Service ${name} updated`));
} else if (!existing) {
  await writeService(compassService);
  console.log(chalk.cyan(` - Service ${name} created`));
} else {
  console.log(chalk.yellow(` - Service ${name} skipped (already exists)`));
}
```

### 1.4 — Add Zod validation for config

**New file**: `src/validation.ts`
**File**: `src/index.ts` (use it)

Add `zod` as a dependency. Validate `GeneratorProps` at generator entry point so users get clear error messages instead of cryptic runtime errors.

```ts
import { z } from 'zod';

const ServiceOptionsSchema = z.object({
  id: z.string().optional(),
  path: z.string().min(1, 'Service path is required'),
  version: z.string().optional(),
});

const DomainOptionSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  version: z.string().min(1),
});

export const GeneratorPropsSchema = z.object({
  services: z.array(ServiceOptionsSchema).min(1, 'At least one service is required'),
  compassUrl: z.string().url('compassUrl must be a valid URL'),
  domain: DomainOptionSchema.optional(),
  debug: z.boolean().optional(),
  overrideExisting: z.boolean().optional(),
});
```

### 1.5 — Tests for Phase 1

**File**: `src/test/plugin.test.ts`

- Add test: service with lifecycle/tier generates correct badges
- Add test: service with labels generates badge per label
- Add test: updating an existing service overwrites it
- Add test: `overrideExisting: false` preserves skip behavior
- Add test: invalid config (missing compassUrl) throws Zod error

### 1.6 — Housekeeping

- Update `tsup.config.ts` entry to include `src/validation.ts`
- Add `zod` to `dependencies` in `package.json`
- Create changeset for v0.1.0

---

## Phase 2: Support All Compass Component Types

**Release**: v0.2.0
**Effort**: Medium

### 2.1 — Remove the `SERVICE`-only restriction

**File**: `src/index.ts`

Delete the `if (compassConfig.typeId !== 'SERVICE') throw` guard. Instead, map all Compass types to EventCatalog services (since EventCatalog doesn't have a 1:1 type for APPLICATION, LIBRARY, etc. — they all become services with type metadata).

### 2.2 — Add configurable type mapping

**File**: `src/types.ts`

```ts
export type TypeMapping = {
  compassType: string; // e.g. 'APPLICATION', 'LIBRARY'
  eventCatalogType: 'service'; // For now, everything maps to service
  include: boolean; // Whether to process this type
};

export type GeneratorProps = {
  // ... existing fields ...
  typeFilter?: string[]; // e.g. ['SERVICE', 'APPLICATION'] — if set, only process these types
};
```

### 2.3 — Add component type as a badge

**File**: `src/service.ts`

Add a badge showing the Compass component type: `{ content: "APPLICATION", backgroundColor: "#6366f1", textColor: "#fff" }`. This makes it clear in EventCatalog what kind of Compass component it originated from.

### 2.4 — Tests for Phase 2

- Add fixture YAML files for APPLICATION, LIBRARY, CAPABILITY types
- Test that each type is processed successfully
- Test that `typeFilter` correctly includes/excludes types
- Test that component type appears as badge

---

## Phase 3: Relationship Mapping

**Release**: v0.3.0
**Effort**: Medium

### 3.1 — Parse and map DEPENDS_ON relationships

**File**: `src/service.ts` or new file `src/relationships.ts`

Compass YAML already has:

```yaml
relationships:
  DEPENDS_ON:
    - 'ari:cloud:compass:...'
```

**Important**: The SDK does **not** have a generic `addRelationshipToService()` function. The SDK models relationships through specific mechanisms:

- `sends` / `receives` — for message flows (events, commands, queries between services via channels)
- `writesTo` / `readsFrom` — for data store relationships
- `<NodeGraph />` — renders the service/domain graph visually in markdown

Compass `DEPENDS_ON` is a general architectural dependency, not a message flow. It doesn't map cleanly to `sends`/`receives` (which are for events/commands, not service-to-service dependencies). Using `addEventToService()` would be incorrect here — that function is for linking events to services, not for expressing that one service depends on another.

**Approach**: Express dependencies through the service markdown and the domain's `<NodeGraph />`. The `<NodeGraph />` component already renders all services within a domain and their connections. We enrich each service's markdown with an explicit "Dependencies" section listing what it depends on, and ensure both services are in the same domain so the graph visualizes the relationship.

1. Collect all service IDs being processed in a Map (Compass ARN → EventCatalog ID)
2. For each service, resolve its `DEPENDS_ON` ARNs to EventCatalog service IDs
3. Include the dependency list in the service's generated markdown
4. If both services are in the same domain, the `<NodeGraph />` will show them together

**File**: `src/service.ts`

Add a dependencies section to the generated markdown:

```ts
// In defaultMarkdown(), add after links section:
const dependencyLinks = dependencies
  ?.map((dep) => `* [${dep.name}](/docs/services/${dep.id})`)
  .join('\n');

// Include in markdown:
## Dependencies
${dependencyLinks || 'No known dependencies.'}
```

**File**: `src/index.ts`

Build the service map and resolve dependencies before generating markdown:

```ts
// First pass: collect all services into a map
const serviceMap = new Map<string, { serviceId: string; config: CompassConfig }>();
for (const file of compassFiles) {
  const config = loadConfig(file.path);
  serviceMap.set(config.id || '', { serviceId: file.id || config.name, config });
}

// Second pass: write services with resolved dependencies
for (const file of compassFiles) {
  const config = loadConfig(file.path);
  const dependencies = (config.relationships?.DEPENDS_ON || []).map((arn) => serviceMap.get(arn)).filter(Boolean);

  const service = loadService(config, compassUrl, file.version, file.id, dependencies);
  await writeService(service);
}
```

### 3.2 — Tests for Phase 3

- Add fixture with two services that have `DEPENDS_ON` pointing to each other
- Test that relationships are logged/processed
- Test that missing dependency targets are handled gracefully (log warning, don't crash)

---

## Phase 4: Compass GraphQL API Integration

**Release**: v0.4.0
**Effort**: High (largest phase)

### 4.1 — Add API client

**New file**: `src/compass-api.ts`

Create a client that talks to the Compass GraphQL API:

```ts
export type CompassApiConfig = {
  cloudId: string;
  apiToken: string;
  email: string;
  baseUrl: string; // e.g. 'https://your-domain.atlassian.net'
};

export async function fetchComponents(config: CompassApiConfig): Promise<CompassConfig[]> {
  const endpoint = `${config.baseUrl}/gateway/api/graphql`;
  // Use compass.searchComponents query with pagination
  // Map GraphQL response to CompassConfig type (same shape as YAML)
}

export async function fetchComponent(config: CompassApiConfig, id: string): Promise<CompassConfig> {
  // Use compass.component(id) query
  // Returns full component with links, labels, relationships, custom fields
}
```

Authentication: Basic auth with `email:apiToken` base64-encoded, or OAuth bearer token.

### 4.2 — Update GeneratorProps to support API mode

**File**: `src/types.ts`

```ts
export type GeneratorProps = {
  // YAML mode (existing)
  services?: ServiceOptions[];

  // API mode (new)
  api?: {
    cloudId: string;
    apiToken: string; // or env var reference like '$COMPASS_API_TOKEN'
    email: string;
    baseUrl: string;
    typeFilter?: string[]; // which component types to pull
  };

  // Shared
  compassUrl: string;
  domain?: DomainOption;
  debug?: boolean;
  overrideExisting?: boolean;
};
```

### 4.3 — Update Zod schema for services-or-api validation

**File**: `src/validation.ts`

The Phase 1 Zod schema requires `services` as a mandatory array. With API mode, either `services` or `api` must be provided, but not both. Update the schema using `.refine()` to enforce this:

```ts
export const GeneratorPropsSchema = z
  .object({
    services: z.array(ServiceOptionsSchema).optional(),
    api: ApiConfigSchema.optional(),
    compassUrl: z.string().url('compassUrl must be a valid URL'),
    domain: DomainOptionSchema.optional(),
    debug: z.boolean().optional(),
    overrideExisting: z.boolean().optional(),
  })
  .refine((data) => data.services || data.api, {
    message: 'Either "services" (YAML mode) or "api" (API mode) must be provided',
  })
  .refine((data) => !(data.services && data.api), {
    message: 'Cannot use both "services" and "api" — choose one mode',
  });
```

This ensures clear error messages when users misconfigure the generator.

### 4.4 — Update main generator to support both modes

**File**: `src/index.ts`

```ts
export default async (_config: EventCatalogConfig, options: GeneratorProps) => {
  // Validate config
  const validated = GeneratorPropsSchema.parse(options);

  if (validated.api) {
    // API mode: fetch all components from Compass
    const components = await fetchComponents(validated.api);
    // Process each component through the same pipeline
  } else {
    // YAML mode: read local files (existing behavior)
  }
};
```

### 4.5 — Handle API pagination

The Compass GraphQL API uses cursor-based pagination. `searchComponents` returns `pageInfo { hasNextPage, endCursor }`. The client must loop until `hasNextPage` is false.

### 4.6 — Environment variable support for secrets

Never hardcode API tokens. Support env var references:

```ts
function resolveValue(value: string): string {
  if (value.startsWith('$')) {
    const envVar = value.slice(1);
    const resolved = process.env[envVar];
    if (!resolved) throw new Error(`Environment variable ${envVar} is not set`);
    return resolved;
  }
  return value;
}
```

### 4.7 — Tests for Phase 4

- Mock the GraphQL endpoint (use `msw` or simple fetch mock)
- Test that API mode fetches and processes components
- Test pagination (multiple pages)
- Test auth header is correctly formed
- Test env var resolution
- Test error handling (401, 403, 429 rate limit, network errors)
- Test that YAML mode still works unchanged

---

## Phase 5: Advanced Features

**Release**: v0.5.0
**Effort**: Medium

### 5.1 — Attach OpenAPI specs

If a Compass component has API specifications (available via the API since the Optic acquisition), attach them to the EventCatalog service using `addFileToService()` or the `specifications` field on `Service`.

### 5.2 — Map scorecards to metadata

Compass scorecards track component health. Map scorecard scores to EventCatalog badges or custom metadata so teams can see health status in EventCatalog.

### 5.3 — Custom markdown templates

Add an optional `markdownTemplate` function to `GeneratorProps` that lets users customize the generated markdown per service. Falls back to `defaultMarkdown` if not provided.

### 5.4 — EventCatalog v3: MDX format support

The `writeService` SDK function accepts `{ format: 'mdx' }`. Add a `format` option to `GeneratorProps` (default: `'mdx'` for v3 compatibility).

### 5.5 — EventCatalog v3: Teams and Users

If Compass provides team/owner data via the API, use `writeTeam()` and `writeUser()` from the SDK to create corresponding entities in EventCatalog, not just string references.

---

## Dependency Changes Across Phases

| Phase | Add                                    | Remove               |
| ----- | -------------------------------------- | -------------------- |
| 1     | `zod`                                  | Local `Service` type |
| 2     | —                                      | —                    |
| 3     | —                                      | —                    |
| 4     | `node-fetch` (if needed for API calls) | —                    |
| 5     | —                                      | —                    |

---

## Release Schedule

| Phase | Version | Breaking?                                             | What ships                                  |
| ----- | ------- | ----------------------------------------------------- | ------------------------------------------- |
| 1     | 0.1.0   | No (new default `overrideExisting: true` is additive) | Richer services, update support, validation |
| 2     | 0.2.0   | No (previously errored types now work)                | All Compass types supported                 |
| 3     | 0.3.0   | No                                                    | Relationship mapping                        |
| 4     | 0.4.0   | No (API mode is opt-in)                               | Compass API integration                     |
| 5     | 0.5.0   | No                                                    | OpenAPI specs, scorecards, MDX, teams       |

---

## File Map

```
src/
├── index.ts          # Main generator entry point (modified in phases 1-4)
├── types.ts          # GeneratorProps, re-export SDK types (modified in phases 1-2, 4)
├── compass.ts        # YAML parser + CompassConfig type (modified in phase 2)
├── compass-api.ts    # NEW: Compass GraphQL API client (phase 4)
├── service.ts        # loadService with badge/metadata mapping (modified in phases 1-3)
├── domain.ts         # Domain processing (minimal changes)
├── relationships.ts  # NEW: relationship mapping logic (phase 3)
├── validation.ts     # NEW: Zod schemas (phase 1)
└── test/
    ├── plugin.test.ts                    # Main tests (extended each phase)
    ├── my-service-compass.yml            # Existing fixture
    ├── my-other-compass.notsupported.yml # Existing fixture (rename in phase 2)
    ├── my-app-compass.yml                # NEW fixture (phase 2)
    ├── my-library-compass.yml            # NEW fixture (phase 2)
    └── compass-api.test.ts              # NEW: API client tests (phase 4)
```

---

## How to Start

Phase 1 is the first step. It's low-risk, improves quality, and unblocks all later phases by switching to the SDK's `Service` type. Start with step 1.1 (replace local type), then 1.2 (richer service mapping), then 1.3 (update instead of skip), then 1.4 (Zod validation), then 1.5 (tests).
