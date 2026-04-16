---
'@ismaelmartinez/generator-atlassian-compass-event-catalog': minor
---

Support deriving domains from Compass labels or custom fields. The `domain` option now accepts a mapping config (`{ from: 'label' | 'customField', key?, mapping, fallback? }`) in addition to the existing static `{ id, name, version }` form. Services resolve to domains per-component; each mapped domain is versioned independently and created lazily on first use.
