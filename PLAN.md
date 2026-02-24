# Project Plan

## Cleanup (done)

### 1. Gitignore `package-lock.json` — done

Added `package-lock.json` to `.gitignore` and removed it from git tracking.

### 2. Clean stale remote branches — done

Deleted 15 stale remote branches. Only `main` and one active dependabot branch remain.

### 3. Move `@changesets/cli` to devDependencies — done

Moved from `dependencies` to `devDependencies` in `package.json`.

### 4. Add `packageManager` field to `package.json` — done

Added `"packageManager": "pnpm@9.15.9"` to enforce correct package manager via corepack.

## Code Improvements (done)

### 5. Fetch timeout protection — done

Added `AbortSignal.timeout(30_000)` to all 4 fetch calls in `compass-api.ts`.

### 6. Consolidate duplicate `sanitizeText` — done

Extracted shared HTML entity escaping into `src/sanitize.ts` (`sanitizeHtml`, `sanitizeId`). Updated `compass-api.ts`, `index.ts`, and `service.ts` to import from the shared module.

### 7. Cherry-pick `updateComponentOwner` from feature branch — done

Added `updateComponentOwner` GraphQL mutation and 3 tests directly to `compass-api.ts` (with timeout included). Feature branch deleted.

## Features

### 8. Team enrichment in service markdown

The generator fetches team display names via `fetchTeamById()`, but the team data could be richer: team members, team lead, contact channels. Compass exposes this through the Teams API. Richer team data would make EventCatalog service pages more actionable for on-call and ownership discovery.

### 9. Event discovery from AsyncAPI/OpenAPI specs

The generator produces services and domains, but EventCatalog's core concept is events. If Compass components reference AsyncAPI specs in their links, the generator could parse those specs and auto-create event entries linked to producing/consuming services. This would be the highest-value feature addition.

### 10. Incremental/diff mode

The generator rewrites everything on each run. For large catalogs (100+ components), an incremental mode that only updates services whose Compass config has changed (based on hash or timestamp) would improve performance and reduce unnecessary git diffs.

### 11. Component relationship visualisation — done

Wired `DEPENDS_ON` relationships into the SDK's `sends` property so `<NodeGraph />` renders the dependency graph. Scorecards hidden from badge output (too noisy for static catalog content).

### 12. Multi-site support

The current `ApiConfig` targets a single Atlassian site. Organisations with multiple Compass instances could benefit from aggregating into a single EventCatalog. Supporting an array of API configs would enable that.
