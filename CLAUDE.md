# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

An EventCatalog generator plugin that reads Atlassian Compass components and produces service entries in an EventCatalog. It supports two mutually exclusive input modes: **YAML mode** (parses local `compass.yml` files) and **API mode** (fetches components from the Compass GraphQL API). In both modes it extracts metadata (links, badges, owners, dependencies, custom fields, scorecards) and uses the `@eventcatalog/sdk` to write services, teams, and optionally a domain into the catalog's file system.

## Commands

Package manager is pnpm (pinned via `packageManager` field). All commands use `pnpm run`.

```
pnpm install          # install deps
pnpm run build        # build with tsup (CJS + ESM + .d.ts into dist/)
pnpm run test         # run vitest in watch mode
pnpm run test -- run  # single test run (no watch)
pnpm run lint         # eslint
pnpm run lint:fix     # eslint with auto-fix
pnpm run format:diff  # prettier check (CI uses this)
pnpm run format       # prettier write
```

CI runs three checks on PRs: Tests, Lint (eslint + prettier), and Verify Build. All must pass.

## Architecture

The plugin exports a single async function from `src/index.ts` that EventCatalog calls with a config object and `GeneratorProps` options. After validating options with the Zod schema, processing happens in two passes:

Pass 1 (`src/index.ts`): Build processable entries. In **API mode** (`options.api`), call `fetchComponents` from `src/compass-api.ts` to page through the Compass GraphQL API. In **YAML mode** (`options.services`), call `loadConfig` from `src/compass.ts` to parse each local file. Apply `typeFilter`, `nameFilter`, and `nameMapping`, and build a `serviceMap` keyed by Compass ARN so that `DEPENDS_ON` relationships can be resolved between services in the same run.

Pass 2 (`src/index.ts`): For each processable entry, resolve dependencies, optionally fetch enriched team data via `fetchTeamById` (API mode), write the team entity, call `loadService` from `src/service.ts` to build the `Service` object, and write it via the SDK. When `incremental: true`, each built `Service` is SHA-256 hashed and compared against `.compass-hashes.json` in the project directory to skip unchanged services. If a `domain` option is provided, `src/domain.ts` handles creating/versioning the domain and associating services to it. `dryRun: true` logs the intended actions without writing.

Key modules:

- `src/compass.ts` — `CompassConfig` type definition and YAML loading. The type mirrors the Atlassian Compass config-as-code spec.
- `src/compass-api.ts` — Compass GraphQL client. `fetchComponents` paginates through `searchComponents`, `fetchTeamById` queries the Teams v2 API for enriched team data (description, avatar, members), `fetchScorecardNames` resolves scorecard display names, and `updateComponentOwner` is available as a mutation helper. `resolveValue` expands `$ENV_VAR` references for credentials. All fetches use a 30s `AbortSignal.timeout`.
- `src/service.ts` — Transforms a `CompassConfig` into an EventCatalog `Service`. Handles the default markdown template (with categorised link subsections, custom fields table, dependencies, and `<NodeGraph />`), badge building, URL sanitization (XSS prevention), attachments from structured links, `styles.icon` based on `typeId`, and OpenAPI/AsyncAPI spec detection from link names.
- `src/domain.ts` — `Domain` class that manages domain creation, versioning, and service association via the SDK.
- `src/sanitize.ts` — Shared `sanitizeHtml` (HTML entity escaping) and `sanitizeId` (path-traversal-safe IDs) used across modules.
- `src/validation.ts` — Zod schemas for validating `GeneratorProps` at runtime. Enforces `services` XOR `api`, HTTPS `baseUrl` in API mode, and required fields.
- `src/types.ts` — Shared TypeScript types (`GeneratorProps`, `ApiConfig`, `DomainOption`, `ResolvedDependency`, `StructuredLink`, `MarkdownTemplateFn`, `ServiceIdStrategy`).

## Testing

Two test files live in `src/test/`:

- `plugin.test.ts` — end-to-end tests that run the full plugin against a temporary catalog directory (`src/test/catalog/`) cleaned up in `afterEach`. Uses YAML fixtures (`my-*-compass.yml`, `malformed-compass.yml`) from the same directory.
- `compass-api.test.ts` — unit tests for the GraphQL client that stub `global.fetch` to exercise pagination, error handling, team/scorecard fetching, and the `updateComponentOwner` mutation.

`vitest.setup.ts` adds a custom `toMatchMarkdown` matcher that normalizes whitespace. The `@eventcatalog/sdk` is inlined during testing (configured in `vitest.config.ts` via `server.deps.inline`).

## Security Considerations

`src/service.ts` sanitizes all user-controlled text before embedding in markdown/MDX: `sanitizeMarkdownText` escapes HTML special characters and markdown link syntax; `sanitizeUrl` only allows `http:`/`https:` protocols; `sanitizeLocalPath` rejects absolute paths and `../` traversal sequences before attaching OpenAPI/AsyncAPI specs. `src/sanitize.ts` provides the shared `sanitizeHtml` and `sanitizeId` helpers used by `index.ts` (service/team IDs) and `compass-api.ts` (custom field text values). In API mode, `validation.ts` requires the `baseUrl` to use HTTPS, and debug logging in `index.ts` redacts `apiToken` and `email`.

## Repo Butler

This repo is monitored by [Repo Butler](https://github.com/IsmaelMartinez/repo-butler), a portfolio health agent that observes repo health daily and generates dashboards, governance proposals, and tier classifications.

**Your report:** https://ismaelmartinez.github.io/repo-butler/generator-atlassian-compass-event-catalog.html
**Portfolio dashboard:** https://ismaelmartinez.github.io/repo-butler/
**Consumer guide:** https://github.com/IsmaelMartinez/repo-butler/blob/main/docs/consumer-guide.md

### Querying Reginald (the butler MCP server)

To query your repo's health tier, governance findings, and portfolio data from any Claude Code session, add the MCP server once (adjust the path to your local repo-butler checkout):

```bash
claude mcp add repo-butler node /path/to/repo-butler/src/mcp.js
```

Available tools: `get_health_tier`, `get_campaign_status`, `query_portfolio`, `get_snapshot_diff`, `get_governance_findings`, `trigger_refresh`.

When working on health improvements, check the per-repo report for the current tier checklist and use the consumer guide for fix instructions.
