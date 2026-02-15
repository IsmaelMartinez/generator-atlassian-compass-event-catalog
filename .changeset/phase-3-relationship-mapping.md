---
'@ismaelmartinez/generator-atlassian-compass-event-catalog': minor
---

feat: map Compass DEPENDS_ON relationships to service markdown

- Parse `relationships.DEPENDS_ON` from Compass YAML and resolve referenced services
- Add a "Dependencies" section to generated service markdown with links to dependent services
- Use a two-pass approach: first collect all services, then resolve dependencies between them
- Handle missing dependency targets gracefully (log warning, don't crash)
- Services without dependencies show "No known dependencies."
