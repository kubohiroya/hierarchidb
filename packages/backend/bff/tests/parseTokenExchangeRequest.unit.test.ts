import { describe, expect, it } from 'vitest';
import { parseTokenExchangeRequest } from '../src/auth/parseTokenExchangeRequest.js';

describe('parseTokenExchangeRequest', () => {
  it.each(['google', 'github', 'microsoft'] as const)(
    'accepts explicit provider %s',
    (provider) => {
      expect(parseTokenExchangeRequest({ code: 'authorization-code', provider })).toEqual({
        ok: true,
        value: { code: 'authorization-code', provider },
      });
    }
  );

  it.each([
    {},
    { code: 'authorization-code' },
    { code: 'authorization-code', provider: '' },
    { code: 'authorization-code', provider: 'unknown' },
  ])('rejects a missing or invalid provider without defaulting to Google', (input) => {
    expect(parseTokenExchangeRequest(input)).toEqual({
      ok: false,
      errorDescription:
        'code' in input ? 'OAuth provider is required' : 'Authorization code is required',
    });
  });

  it.each([{ redirect_uri: '' }, { redirect_uri: 1 }, { code_verifier: '' }, { code_verifier: 1 }])(
    'rejects invalid optional string fields: %o',
    (optionalField) => {
      const result = parseTokenExchangeRequest({
        code: 'authorization-code',
        provider: 'google',
        ...optionalField,
      });

      expect(result.ok).toBe(false);
    }
  );
});
