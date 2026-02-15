# @ismaelmartinez/generator-atlassian-compass-event-catalog

## 0.1.0

### Minor Changes

- d3f5ee0: Modernize and fix core gaps (Phase 1)
  - Replace local Service type with SDK's Service type for richer metadata support
  - Map Compass lifecycle, tier, and labels to EventCatalog badges
  - Map Compass repository links to service repository URL
  - Map Compass ownerId to service owners
  - Support updating existing services with overrideExisting option (defaults to true)
  - Add Zod validation for generator configuration with clear error messages

- 26590b0: Support all Compass component types (Phase 2)
  - Remove SERVICE-only restriction — all Compass types (APPLICATION, LIBRARY, CAPABILITY, CLOUD_RESOURCE, DATA_PIPELINE, MACHINE_LEARNING_MODEL, OTHER, UI_ELEMENT, WEBSITE) are now processed as EventCatalog services
  - Add `typeFilter` option to selectively process only specified component types
  - Add component type badge showing the Compass type (e.g. APPLICATION, LIBRARY) on each service

## 0.0.9

### Patch Changes

- e6e0f5c: Phase 1: Update dependencies to latest versions

  Updated dependencies to latest versions (Phase 1 of modernization plan):
  - @eventcatalog/sdk: ^2.0.0 → ^2.9.0 (9 minor versions, no breaking changes)
  - @changesets/cli: ^2.28.1 → ^2.29.7
  - chalk: ^5.4.1 → ^5.6.2

  All tests pass with updated dependencies. See UPDATE_PLAN.md for full modernization roadmap.

## 0.0.8

### Patch Changes

- 3c0a302: Updating depencencies and moving to eventcatalog/sdk 2.0.0

## 0.0.7

### Patch Changes

- 06e4c92: Fix docs and update the dependencies

## 0.0.6

### Patch Changes

- 5600c7a: fix chalk version to 4 to avoid ESM breaking changes

## 0.0.5

### Patch Changes

- 7bfa0ac: update dependencies and adding default PROJECT_DIR when not present

## 0.0.4

### Patch Changes

- 85cf3f5: update dependencies and improve documentation

## 0.0.3

### Patch Changes

- 8694a60: Fixing #9 by moving away from Tiles as they don't support external links on bundle objects

## 0.0.2

### Patch Changes

- 92170b3: Initial BETA release
