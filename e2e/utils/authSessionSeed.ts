export type E2EAuthSessionSeed = {
  accessToken: string;
  userinfoRaw: string;
  refreshTokenId?: string;
};

const decodeBase64Utf8 = (value: string): string =>
  Buffer.from(value, 'base64').toString('utf8').trim();

export const readE2EAuthSessionSeed = (): E2EAuthSessionSeed => {
  const accessToken = (process.env.E2E_AUTH_ACCESS_TOKEN ?? '').trim();
  if (!accessToken) {
    throw new Error('E2E auth seed is missing: set E2E_AUTH_ACCESS_TOKEN');
  }

  const userinfoRawFromEnv = (process.env.E2E_AUTH_USERINFO ?? '').trim();
  const userinfoRawFromB64 = (process.env.E2E_AUTH_USERINFO_B64 ?? '').trim();
  const userinfoRaw =
    userinfoRawFromEnv || (userinfoRawFromB64 ? decodeBase64Utf8(userinfoRawFromB64) : '');
  if (!userinfoRaw) {
    throw new Error(
      'E2E auth seed is missing: set E2E_AUTH_USERINFO or E2E_AUTH_USERINFO_B64 to canonical session userinfo'
    );
  }

  const refreshTokenId = (process.env.E2E_AUTH_REFRESH_TOKEN_ID ?? '').trim();
  return {
    accessToken,
    userinfoRaw,
    ...(refreshTokenId ? { refreshTokenId } : {}),
  };
};

export const createStatelessE2EAuthSessionSeed = (
  accessToken: string,
  expiresAt = Date.now() + 60 * 60 * 1000
): E2EAuthSessionSeed => ({
  accessToken,
  userinfoRaw: JSON.stringify({
    id: 'e2e-user',
    email: 'e2e@example.com',
    name: 'E2E User',
    provider: 'github',
    expires_at: expiresAt,
    session_mode: 'stateless',
  }),
});

export const persistE2EAuthSessionSeed = (seed: E2EAuthSessionSeed): void => {
  localStorage.setItem('access_token', seed.accessToken);
  localStorage.setItem('userinfo', seed.userinfoRaw);
  if (seed.refreshTokenId) {
    localStorage.setItem('refresh_token_id', seed.refreshTokenId);
  } else {
    localStorage.removeItem('refresh_token_id');
  }
  localStorage.removeItem('id_token');
  localStorage.removeItem('refresh_token');
  localStorage.removeItem('token_expires_at');
  localStorage.setItem('last_auth_completion', String(Date.now()));
};
