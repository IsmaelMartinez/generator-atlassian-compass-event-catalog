# Repository Analysis: generator-atlassian-compass-event-catalog

**Date**: 2026-02-12
**Current Version**: 0.0.9 (published ~3 months ago)
**EventCatalog SDK**: ^2.12.0 locally, ^2.9.0 on npm (latest SDK is 2.13.2)
**EventCatalog**: Now at v3 (released Jan 7, 2026)

---

## What This Repository Does

This is an **EventCatalog generator plugin** that reads Atlassian Compass YAML configuration files (`compass.yml`) and creates **services** and **domains** in EventCatalog. It:

1. Parses Compass YAML files (the config-as-code format Compass uses)
2. Creates EventCatalog services from Compass `SERVICE` type components
3. Optionally groups services into EventCatalog domains
4. Generates markdown with links back to Compass (component URL, team URL, related links)
5. Handles domain versioning

It does **not** call the Compass API. It reads local YAML files only.

---

## Verdict: Still Useful? YES, But Needs Work

### Why it's still relevant

1. **EventCatalog v3 still uses the same generator system.** The generator plugin pattern (async function + SDK) is unchanged from v2 to v3. This generator follows the correct pattern and will continue to work.

2. **Compass is alive and growing.** Atlassian continues to invest in Compass -- custom component types (Nov 2024), API spec governance (Optic acquisition), improved scorecards, and more. Compass is a core part of Atlassian's developer platform story.

3. **It's listed on the official EventCatalog integrations page** at `eventcatalog.dev/integrations/atlassian-compass`. This gives it visibility and signals it has a user base.

4. **Tests pass, build works.** The codebase is healthy -- all 5 tests pass, the build produces valid CJS/ESM bundles, and the TypeScript types are clean.

5. **There is no competing alternative.** No other generator bridges Compass and EventCatalog.

### Why it needs work

1. **It only reads local YAML files, not the Compass API.** This is the biggest limitation. Users must manually maintain or copy `compass.yml` files to wherever EventCatalog runs. Compass has a full GraphQL API (`compass.searchComponents`, `compass.component`) that could be used to pull components directly -- making the generator self-service and always up-to-date.

2. **Only `SERVICE` type is supported.** Compass has 10+ component types (APPLICATION, LIBRARY, CAPABILITY, CLOUD_RESOURCE, DATA_PIPELINE, etc.) plus custom types. The generator throws an error on anything that isn't SERVICE.

3. **No relationship mapping.** Compass YAML has `relationships.DEPENDS_ON` but the generator ignores it. EventCatalog SDK has `addRelationshipToService()` that could map these dependencies.

4. **Never updates existing services.** Once a service exists, it's skipped entirely. If Compass data changes (description, links, team), the EventCatalog service goes stale.

5. **No metadata mapping.** Compass `fields.lifecycle`, `fields.tier`, `labels`, and `customFields` are all ignored. These could map to EventCatalog badges, metadata, or owners.

6. **No schema/spec attachment.** Compass now has native API spec support (OpenAPI). These could be attached to EventCatalog services.

---

## Should We Throw It Away?

**No.** The core architecture is sound:

- It follows the correct EventCatalog generator pattern
- The SDK usage is standard and compatible with v3
- The TypeScript codebase is clean and testable
- The CI/CD pipeline (tests, lint, build, release via changesets) is production-grade
- It has a clear update plan already (`UPDATE_PLAN.md`)

Throwing it away would mean losing all of this infrastructure and starting from scratch for no architectural reason. The generator pattern hasn't changed.

---

## What Does Need to Change

### Critical Gap: API-Based Discovery

The single most impactful change would be adding **Compass GraphQL API support** so the generator can pull components directly from Compass rather than requiring local YAML files. This would:

- Eliminate manual file management
- Ensure the catalog is always in sync with Compass
- Enable discovery of all components (not just ones with local YAML)
- Unlock relationship mapping (dependencies between components)

The Compass GraphQL API supports:

- `compass.searchComponents(cloudId, query)` -- list all components with pagination
- `compass.component(id)` -- get full component details including links, labels, custom fields, relationships
- Authentication via API token or OAuth

### Recommended Evolution Path

#### Phase 1: Modernize (low effort, high hygiene value)

- Update SDK to ^2.13.x (currently ^2.12.0 locally, ^2.9.0 on npm)
- Add Zod validation for config (as planned in UPDATE_PLAN.md)
- Support updating existing services (don't skip, merge/overwrite)
- Better error handling and logging

#### Phase 2: Expand Compass Type Support (medium effort)

- Support APPLICATION, LIBRARY, and other component types
- Configurable type-to-EventCatalog mapping
- Map `lifecycle` to badges or metadata
- Map `tier` to metadata
- Map `labels` to EventCatalog labels/tags

#### Phase 3: Relationship Mapping (medium effort)

- Parse `relationships.DEPENDS_ON` from YAML
- Use SDK's `addRelationshipToService()` to create dependency links
- This is what makes EventCatalog's NodeGraph visualization actually useful

#### Phase 4: Compass API Integration (high effort, highest value)

- Add optional Compass GraphQL API mode alongside YAML mode
- Use API token authentication
- Auto-discover all components from a Compass cloud instance
- Pull relationships, scorecards, and metadata
- Make YAML mode the "simple" path, API mode the "full" path

#### Phase 5: Advanced Features (low priority)

- Attach OpenAPI specs from Compass to EventCatalog services
- Map scorecard data to service quality metadata
- Support EventCatalog v3 features (data products, data stores)
- Custom markdown templates

---

## Summary

| Question                           | Answer                                                                          |
| ---------------------------------- | ------------------------------------------------------------------------------- |
| Does it still work?                | **Yes** -- tests pass, build works, SDK compatible                              |
| Is it still architecturally valid? | **Yes** -- follows the current EventCatalog generator pattern (unchanged in v3) |
| Is it useful?                      | **Yes, but limited** -- only reads local YAML, only SERVICE type, no updates    |
| Should we throw it away?           | **No** -- the foundation is solid, the infra is production-grade                |
| What's the biggest gap?            | No Compass API integration (reads files, not the live Compass instance)         |
| What should we do?                 | Evolve it in phases: modernize → expand types → relationships → API integration |
| Is there a competing alternative?  | **No** -- this is the only Compass-to-EventCatalog generator                    |

The generator is a valid, working, correctly-architected plugin that needs to grow from a "YAML file reader" into a "Compass integration." The foundation is there; the features need to catch up with what both Compass and EventCatalog now offer.
