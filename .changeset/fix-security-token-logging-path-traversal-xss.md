---
"@ismaelmartinez/generator-atlassian-compass-event-catalog": patch
---

fix: address security vulnerabilities in token logging, path traversal, and XSS

- Prevent potential API token leakage via error logs in team fetch failure handling
- Sanitize local spec file paths to reject path traversal sequences (`../`) and absolute paths
- Sanitize custom field text values from Compass API to prevent XSS in rendered markdown
