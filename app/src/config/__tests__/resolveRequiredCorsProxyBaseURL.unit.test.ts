import { describe, expect, it } from 'vitest';
import { resolveRequiredCorsProxyBaseURL } from '../resolveRequiredCorsProxyBaseURL.js';

describe('resolveRequiredCorsProxyBaseURL', () => {
  it.each([undefined, null, '', '   '])('rejects a missing or empty app value: %s', (value) => {
    expect(() => resolveRequiredCorsProxyBaseURL(value, 'app')).toThrow(
      'VITE_CORS_PROXY_BASE_URL is required for app startup.'
    );
  });

  it('reports the worker startup boundary', () => {
    expect(() => resolveRequiredCorsProxyBaseURL('', 'worker')).toThrow(
      'VITE_CORS_PROXY_BASE_URL is required for worker startup.'
    );
  });

  it('trims and returns a configured URL', () => {
    expect(resolveRequiredCorsProxyBaseURL('  https://proxy.example.test/  ', 'app')).toBe(
      'https://proxy.example.test/'
    );
  });
});
