---
'@ismaelmartinez/generator-atlassian-compass-event-catalog': minor
---

Support all Compass component types (Phase 2)

- Remove SERVICE-only restriction — all Compass types (APPLICATION, LIBRARY, CAPABILITY, CLOUD_RESOURCE, DATA_PIPELINE, MACHINE_LEARNING_MODEL, OTHER, UI_ELEMENT, WEBSITE) are now processed as EventCatalog services
- Add `typeFilter` option to selectively process only specified component types
- Add component type badge showing the Compass type (e.g. APPLICATION, LIBRARY) on each service
