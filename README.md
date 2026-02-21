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

| Option              | Type                                 | Default    | Description                                                        |
| ------------------- | ------------------------------------ | ---------- | ------------------------------------------------------------------ |
| `services`          | `ServiceOptions[]`                   | -          | YAML mode: array of local compass file paths                       |
| `api`               | `ApiConfig`                          | -          | API mode: Compass GraphQL API connection config                    |
| `compassUrl`        | `string`                             | (required) | Base URL for Compass component links                               |
| `domain`            | `{ id, name, version }`              | -          | Associate all services with a domain (created if it doesn't exist) |
| `typeFilter`        | `string[]`                           | -          | Only process components matching these type IDs                    |
| `overrideExisting`  | `boolean`                            | `true`     | Whether to update existing services or skip them                   |
| `debug`             | `boolean`                            | `false`    | Enable debug logging (credentials are redacted)                    |
| `format`            | `'md' \| 'mdx'`                      | `'mdx'`    | Output file format                                                 |
| `serviceIdStrategy` | `'name' \| 'compass-id' \| Function` | `'name'`   | How service IDs are derived                                        |
| `markdownTemplate`  | `Function`                           | -          | Custom function to generate service markdown content               |
| `dryRun`            | `boolean`                            | `false`    | Log what would happen without writing any changes                  |

See the [example configuration](examples/eventcatalog.config.js) for a complete working setup.

## Features

### Component type support

All Compass component types are supported: SERVICE, APPLICATION, LIBRARY, CAPABILITY, CLOUD_RESOURCE, DATA_PIPELINE, MACHINE_LEARNING_MODEL, UI_ELEMENT, WEBSITE, and OTHER. Each component is written as an EventCatalog service entry. Use `typeFilter` to restrict which types are processed.

### Dependency mapping

`DEPENDS_ON` relationships defined in Compass are resolved to links between EventCatalog services. Dependencies are resolved across all services processed in the same generator run, and unresolvable ARNs are logged and skipped gracefully.

### Badge generation

Services receive color-coded badges based on their Compass metadata: component type (e.g. SERVICE, APPLICATION), lifecycle stage (Active, Pre-release, Deprecated), tier level (1-4), labels, and scorecard scores (green/amber/red based on percentage). Scorecard badges show the score name and percentage.

### Team creation

When a component has an `ownerId`, the generator extracts the team UUID and creates an EventCatalog team entity. In API mode, the team's display name is fetched from Compass; in YAML mode the UUID is used as the name. Teams are deduplicated across services.

### OpenAPI and AsyncAPI spec detection

Links with names containing "openapi" or "swagger" are attached as OpenAPI specifications, and links with "asyncapi" are attached as AsyncAPI specifications. This allows EventCatalog to render API documentation alongside service pages.

### Custom markdown templates

Provide a `markdownTemplate` function to fully control the markdown content generated for each service. The function receives the `CompassConfig` and resolved dependencies array:

```js
markdownTemplate: (config, dependencies) => {
  return `# ${config.name}\n\nDeps: ${dependencies.map(d => d.name).join(', ')}`;
},
```

### Service ID strategies

Control how service IDs are derived with `serviceIdStrategy`:

- `'name'` (default): uses the component name from Compass
- `'compass-id'`: uses the Compass ARN (sanitized for filesystem safety)
- Custom function: `(config) => string` for full control

File-level `id` overrides in YAML mode always take precedence over the strategy.

### Dry-run mode

Set `dryRun: true` to see what the generator would do without writing any files. Services, teams, and domain associations are all logged but not persisted.

### Error resilience

The generator continues processing when individual services fail (e.g. malformed YAML, missing files). A summary at the end reports succeeded and failed counts with error details.

### Domain support

When a `domain` option is provided, all generated services are associated with that domain. The domain is created automatically if it doesn't exist, and versioned if the version changes between runs.

## Security

All user-controlled text is sanitized before embedding in markdown/MDX output. `sanitizeMarkdownText` escapes HTML special characters and markdown link syntax. `sanitizeUrl` only allows `http:` and `https:` protocols, preventing `javascript:` and `data:` URI injection. Service IDs are sanitized to prevent path traversal. In API mode, the `baseUrl` is validated to require HTTPS, and debug logging redacts API tokens and email addresses.

## Found a problem?

Raise a GitHub issue on this project, or contact us on [our Discord server](https://discord.gg/3rjaZMmrAm).

## License

See [LICENSE](LICENSE).

## Contributing

See the [CONTRIBUTING.md](CONTRIBUTING.md) file for more information.
