import { expect, it, describe } from 'vitest';
import { resolveDomain } from '../domain';
import type { CompassConfig } from '../compass';

const base: CompassConfig = { name: 'svc' };

describe('resolveDomain', () => {
  it('returns the static spec unchanged', () => {
    const spec = { id: 'd', name: 'D', version: '1.0.0' };
    expect(resolveDomain(base, spec)).toBe(spec);
  });

  it('matches the first label present in the mapping', () => {
    const target = { id: 'first', name: 'First', version: '1.0.0' };
    const other = { id: 'second', name: 'Second', version: '1.0.0' };
    const result = resolveDomain({ ...base, labels: ['foo', 'bar'] }, { from: 'label', mapping: { bar: other, foo: target } });
    expect(result).toBe(target);
  });

  it('matches a custom field value', () => {
    const target = { id: 'web', name: 'Web', version: '1.0.0' };
    const result = resolveDomain(
      { ...base, customFields: [{ type: 'text' as never, name: 'platform', value: 'web' }] },
      { from: 'customField', key: 'platform', mapping: { web: target } }
    );
    expect(result).toBe(target);
  });

  it('returns the fallback when no label matches', () => {
    const fallback = { id: 'fb', name: 'FB', version: '1.0.0' };
    expect(resolveDomain({ ...base, labels: ['unmapped'] }, { from: 'label', mapping: {}, fallback })).toBe(fallback);
  });

  it('returns null when no match and fallback is "skip"', () => {
    expect(resolveDomain({ ...base, labels: ['unmapped'] }, { from: 'label', mapping: {}, fallback: 'skip' })).toBeNull();
  });

  it('returns null when no match and fallback is omitted', () => {
    expect(resolveDomain({ ...base, labels: ['unmapped'] }, { from: 'label', mapping: {} })).toBeNull();
  });

  it('ignores inherited Object.prototype properties on the mapping (labels)', () => {
    // Regression: `{}.toString` is a function on Object.prototype; a label
    // of "toString" must not resolve via prototype chain lookup.
    expect(
      resolveDomain(
        { ...base, labels: ['toString', 'constructor', 'hasOwnProperty'] },
        { from: 'label', mapping: {}, fallback: 'skip' }
      )
    ).toBeNull();
  });

  it('ignores inherited Object.prototype properties on the mapping (customField)', () => {
    expect(
      resolveDomain(
        { ...base, customFields: [{ type: 'text' as never, name: 'k', value: 'toString' }] },
        { from: 'customField', key: 'k', mapping: {}, fallback: 'skip' }
      )
    ).toBeNull();
  });

  it('ignores non-string custom field values', () => {
    expect(
      resolveDomain(
        { ...base, customFields: [{ type: 'boolean' as never, name: 'k', value: true as never }] },
        { from: 'customField', key: 'k', mapping: { true: { id: 'x', name: 'X', version: '1.0.0' } } }
      )
    ).toBeNull();
  });
});
