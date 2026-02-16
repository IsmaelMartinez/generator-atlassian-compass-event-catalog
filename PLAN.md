# Implementation Plan

## Overview

Evolve this generator from a "Compass YAML file reader" into a full "Compass integration" for EventCatalog, in 5 incremental phases. Each phase is independently shippable as a release.

---

## Phase 1: Modernize & Fix Core Gaps ✅ COMPLETE

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

## Phase 2: Support All Compass Component Types ✅ COMPLETE

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

## Phase 3: Relationship Mapping ✅ COMPLETE

**Release**: v0.3.0
**Effort**: Medium

### 3.1 — Parse and map DEPENDS_ON relationships ✅

**Files modified**: `src/types.ts`, `src/service.ts`, `src/index.ts`

**What was implemented:**

- Added `ResolvedDependency` type (`{ id: string; name: string }`) to `src/types.ts`
- Updated `defaultMarkdown()` in `src/service.ts` to accept and render a `dependencies` parameter, generating a "Dependencies" section with links to dependent services (or "No known dependencies." when none exist)
- Updated `loadService()` to accept optional `dependencies` parameter and pass it through to markdown generation
- Implemented two-pass approach in `src/index.ts`:
  1. **First pass**: Collects all services being processed into a Map (Compass ARN → service ID + name), respecting `typeFilter`
  2. **Second pass**: For each service, resolves `DEPENDS_ON` ARNs against the map, logs warnings for unresolvable dependencies, and writes services with resolved dependency markdown
- Missing dependency targets are handled gracefully (warning logged, not crashed)
- Dependency text in markdown is sanitized against injection

### 3.2 — Tests for Phase 3 ✅

Six new tests added to `src/test/plugin.test.ts`:

- ✅ Resolves dependencies between services processed together (my-service → my-application, my-library)
- ✅ Resolves partial dependencies when only some targets are processed
- ✅ Shows "No known dependencies" for services without DEPENDS_ON
- ✅ Handles missing dependency targets gracefully without crashing
- ✅ Resolves dependencies correctly when services have custom IDs
- ✅ Includes resolved dependencies in service markdown within a domain

Test fixtures updated with cross-referencing DEPENDS_ON ARNs:

- `my-service-compass.yml` → depends on `my-application` and `my-library`
- `my-application-compass.yml` → depends on `my-library`
- `my-other-compass.notsupported.yml` → depends on `my-application` and a non-existent ARN (for graceful failure testing)

---

## Phase 4: Compass GraphQL API Integration ✅ COMPLETE

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

### 4.7 — Schema corrections (post-implementation validation)

After initial implementation, the GraphQL query and response types were validated against the Atlassian Compass API documentation and community examples. Four field-name mismatches were found and corrected:

- Component type field is `typeId` (not `type`)
- Labels are objects `{ name: string }` (not plain strings)
- Lifecycle/tier fields use the `CompassEnumField` inline fragment: `fields { definition { name } ... on CompassEnumField { value } }` (not `{ lifecycle: { label }, tier: { label } }`)
- Relationship nodes use `nodeId` (not `endNodeAri`)

Helper functions were added to handle the corrected shapes: `extractField()` searches the fields array by definition name, `mapLifecycle()` normalizes both uppercase (ACTIVE) and title case (Active) values, and `mapTier()` extracts the numeric tier from strings like "Tier 1".

### 4.8 — Tests for Phase 4

- Mock the GraphQL endpoint (simple fetch mock via `vi.stubGlobal`)
- Test that API mode fetches and processes components
- Test pagination (multiple pages)
- Test auth header is correctly formed
- Test env var resolution
- Test error handling (401, 403, 429 rate limit, network errors)
- Test that YAML mode still works unchanged
- All mocks use corrected response shapes matching actual API

---

## Phase 5: Advanced Features ✅ COMPLETE

**Release**: v0.5.0
**Effort**: Medium

### 5.1 — Custom markdown templates ✅

**Files modified**: `src/types.ts`, `src/validation.ts`, `src/service.ts`, `src/index.ts`

**What was implemented:**

- Added `MarkdownTemplateFn` type to `src/types.ts`: `(config: CompassConfig, dependencies: ResolvedDependency[]) => string`
- Added optional `markdownTemplate` field to `GeneratorProps`
- Updated Zod schema in `src/validation.ts` with `z.function().optional()` for the template
- Updated `loadService()` in `src/service.ts` to accept an optional `customMarkdownTemplate` parameter; when provided, it is called instead of `defaultMarkdown()`
- Updated `src/index.ts` to pass `options.markdownTemplate` through to `loadService()`

Three new tests verify:

- ✅ Custom template is used when provided (replaces default markdown)
- ✅ Resolved dependencies are passed to the custom template function
- ✅ Falls back to `defaultMarkdown` when template is not provided

### 5.2 — MDX format support ✅

**Files modified**: `src/types.ts`, `src/validation.ts`, `src/index.ts`

**What was implemented:**

- Added optional `format` field (`'md' | 'mdx'`) to `GeneratorProps` in `src/types.ts`
- Added `z.enum(['md', 'mdx']).optional()` to the Zod schema in `src/validation.ts`
- Updated `src/index.ts` to pass `{ format }` to all `writeService()` calls (defaults to `'mdx'`)

Four new tests verify:

- ✅ Default format works (mdx)
- ✅ `format: 'md'` option is accepted
- ✅ `format: 'mdx'` option is accepted
- ✅ Invalid format values are rejected by Zod validation

### 5.3 — Teams ✅

**Files modified**: `src/index.ts`, `src/service.ts`

**What was implemented:**

- Updated `src/index.ts` to extract `writeTeam` from the SDK
- Extracted shared `extractTeamId()` helper in `src/service.ts` to parse team UUID from ownerId ARN (eliminates duplicated ARN parsing logic)
- In the second pass, before writing each service, extracts team ID from `ownerId` ARN (UUID after `team/`)
- Team IDs are sanitized via `sanitizeId()` to prevent path traversal (security fix from review)
- Uses a `Set<string>` to track already-written team IDs for deduplication
- Calls `writeTeam({ id, name, markdown }, { override: true })` for each unique team
- Teams are referenced by ID in the service's `owners` array (existing behavior preserved)

Three new tests verify:

- ✅ Team entity is created from service ownerId
- ✅ Teams are deduplicated when multiple services share the same owner
- ✅ Separate teams are created for different ownerIds

### 5.4 — Attach OpenAPI specs from links ✅

**Files modified**: `src/service.ts`

**What was implemented:**

- Added `getOpenApiSpecifications()` function in `src/service.ts` that scans a component's links for names containing "openapi" or "swagger" (case-insensitive)
- Matching links are mapped to `{ type: 'openapi', path: <sanitized URL>, name: <link name> }` specification entries
- URLs are sanitized through `sanitizeUrl()` (same XSS prevention as other URLs)
- Specifications are added to the `Service` object only when matches are found

Three new tests verify:

- ✅ Links with "openapi" in name are attached as specifications
- ✅ Links with "swagger" in name are attached as specifications
- ✅ Services without openapi/swagger links have no specifications

---

## Phase 6: Polish, Resilience & DX ✅ COMPLETE

**Release**: v0.6.0
**Effort**: Medium

### 6.1 — Enrich team entities with Compass team data ✅

**Files modified**: `src/compass-api.ts`, `src/index.ts`

**What was implemented:**

- Added `fetchTeamById()` function to `src/compass-api.ts` that queries the Compass Teams GraphQL API (`team.teamById`) to fetch a team's display name by UUID
- Updated `src/index.ts` team writing logic: in API mode, attempts to fetch the team's display name via `fetchTeamById()` before writing the team entity
- Falls back gracefully to UUID-based name if the team fetch fails (network error, 404, etc.)
- In YAML mode, the UUID fallback remains (no API available)

Four new tests verify:

- ✅ Team display name is fetched and used in API mode
- ✅ Falls back to UUID when team fetch fails
- ✅ Returns null on HTTP error
- ✅ Returns null on GraphQL errors

### 6.2 — Configurable service ID strategy ✅

**Files modified**: `src/types.ts`, `src/validation.ts`, `src/index.ts`

**What was implemented:**

- Added `ServiceIdStrategy` type to `src/types.ts`: `'name' | 'compass-id' | ((config: CompassConfig) => string)`
- Added optional `serviceIdStrategy` field to `GeneratorProps`
- Updated Zod schema in `src/validation.ts` with `z.union([z.enum(['name', 'compass-id']), z.function()])` validation
- Added `resolveServiceId()` helper in `src/index.ts` that applies the strategy:
  - `'name'` (default): uses component name (existing behavior)
  - `'compass-id'`: uses the Compass ARN/ID, sanitized
  - Custom function: calls the user's function, then sanitizes the result
  - File-level `id` override takes precedence over any strategy
- Updated both API mode and YAML mode to use `resolveServiceId()`

Four new tests verify:

- ✅ Default name-based service IDs
- ✅ `compass-id` strategy derives ID from Compass ARN
- ✅ Custom function strategy for service IDs
- ✅ File-level id overrides serviceIdStrategy

### 6.3 — Error resilience and partial failure handling ✅

**Files modified**: `src/index.ts`

**What was implemented:**

- Wrapped each YAML file loading in the first pass with try/catch — failed files are logged and skipped
- Wrapped each service's processing in the second pass with try/catch — failed services are logged and skipped
- Added success/failure counters that track processing outcomes
- At the end of processing, prints a summary: `Succeeded: N, Failed: M` with individual failure details

One new test verifies:

- ✅ Continues processing when one service fails (nonexistent YAML file) and remaining services succeed

### 6.4 — Dry-run mode ✅

**Files modified**: `src/types.ts`, `src/validation.ts`, `src/index.ts`

**What was implemented:**

- Added optional `dryRun?: boolean` to `GeneratorProps` in `src/types.ts`
- Added `z.boolean().optional()` to the Zod schema in `src/validation.ts`
- Updated `src/index.ts`: when `dryRun` is true:
  - Logs `[DRY RUN]` prefix messages describing what would be written
  - Skips all `writeService()`, `writeTeam()`, and `addServiceToDomain()` calls
  - Prints service details (badges, dependencies) for preview
  - Prints `[DRY RUN] No changes were written.` at the end

Four new tests verify:

- ✅ Services are not written when dryRun is true
- ✅ Teams are not written when dryRun is true
- ✅ Domain services are not modified when dryRun is true
- ✅ Zod validation accepts dryRun option

### 6.5 — AsyncAPI spec support ✅

**Files modified**: `src/service.ts`

**What was implemented:**

- Renamed `getOpenApiSpecifications()` to `getSpecifications()` and extended it to detect AsyncAPI links
- Links with names containing "asyncapi" (case-insensitive) are mapped to `{ type: 'asyncapi', path, name }` specification entries
- URLs are sanitized through `sanitizeUrl()` (same XSS prevention as OpenAPI URLs)
- Added `SpecType` type alias (`'openapi' | 'asyncapi'`) for type safety with the SDK's `Specification` type

Three new tests verify:

- ✅ Links with "asyncapi" in name are attached as asyncapi specifications
- ✅ OpenAPI detection still works alongside AsyncAPI detection
- ✅ Services without asyncapi/openapi links have no specifications

### 6.6 — Scorecard-to-badge mapping ✅

**Files modified**: `src/compass.ts`, `src/compass-api.ts`, `src/service.ts`

**What was implemented:**

- Added `ScorecardScore` type to `src/compass.ts`: `{ name: string; score: number; maxScore: number }`
- Added optional `scorecards` field to `CompassConfig`
- Extended the GraphQL query in `src/compass-api.ts` to fetch `scorecardScores { scorecard { name } score maxScore }`
- Updated `mapComponent()` in `src/compass-api.ts` to map scorecard data to `CompassConfig.scorecards`
- Updated `buildBadges()` in `src/service.ts` to create color-coded badges from scorecard data:
  - ≥80%: green (`#22c55e`)
  - ≥50%: amber (`#f59e0b`)
  - <50%: red (`#ef4444`)
  - Badge content format: `"ScorecardName: XX%"`
- Handles edge case of `maxScore: 0` gracefully (shows 0%)

Seven new tests verify:

- ✅ High score (85%) creates green badge
- ✅ Medium score (60%) creates amber badge
- ✅ Low score (20%) creates red badge
- ✅ Multiple scorecards create multiple badges
- ✅ `maxScore: 0` handled gracefully
- ✅ Scorecard scores mapped from API response
- ✅ Components without scorecards have no scorecard badges

### 6.7 — Tests for Phase 6 ✅

30 new tests added across two test files (69 in plugin.test.ts, 30 in compass-api.test.ts = 99 total):

- ✅ Team enrichment: 4 tests in compass-api.test.ts + 2 integration tests
- ✅ Service ID strategy: 4 tests in plugin.test.ts + 3 Zod validation tests
- ✅ Error resilience: 1 test in plugin.test.ts
- ✅ Dry-run mode: 4 tests in plugin.test.ts
- ✅ AsyncAPI specs: 3 tests in plugin.test.ts
- ✅ Scorecard badges: 5 unit tests in plugin.test.ts + 3 API tests in compass-api.test.ts

New test fixtures:

- `my-asyncapi-service-compass.yml` — SERVICE with AsyncAPI link
- `malformed-compass.yml` — Service with invalid data (for resilience testing)

---

## Dependency Changes Across Phases

| Phase | Add                                    | Remove               |
| ----- | -------------------------------------- | -------------------- |
| 1     | `zod`                                  | Local `Service` type |
| 2     | —                                      | —                    |
| 3     | —                                      | —                    |
| 4     | `node-fetch` (if needed for API calls) | —                    |
| 5     | —                                      | —                    |
| 6     | —                                      | —                    |

---

## Release Schedule

| Phase | Version | Breaking?                                             | What ships                                  | Status      |
| ----- | ------- | ----------------------------------------------------- | ------------------------------------------- | ----------- |
| 1     | 0.1.0   | No (new default `overrideExisting: true` is additive) | Richer services, update support, validation | ✅ Complete |
| 2     | 0.2.0   | No (previously errored types now work)                | All Compass types supported                 | ✅ Complete |
| 3     | 0.3.0   | No                                                    | Relationship mapping                        | ✅ Complete |
| 4     | 0.4.0   | No (API mode is opt-in)                               | Compass API integration                     | ✅ Complete |
| 5     | 0.5.0   | No                                                    | Custom templates, MDX, teams, OpenAPI specs | ✅ Complete |
| 6     | 0.6.0   | No                                                    | Polish, resilience, DX improvements         | ✅ Complete |

---

## File Map

```
src/
├── index.ts          # Main generator entry point (modified in phases 1-6)
├── types.ts          # GeneratorProps, ResolvedDependency, MarkdownTemplateFn, ServiceIdStrategy, re-export SDK types (modified in phases 1-6)
├── compass.ts        # YAML parser + CompassConfig type with ScorecardScore (modified in phases 2, 6)
├── compass-api.ts    # Compass GraphQL API client with team fetching and scorecards (phases 4, 6)
├── service.ts        # loadService with badge/metadata/dependency/spec/scorecard mapping (modified in phases 1-3, 5-6)
├── domain.ts         # Domain processing (minimal changes)
├── validation.ts     # Zod schemas (phases 1, 5-6)
└── test/
    ├── plugin.test.ts                    # Main tests (extended each phase, 69 tests)
    ├── compass-api.test.ts              # API client tests (phases 4, 6 — 30 tests)
    ├── my-service-compass.yml            # SERVICE fixture (with DEPENDS_ON refs)
    ├── my-application-compass.yml        # APPLICATION fixture (with DEPENDS_ON refs)
    ├── my-library-compass.yml            # LIBRARY fixture
    ├── my-capability-compass.yml         # CAPABILITY fixture
    ├── my-other-compass.notsupported.yml # OTHER fixture (with partial DEPENDS_ON refs)
    ├── my-openapi-service-compass.yml    # SERVICE fixture with OpenAPI/Swagger links (phase 5)
    ├── my-asyncapi-service-compass.yml   # SERVICE fixture with AsyncAPI link (phase 6)
    └── malformed-compass.yml            # Malformed fixture for error resilience testing (phase 6)
```

---

## How to Start

Phase 1 is the first step. It's low-risk, improves quality, and unblocks all later phases by switching to the SDK's `Service` type. Start with step 1.1 (replace local type), then 1.2 (richer service mapping), then 1.3 (update instead of skip), then 1.4 (Zod validation), then 1.5 (tests).
