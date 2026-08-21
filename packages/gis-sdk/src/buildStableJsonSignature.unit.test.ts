import { describe, expect, it } from 'vitest';
import { buildStableJsonSignature } from './buildStableJsonSignature.js';

describe('buildStableJsonSignature', () => {
  it('canonicalizes object key order recursively', () => {
    expect(buildStableJsonSignature({ z: 1, nested: { b: true, a: false } })).toBe(
      buildStableJsonSignature({ nested: { a: false, b: true }, z: 1 })
    );
  });

  it('preserves the shared primitive-set semantics used by stage identities', () => {
    expect(buildStableJsonSignature({ keys: ['b', 'a'] })).toBe(
      buildStableJsonSignature({ keys: ['a', 'b'] })
    );
  });
});
