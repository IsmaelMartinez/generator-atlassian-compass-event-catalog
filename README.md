# Atlassian Compass EventCatalog Generator

An [EventCatalog](https://eventcatalog.dev/) generator plugin that creates services from [Atlassian Compass](https://developer.atlassian.com/cloud/compass/config-as-code/structure-and-contents-of-a-compass-yml-file/) components. It supports two modes: reading local `compass.yml` files (YAML mode) or fetching components directly from the Compass GraphQL API (API mode).

## Installation

```sh
npm install @ismaelmartinez/generator-atlassian-compass-event-catalog
```

## Configuration

Add the generator to your `eventcatalog.config.js`. The plugin supports two mutually exclusive modes: YAML mode (local files) and API mode (Compass GraphQL API).

### YAML mode

Read services from local `compass.yml` files:

```js
generators: [
  [
    '@ismaelmartinez/generator-atlassian-compass-event-catalog',
    {
      services: [
        {
          path: 'path/to/compass.yml',
          version: '1.0.0',  // optional, defaults to '0.0.0'
          id: 'custom-id',   // optional, defaults to the name in the compass file
        },
      ],
      compassUrl: 'https://your-site.atlassian.net/compass',
    },
  ],
],
```

### API mode

Fetch components directly from the Compass GraphQL API:

```js
generators: [
  [
    '@ismaelmartinez/generator-atlassian-compass-event-catalog',
    {
      api: {
        cloudId: '$COMPASS_CLOUD_ID',       // supports $ENV_VAR syntax
        apiToken: '$COMPASS_API_TOKEN',
        email: '$COMPASS_EMAIL',
        baseUrl: 'https://your-site.atlassian.net',  // must be HTTPS
        typeFilter: ['SERVICE', 'APPLICATION'],      // optional, server-side filtering
      },
      compassUrl: 'https://your-site.atlassian.net/compass',
    },
  ],
],
```

API mode credentials support `$ENV_VAR` syntax, so you can reference environment variables rather than hardcoding secrets.

### All options

| Option              | Type                                 | Default    | Description                                                            |
| ------------------- | ------------------------------------ | ---------- | ---------------------------------------------------------------------- |
| `services`          | `ServiceOptions[]`                   | -          | YAML mode: array of local compass file paths                           |
| `api`               | `ApiConfig`                          | -          | API mode: Compass GraphQL API connection config                        |
| `compassUrl`        | `string`                             | (required) | Base URL for Compass component links                                   |
| `domain`            | `DomainSpec \| DomainMapping`        | -          | Associate services with a domain (static, or derived from metadata)    |
| `typeFilter`        | `string[]`                           | -          | Only process components matching these type IDs                        |
| `nameFilter`        | `string[]`                           | -          | Only process components whose name matches one of these strings        |
| `nameMapping`       | `Record<string, string>`             | -          | Map Compass component names to custom service IDs                      |
| `overrideExisting`  | `boolean`                            | `true`     | Whether to update existing services or skip them                       |
| `debug`             | `boolean`                            | `false`    | Enable debug logging (credentials are redacted)                        |
| `format`            | `'md' \| 'mdx'`                      | `'mdx'`    | Output file format                                                     |
| `serviceIdStrategy` | `'name' \| 'compass-id' \| Function` | `'name'`   | How service IDs are derived                                            |
| `markdownTemplate`  | `Function`                           | -          | Custom function to generate service markdown content                   |
| `dryRun`            | `boolean`                            | `false`    | Log what would happen without writing any changes                      |
| `defaultVersion`    | `string`                             | `'0.0.0'`  | Default version for services that don't specify one                    |
| `badges`            | `boolean`                            | `true`     | Generate badges from Compass metadata (type, lifecycle, tier, labels)  |
| `incremental`       | `boolean`                            | `false`    | Skip writing services unchanged since the previous run (hash manifest) |

See the [example configuration](examples/eventcatalog.config.js) for a complete working setup.

## Features

### Component type support

All Compass component types are supported: SERVICE, APPLICATION, LIBRARY, CAPABILITY, CLOUD_RESOURCE, DATA_PIPELINE, MACHINE_LEARNING_MODEL, UI_ELEMENT, WEBSITE, and OTHER. Each component is written as an EventCatalog service entry. Use `typeFilter` to restrict which types are processed.

### Dependency mapping

`DEPENDS_ON` relationships defined in Compass are resolved to links between EventCatalog services. Dependencies are resolved across all services processed in the same generator run, and unresolvable ARNs are logged and skipped gracefully.

### Badge generation

Services receive color-coded badges based on their Compass metadata: component type (e.g. SERVICE, APPLICATION), lifecycle stage (Active, Pre-release, Deprecated), tier level (1-4), labels, and scorecard scores (green/amber/red based on percentage). Scorecard badges show the score name and percentage. Set `badges: false` to disable badge generation entirely.

### Team creation

When a component has an `ownerId`, the generator extracts the team UUID and creates an EventCatalog team entity. In API mode, the team's display name is fetched from Compass; in YAML mode the UUID is used as the name. Teams are deduplicated across services.

### OpenAPI and AsyncAPI spec detection

Links with names containing "openapi" or "swagger" are attached as OpenAPI specifications, and links with "asyncapi" are attached as AsyncAPI specifications. This allows EventCatalog to render API documentation alongside service pages.

### Custom markdown templates

Provide a `markdownTemplate` function to fully control the markdown content generated for each service. The function receives the `CompassConfig`, resolved dependencies, and structured links extracted from the Compass config (URL, title, category, icon, raw type):

```js
markdownTemplate: (config, dependencies, links) => {
  const deps = dependencies.map((d) => d.name).join(', ') || 'none';
  const repo = links?.find((l) => l.rawType === 'REPOSITORY')?.url ?? '';
  return `# ${config.name}\n\nDeps: ${deps}\n\nRepo: ${repo}`;
},
```

The `links` parameter is optional, so existing two-argument templates still work. Import the `StructuredLink` type from the package root if you want type hints.

### Service ID strategies

Control how service IDs are derived with `serviceIdStrategy`:

- `'name'` (default): uses the component name from Compass
- `'compass-id'`: uses the Compass ARN (sanitized for filesystem safety)
- Custom function: `(config) => string` for full control

File-level `id` overrides in YAML mode always take precedence over the strategy.

### Dry-run mode

Set `dryRun: true` to see what the generator would do without writing any files. Services, teams, and domain associations are all logged but not persisted.

### Incremental mode

Set `incremental: true` to skip writing services that haven't changed since the last run. The generator computes a SHA-256 hash of each built service and stores it in `.compass-hashes.json` in the project directory. On subsequent runs, services with a matching hash are skipped and reported in the summary as `Skipped (unchanged)`.

### Error resilience

The generator continues processing when individual services fail (e.g. malformed YAML, missing files). A summary at the end reports succeeded and failed counts with error details.

### Domain support

When a `domain` option is provided, generated services are associated with a domain. Domains are created automatically when first used, and versioned when their version string changes between runs.

**Static domain** — all services go to the same domain:

```js
domain: { id: 'payments', name: 'Payments', version: '0.0.1' }
```

**Derived from a Compass label** — first matching label wins (case-sensitive):

```js
domain: {
  from: 'label',
  mapping: {
    backend: { id: 'backend', name: 'Backend', version: '0.0.1' },
    frontend: { id: 'frontend', name: 'Frontend', version: '0.0.1' },
  },
  fallback: { id: 'other', name: 'Other', version: '0.0.1' }, // optional; default is 'skip'
}
```

**Derived from a custom field value**:

```js
domain: {
  from: 'customField',
  key: 'platform',
  mapping: {
    web: { id: 'web-platform', name: 'Web Platform', version: '0.0.1' },
    mobile: { id: 'mobile-platform', name: 'Mobile Platform', version: '0.0.1' },
  },
  fallback: 'skip', // unmatched services get no domain association
}
```

Each mapped domain is versioned independently — bumping one domain's `version` in config won't re-version the others.

## Security

All user-controlled text is sanitized before embedding in markdown/MDX output. `sanitizeMarkdownText` escapes HTML special characters and markdown link syntax, and `sanitizeUrl` only allows `http:` and `https:` protocols (preventing `javascript:` and `data:` URI injection). Local spec file paths referenced by OpenAPI/AsyncAPI links are passed through `sanitizeLocalPath`, which rejects absolute paths and `../` traversal sequences. Shared helpers in `sanitize.ts` (`sanitizeHtml`, `sanitizeId`) are used for service/team IDs and for custom field text values returned by the Compass API. In API mode, the `baseUrl` is validated to require HTTPS, and debug logging redacts API tokens and email addresses.

## Found a problem?

Raise a GitHub issue on this project, or contact us on [our Discord server](https://discord.gg/3rjaZMmrAm).

## License

See [LICENSE](LICENSE).

## Contributing

See the [CONTRIBUTING.md](CONTRIBUTING.md) file for more information.
