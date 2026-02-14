---
'@ismaelmartinez/generator-atlassian-compass-event-catalog': minor
---

Modernize and fix core gaps (Phase 1)

- Replace local Service type with SDK's Service type for richer metadata support
- Map Compass lifecycle, tier, and labels to EventCatalog badges
- Map Compass repository links to service repository URL
- Map Compass ownerId to service owners
- Support updating existing services with overrideExisting option (defaults to true)
- Add Zod validation for generator configuration with clear error messages
