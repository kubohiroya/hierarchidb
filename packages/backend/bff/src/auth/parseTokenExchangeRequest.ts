export type TokenExchangeProvider = 'google' | 'github' | 'microsoft';

export type TokenExchangeRequest = {
  code: string;
  provider: TokenExchangeProvider;
  redirect_uri?: string;
  code_verifier?: string;
};

export type ParseTokenExchangeRequestResult =
  | { ok: true; value: TokenExchangeRequest }
  | { ok: false; errorDescription: string };

const readOptionalNonEmptyString = (
  record: Record<string, unknown>,
  field: 'redirect_uri' | 'code_verifier'
): string | undefined | null => {
  const value = record[field];
  if (value === undefined) return undefined;
  if (typeof value !== 'string' || value.trim().length === 0) return null;
  return value;
};

export const parseTokenExchangeRequest = (input: unknown): ParseTokenExchangeRequestResult => {
  if (typeof input !== 'object' || input === null || Array.isArray(input)) {
    return { ok: false, errorDescription: 'Token exchange body must be an object' };
  }

  const record = input as Record<string, unknown>;
  if (typeof record.code !== 'string' || record.code.trim().length === 0) {
    return { ok: false, errorDescription: 'Authorization code is required' };
  }

  const provider = record.provider;
  if (provider !== 'google' && provider !== 'github' && provider !== 'microsoft') {
    return { ok: false, errorDescription: 'OAuth provider is required' };
  }

  const redirectUri = readOptionalNonEmptyString(record, 'redirect_uri');
  if (redirectUri === null) {
    return { ok: false, errorDescription: 'redirect_uri must be a non-empty string' };
  }

  const codeVerifier = readOptionalNonEmptyString(record, 'code_verifier');
  if (codeVerifier === null) {
    return { ok: false, errorDescription: 'code_verifier must be a non-empty string' };
  }

  return {
    ok: true,
    value: {
      code: record.code,
      provider,
      ...(redirectUri === undefined ? {} : { redirect_uri: redirectUri }),
      ...(codeVerifier === undefined ? {} : { code_verifier: codeVerifier }),
    },
  };
};
