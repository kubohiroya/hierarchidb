import { describe, expect, it } from 'vitest';
import { requireAuthProvider } from '../requireAuthProvider.js';

describe('requireAuthProvider', () => {
  it.each(['google', 'microsoft', 'github'] as const)('accepts %s', (provider) => {
    expect(requireAuthProvider(provider)).toBe(provider);
  });

  it.each([undefined, null, '', 'unknown'])('rejects %s', (provider) => {
    expect(() => requireAuthProvider(provider)).toThrow('OAuth provider is required');
  });
});
