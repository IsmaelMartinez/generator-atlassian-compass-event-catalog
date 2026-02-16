# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

An EventCatalog generator plugin that reads Atlassian Compass YAML files and produces service entries in an EventCatalog. It parses `compass.yml` files, extracts metadata (links, badges, owners, dependencies), and uses the `@eventcatalog/sdk` to write services (and optionally domains) into the catalog's file system.

## Commands

Package manager is pnpm (v8 in CI). All commands use `pnpm run`.

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

The plugin exports a single async function from `src/index.ts` that EventCatalog calls with a config object and `GeneratorProps` options. Processing happens in two passes over the services array:

Pass 1 (`src/index.ts`): Load each compass YAML via `loadConfig` from `src/compass.ts`, apply the optional `typeFilter`, and build a `serviceMap` keyed by Compass ARN so that `DEPENDS_ON` relationships can be resolved between services.

Pass 2 (`src/index.ts`): For each processable file, call `loadService` from `src/service.ts` to build the `Service` object (markdown template with links, dependencies, badges, owners, repository URL), then write it via the EventCatalog SDK. If a `domain` option is provided, `src/domain.ts` handles creating/versioning the domain and associating services to it.

Key modules:
- `src/compass.ts` — `CompassConfig` type definition and YAML loading. The type mirrors the Atlassian Compass config-as-code spec.
- `src/service.ts` — Transforms a `CompassConfig` into an EventCatalog `Service`. Contains markdown template generation, badge building, URL sanitization (XSS prevention), and link formatting.
- `src/domain.ts` — `Domain` class that manages domain creation, versioning, and service association via the SDK.
- `src/validation.ts` — Zod schemas for validating `GeneratorProps` at runtime.
- `src/types.ts` — Shared TypeScript types (`GeneratorProps`, `DomainOption`, `ResolvedDependency`).

## Testing

Single test file at `src/test/plugin.test.ts`. Tests run the full plugin against a temporary catalog directory (`src/test/catalog/`) that gets cleaned up in `afterEach`. Test fixture YAML files live in `src/test/`. The `vitest.setup.ts` adds a custom `toMatchMarkdown` matcher that normalizes whitespace.

The `@eventcatalog/sdk` is inlined during testing (configured in `vitest.config.ts` via `server.deps.inline`).

## Security Considerations

`src/service.ts` sanitizes all user-controlled text before embedding in markdown/MDX: `sanitizeMarkdownText` escapes HTML special characters and markdown link syntax; `sanitizeUrl` only allows `http:`/`https:` protocols. `src/index.ts` sanitizes service IDs via `sanitizeId` to prevent path traversal.
