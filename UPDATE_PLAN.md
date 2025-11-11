# EventCatalog Generator Update Plan

## Project Review Summary

**Current Version**: 0.0.8
**EventCatalog SDK**: v2.0.0 → **Target: v2.9.0** (9 minor versions behind)
**Last Updated**: 2025-11-11

### Current State

This generator creates EventCatalog services from Atlassian Compass YAML configuration files.

**Strengths:**

- ✅ Follows EventCatalog generator pattern (CommonJS, async)
- ✅ Uses EventCatalog SDK correctly
- ✅ Good test coverage
- ✅ TypeScript implementation
- ✅ Domain organization support
- ✅ Service versioning

**Gaps vs Modern EventCatalog Standards:**

- ❌ No Zod schema validation
- ❌ SDK 9 versions behind (v2.0.0 vs v2.9.0)
- ❌ No draft status support
- ❌ No custom markdown generation
- ❌ No schema attachment support
- ⚠️ Basic error handling
- ⚠️ Limited versioning merge strategy

### SDK Changelog Highlights (v2.0.0 → v2.9.0)

- **v2.9.0**: Non-semver version support
- **v2.8.x**: Container/data-store support, GraphQL specs, versioning fixes
- **v2.7.x**: Entity SDK, detail panels, race condition fixes
- **v2.6.x**: Enhanced search, path compatibility, owner retrieval

**No Breaking Changes** - Safe to upgrade!

---

## Phase 1: Dependency Updates ✅

**Priority: HIGH | Risk: LOW**

### Tasks:

1. Update @eventcatalog/sdk: ^2.0.0 → ^2.9.0
2. Update @changesets/cli: ^2.28.1 → ^2.29.7
3. Update chalk: ^5.4.1 → ^5.6.2
4. Run full test suite
5. Verify backward compatibility

**Expected Release**: v0.0.9 (Patch)

---

## Phase 2: Code Quality & Standards

**Priority: MEDIUM | Risk: MEDIUM**

### Tasks:

1. **Add Zod Configuration Validation**
   - Schema for GeneratorProps
   - Validate service options
   - Better error messages
   - Files: `src/types.ts`, `src/index.ts`

2. **Enhanced Error Handling**
   - File not found errors
   - Compass YAML validation
   - Try-catch with meaningful messages
   - Files: `src/compass.ts`, `src/index.ts`

3. **Improved Debug Mode**
   - Detailed logging
   - SDK operation logs
   - Creation/skip visibility
   - File: `src/index.ts`

**Expected Release**: v0.1.0 (Minor)

---

## Phase 3: Feature Enhancements

**Priority: MEDIUM | Risk: MEDIUM**

### Tasks:

1. **Draft Status Support**
   - Add `draft?: boolean` to service options
   - Pass draft flag to SDK
   - Update tests
   - Files: `src/types.ts`, `src/index.ts`, `src/domain.ts`

2. **Service Versioning Improvements**
   - Check existing service version
   - Use `versionService()` when versions differ
   - Preserve markdown and attachments
   - Merge existing relationships
   - Files: `src/index.ts`

3. **Customizable Markdown Generation**
   - Optional `generateServiceMarkdown` function
   - Optional `generateDomainMarkdown` function
   - Maintain backward compatibility
   - Files: `src/types.ts`, `src/service.ts`, `src/domain.ts`

4. **Schema/File Attachments**
   - Attach Compass YAML as file
   - Support additional file attachments
   - Use SDK's `addFileToService()`
   - Files: `src/types.ts`, `src/index.ts`

**Expected Release**: v0.2.0 (Minor)

---

## Phase 4: Extended Functionality

**Priority: LOW | Risk: HIGHER**

### Tasks:

1. **Support Additional Compass Types**
   - APPLICATION → services
   - LIBRARY → services
   - Configurable typeId mapping
   - Files: `src/compass.ts`, `src/types.ts`

2. **Relationship Mapping**
   - Map Compass DEPENDS_ON to relationships
   - Use `addRelationshipToService()`
   - Files: `src/service.ts`, `src/index.ts`

3. **Enhanced Metadata**
   - Map lifecycle → badges
   - Map tier → metadata
   - Map custom fields → metadata
   - Files: `src/service.ts`

**Expected Release**: v0.3.0 (Minor)

---

## Phase 5: Developer Experience

**Priority: LOW | Risk: LOW**

### Tasks:

1. **Improved Documentation**
   - More examples in README
   - Document all options
   - Troubleshooting section
   - Migration guide
   - File: `README.md`

2. **Example Configurations**
   - Multiple example configs
   - Advanced usage patterns
   - Files: `examples/`

**Expected Release**: v0.3.1 (Patch)

---

## Testing Strategy

- Run existing test suite after each phase
- Add integration tests for new features
- Test with real Compass files
- Verify backward compatibility
- Check for breaking changes

---

## Quick Wins (Immediate Value)

1. ✅ Update @eventcatalog/sdk to ^2.9.0
2. ✅ Add Zod validation
3. ✅ Add draft status support
4. ✅ Improve service versioning logic

---

## Progress Tracking

- [ ] Phase 1: Dependency Updates
- [ ] Phase 2: Code Quality & Standards
- [ ] Phase 3: Feature Enhancements
- [ ] Phase 4: Extended Functionality
- [ ] Phase 5: Developer Experience

---

## Notes

- No breaking changes identified in SDK v2.0.0 → v2.9.0
- Maintain backward compatibility throughout
- Follow official EventCatalog generator patterns
- Reference: AsyncAPI generator as gold standard
