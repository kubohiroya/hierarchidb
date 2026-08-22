import { test as base, expect, type Page, type Route } from '@playwright/test';
import { buildAppUrl } from '../utils/test-helpers';

const MOCK_AUTHORIZATION_CODE = 'canonical-e2e-authorization-code';
export const CANONICAL_E2E_ACCESS_TOKEN = 'canonical-e2e-session-token';
const MOCK_USER = {
  id: 'canonical-e2e-user',
  email: 'canonical-e2e@example.com',
  name: 'Canonical E2E User',
  provider: 'github',
} as const;

const appBaseUrl = new URL(buildAppUrl());
const appBasePath = appBaseUrl.pathname.replace(/\/$/, '');
const EXPECTED_RETURN_ORIGIN = `${appBaseUrl.origin}${appBasePath}`;
const EXPECTED_REDIRECT_URI = `${appBaseUrl.origin}${appBasePath}/auth/callback`;

type TokenExchangeRequest = {
  code?: unknown;
  code_verifier?: unknown;
  provider?: unknown;
  redirect_uri?: unknown;
};

export type CanonicalAuthRouteState = {
  authorizeRequestCount: number;
  tokenRequestCount: number;
  verifyRequestCount: number;
};

export type CanonicalAuthController = {
  signIn(): Promise<void>;
  readonly authorizationHeader: string;
  readonly routeState: CanonicalAuthRouteState;
};

const fulfillJson = async (route: Route, status: number, body: unknown): Promise<void> => {
  await route.fulfill({
    status,
    contentType: 'application/json',
    body: JSON.stringify(body),
  });
};

const parseTokenExchangeRequest = (route: Route): TokenExchangeRequest | null => {
  const rawBody = route.request().postData();
  if (rawBody === null) return null;
  try {
    const parsed: unknown = JSON.parse(rawBody);
    if (parsed === null || typeof parsed !== 'object' || Array.isArray(parsed)) return null;
    return parsed as TokenExchangeRequest;
  } catch {
    return null;
  }
};

const installCanonicalAuthRoutes = async (
  page: Page,
  routeState: CanonicalAuthRouteState
): Promise<void> => {
  await page.route('**/auth/authorize/*', async (route) => {
    routeState.authorizeRequestCount += 1;
    const authorizationUrl = new URL(route.request().url());
    const provider = authorizationUrl.pathname.split('/').filter(Boolean).at(-1);
    const codeChallenge = authorizationUrl.searchParams.get('code_challenge');
    const codeChallengeMethod = authorizationUrl.searchParams.get('code_challenge_method');
    const redirectUri = authorizationUrl.searchParams.get('redirect_uri');
    const returnOrigin = authorizationUrl.searchParams.get('return_origin');

    if (provider !== MOCK_USER.provider) {
      await fulfillJson(route, 400, { error: 'unsupported_e2e_provider' });
      return;
    }
    if (!codeChallenge || codeChallengeMethod !== 'S256') {
      await fulfillJson(route, 400, { error: 'invalid_e2e_pkce_request' });
      return;
    }
    if (redirectUri !== EXPECTED_REDIRECT_URI || returnOrigin !== EXPECTED_RETURN_ORIGIN) {
      await fulfillJson(route, 400, { error: 'invalid_e2e_redirect_uri' });
      return;
    }

    const callbackUrl = `${buildAppUrl('auth/callback')}?code=${encodeURIComponent(MOCK_AUTHORIZATION_CODE)}`;
    await route.fulfill({
      status: 302,
      headers: { Location: callbackUrl },
      body: '',
    });
  });

  await page.route('**/auth/token', async (route) => {
    routeState.tokenRequestCount += 1;
    const request = parseTokenExchangeRequest(route);
    if (
      route.request().method() !== 'POST' ||
      request?.code !== MOCK_AUTHORIZATION_CODE ||
      request.provider !== MOCK_USER.provider ||
      typeof request.code_verifier !== 'string' ||
      request.code_verifier.length === 0 ||
      request.redirect_uri !== EXPECTED_REDIRECT_URI
    ) {
      await fulfillJson(route, 400, {
        error: 'invalid_request',
        error_description: 'Canonical E2E token exchange contract violation',
      });
      return;
    }

    await fulfillJson(route, 200, {
      access_token: CANONICAL_E2E_ACCESS_TOKEN,
      token_type: 'Bearer',
      expires_in: 3_600,
      session_mode: 'stateless',
      scope: 'openid profile email',
      userinfo: {
        sub: MOCK_USER.id,
        email: MOCK_USER.email,
        name: MOCK_USER.name,
      },
    });
  });

  await page.route('**/auth/verify', async (route) => {
    routeState.verifyRequestCount += 1;
    const authorization = route.request().headers().authorization;
    if (
      route.request().method() !== 'POST' ||
      authorization !== `Bearer ${CANONICAL_E2E_ACCESS_TOKEN}`
    ) {
      await fulfillJson(route, 401, { error: 'Invalid token' });
      return;
    }
    await fulfillJson(route, 200, {
      valid: true,
      user: MOCK_USER,
    });
  });
};

const assertCanonicalPersistedSession = async (page: Page): Promise<void> => {
  const snapshot = await page.evaluate(() => ({
    accessToken: localStorage.getItem('access_token'),
    userinfo: localStorage.getItem('userinfo'),
    refreshTokenId: localStorage.getItem('refresh_token_id'),
    legacyIdToken: localStorage.getItem('id_token'),
    legacyRefreshToken: localStorage.getItem('refresh_token'),
    legacyTokenExpiresAt: localStorage.getItem('token_expires_at'),
  }));

  expect(snapshot.accessToken).toBe(CANONICAL_E2E_ACCESS_TOKEN);
  expect(snapshot.refreshTokenId).toBeNull();
  expect(snapshot.legacyIdToken).toBeNull();
  expect(snapshot.legacyRefreshToken).toBeNull();
  expect(snapshot.legacyTokenExpiresAt).toBeNull();
  if (snapshot.userinfo === null) {
    throw new Error('Canonical E2E login did not persist userinfo');
  }

  const userinfo: unknown = JSON.parse(snapshot.userinfo);
  expect(userinfo).toMatchObject({
    id: MOCK_USER.id,
    email: MOCK_USER.email,
    name: MOCK_USER.name,
    provider: MOCK_USER.provider,
    session_mode: 'stateless',
  });
  if (
    userinfo === null ||
    typeof userinfo !== 'object' ||
    Array.isArray(userinfo) ||
    typeof (userinfo as { expires_at?: unknown }).expires_at !== 'number'
  ) {
    throw new Error('Canonical E2E userinfo is missing numeric expires_at');
  }
  expect((userinfo as { expires_at: number }).expires_at).toBeGreaterThan(Date.now());
};

class CanonicalAuthControllerImpl implements CanonicalAuthController {
  private hasSignedIn = false;

  constructor(
    private readonly page: Page,
    readonly routeState: CanonicalAuthRouteState
  ) {}

  get authorizationHeader(): string {
    return `Bearer ${MOCK_ACCESS_TOKEN}`;
  }

  async signIn(): Promise<void> {
    if (this.hasSignedIn) {
      throw new Error('Canonical E2E authentication may only run once per test context');
    }
    this.hasSignedIn = true;

    await this.page.goto(buildAppUrl('auth/login'), { waitUntil: 'domcontentloaded' });
    const loginHeading = this.page.getByRole('heading', { name: 'Sign In' });
    const bootstrapFailure = this.page
      .locator('#hdb-hydrate-progress-message')
      .filter({ hasText: /failed/i });
    await expect(loginHeading.or(bootstrapFailure).first()).toBeVisible({ timeout: 30_000 });
    if (await bootstrapFailure.isVisible()) {
      const bootstrapMessage = (await bootstrapFailure.textContent())?.trim();
      const workerMessage = (await this.page.locator('#root').textContent())?.trim();
      throw new Error(
        `Canonical E2E app bootstrap failed before sign-in: ${bootstrapMessage}; worker=${workerMessage}`
      );
    }
    await expect(loginHeading).toBeVisible();

    await this.page.getByRole('button', { name: 'Sign in with GitHub' }).click();
    await this.page.waitForFunction(
      (expectedToken) => localStorage.getItem('access_token') === expectedToken,
      CANONICAL_E2E_ACCESS_TOKEN,
      { timeout: 30_000 }
    );
    await assertCanonicalPersistedSession(this.page);
    await expect(
      this.page.getByRole('button', { name: /User menu|ユーザーメニュー/i }).first()
    ).toBeVisible({ timeout: 30_000 });

    const verifyResult = await this.page.evaluate(async (accessToken) => {
      const response = await fetch('/auth/verify', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        },
        body: '{}',
      });
      return { ok: response.ok, status: response.status };
    }, CANONICAL_E2E_ACCESS_TOKEN);

    expect(verifyResult).toEqual({ ok: true, status: 200 });
    expect(this.routeState.authorizeRequestCount).toBe(1);
    expect(this.routeState.tokenRequestCount).toBe(1);
    expect(this.routeState.verifyRequestCount).toBe(1);
  }
}

type CanonicalAuthFixtures = {
  canonicalAuth: CanonicalAuthController;
};

export const test = base.extend<CanonicalAuthFixtures>({
  canonicalAuth: async ({ page }, use) => {
    const routeState: CanonicalAuthRouteState = {
      authorizeRequestCount: 0,
      tokenRequestCount: 0,
      verifyRequestCount: 0,
    };
    await installCanonicalAuthRoutes(page, routeState);
    await use(new CanonicalAuthControllerImpl(page, routeState));
  },
});

export { expect };
