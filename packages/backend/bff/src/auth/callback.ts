import {
  exchangeCodeForTokens as exchangeGitHubCodeForTokens,
  type GitHubOAuth2Config,
  getGitHubUserInfo,
} from '~/auth/github';
import {
  type ExchangeCodeForTokensReturn,
  exchangeCodeForTokens,
  type GoogleOAuth2Config,
  getGoogleUserInfo,
} from '~/auth/google';
import {
  exchangeCodeForTokens as exchangeMicrosoftCodeForTokens,
  getMicrosoftUserInfo,
  type MicrosoftOAuth2Config,
} from '~/auth/microsoft';
import {
  parseTokenExchangeRequest,
  type TokenExchangeProvider,
} from '~/auth/parseTokenExchangeRequest';
import { type TokenExchangeStage, TokenExchangeStageError } from '~/auth/TokenExchangeStageError';
import { type BffContext, getEnv } from '~/utils/env';
import { createSessionToken } from '~/utils/jwt';
import { KVStorageManager } from '~/utils/kv-storage';
import { buildKvWarning, type KvWarning } from '~/utils/kv-warning';
import { type AuthSessionMode, parseAuthSessionConfig } from '~/utils/parseAuthSessionConfig';
import {
  buildAppCallbackUrl,
  getAppCallbackUrlFromState,
  validateRedirectUri,
} from '~/utils/redirect-uri';
import { StateManager } from '~/utils/state-manager';

/**
 * Handle OAuth2 callback from OAuth providers
 * This validates the provider callback and returns the authorization code to the frontend
 */
export async function handleOAuth2Callback(c: BffContext) {
  let stateOrigin: string | undefined;
  try {
    const url = new URL(c.req.url);
    const code = url.searchParams.get('code');
    const state = url.searchParams.get('state');
    const error = url.searchParams.get('error');
    //  StateCSRF
    if (state) {
      const env = getEnv(c);
      const stateManager = new StateManager(env.JWT_SECRET || 'default-secret');
      const stateData = await stateManager.validateState(state);

      if (!stateData) {
        console.warn('State validation failed; continuing without atoms enforcement');
      } else if (stateData.origin) {
        stateOrigin = stateData.origin;
        const appBaseUrl = getAppCallbackUrlFromState(c, state, stateOrigin);
        if (!appBaseUrl.startsWith(stateData.origin)) {
          console.warn('State origin mismatch:', stateData.origin, appBaseUrl);
          const errorUrl = buildAppCallbackUrl(c, stateData.origin);
          errorUrl.searchParams.set('error', 'invalid_state');
          return c.redirect(errorUrl.toString());
        }
      }
    }

    // Handle OAuth2 errors
    if (error) {
      const errorDescription = url.searchParams.get('error_description') || 'Authentication failed';

      // Redirect back to src with error
      const appBaseUrl = getAppCallbackUrlFromState(c, state, stateOrigin);
      const appCallbackUrl = buildAppCallbackUrl(c, appBaseUrl);
      appCallbackUrl.searchParams.set('error', error);
      appCallbackUrl.searchParams.set('error_description', errorDescription);
      return c.redirect(appCallbackUrl.toString());
    }

    if (!code) {
      // Redirect back to src with error
      const appBaseUrl = getAppCallbackUrlFromState(c, state, stateOrigin);
      const appCallbackUrl = buildAppCallbackUrl(c, appBaseUrl);
      appCallbackUrl.searchParams.set('error', 'invalid_request');
      appCallbackUrl.searchParams.set('error_description', 'Authorization code missing');
      return c.redirect(appCallbackUrl.toString());
    }

    // Redirect to src callback with the authorization code
    const appBaseUrl = getAppCallbackUrlFromState(c, state, stateOrigin);
    const appCallbackUrl = buildAppCallbackUrl(c, appBaseUrl);
    appCallbackUrl.searchParams.set('code', code);
    if (state) {
      appCallbackUrl.searchParams.set('state', state);
    }

    return c.redirect(appCallbackUrl.toString());
  } catch (error) {
    console.error('OAuth2 callback error:', error);

    // Redirect back to src with error
    const url = new URL(c.req.url);
    const state = url.searchParams.get('state');
    const appBaseUrl = getAppCallbackUrlFromState(c, state, stateOrigin);
    const appCallbackUrl = buildAppCallbackUrl(c, appBaseUrl);
    appCallbackUrl.searchParams.set('error', 'server_error');
    appCallbackUrl.searchParams.set('error_description', 'Failed to process authentication');

    return c.redirect(appCallbackUrl.toString());
  }
}

type UserInfo = {
  id: string;
  email: string;
  name: string;
  picture: string | undefined;
};

type GetAuthorizationCodeReturn = {
  tokens: ExchangeCodeForTokensReturn;
  userInfo: UserInfo;
};

const runTokenExchangeStage = async <T>(
  stage: TokenExchangeStage,
  provider: TokenExchangeProvider,
  operation: () => Promise<T>
): Promise<T> => {
  try {
    return await operation();
  } catch (error) {
    throw new TokenExchangeStageError(stage, provider, error);
  }
};

const logTokenExchangeFailure = (error: unknown): void => {
  if (error instanceof TokenExchangeStageError) {
    console.error('[auth][token] exchange failed', {
      stage: error.stage,
      provider: error.provider,
      errorType: error.errorType,
      ...(error.providerStatus === undefined ? {} : { providerStatus: error.providerStatus }),
      ...(error.providerErrorCode === undefined
        ? {}
        : { providerErrorCode: error.providerErrorCode }),
    });
    return;
  }

  console.error('[auth][token] exchange failed', {
    stage: 'unclassified',
    errorType: error instanceof Error ? error.name : typeof error,
  });
};

const getAuthorizationCode = async ({
  provider,
  env,
  code,
  code_verifier,
}: {
  provider: TokenExchangeProvider;
  env: {
    GOOGLE_CLIENT_ID?: string;
    GOOGLE_CLIENT_SECRET?: string;
    GITHUB_CLIENT_ID?: string;
    GITHUB_CLIENT_SECRET?: string;
    MICROSOFT_CLIENT_ID?: string;
    MICROSOFT_CLIENT_SECRET?: string;
    REDIRECT_URI?: string;
    GITHUB_REDIRECT_URI?: string;
    MICROSOFT_REDIRECT_URI?: string;
  };
  code: string;
  code_verifier?: string;
}): Promise<GetAuthorizationCodeReturn> => {
  switch (provider) {
    case 'google': {
      const config = await runTokenExchangeStage(
        'provider_configuration',
        provider,
        async (): Promise<GoogleOAuth2Config> => {
          if (!env.GOOGLE_CLIENT_ID || !env.GOOGLE_CLIENT_SECRET || !env.REDIRECT_URI) {
            throw new Error('Google OAuth configuration is incomplete');
          }
          return {
            clientId: env.GOOGLE_CLIENT_ID,
            clientSecret: env.GOOGLE_CLIENT_SECRET,
            redirectUri: env.REDIRECT_URI,
          };
        }
      );
      const tokens = await runTokenExchangeStage('provider_token_exchange', provider, () =>
        exchangeCodeForTokens(code, config, code_verifier)
      );
      const userInfo = await runTokenExchangeStage('provider_userinfo', provider, () =>
        getGoogleUserInfo(tokens.access_token)
      );
      return {
        tokens,
        userInfo,
      };
    }

    case 'github': {
      const config = await runTokenExchangeStage(
        'provider_configuration',
        provider,
        async (): Promise<GitHubOAuth2Config> => {
          if (!env.GITHUB_CLIENT_ID || !env.GITHUB_CLIENT_SECRET || !env.GITHUB_REDIRECT_URI) {
            throw new Error('GitHub OAuth configuration is incomplete');
          }
          return {
            clientId: env.GITHUB_CLIENT_ID,
            clientSecret: env.GITHUB_CLIENT_SECRET,
            redirectUri: env.GITHUB_REDIRECT_URI,
          };
        }
      );
      const tokens = await runTokenExchangeStage('provider_token_exchange', provider, () =>
        exchangeGitHubCodeForTokens(code, config)
      );
      const userInfo = await runTokenExchangeStage('provider_userinfo', provider, () =>
        getGitHubUserInfo(tokens.access_token)
      );

      return {
        tokens,
        userInfo: {
          id: userInfo.id.toString(),
          email: userInfo.email || `${userInfo.login}@users.noreply.github.com`,
          name: userInfo.name || userInfo.login,
          picture: userInfo.avatar_url,
        },
      };
    }

    case 'microsoft': {
      const config = await runTokenExchangeStage(
        'provider_configuration',
        provider,
        async (): Promise<MicrosoftOAuth2Config> => {
          if (
            !env.MICROSOFT_CLIENT_ID ||
            !env.MICROSOFT_CLIENT_SECRET ||
            !env.MICROSOFT_REDIRECT_URI
          ) {
            throw new Error('Microsoft OAuth configuration is incomplete');
          }
          return {
            clientId: env.MICROSOFT_CLIENT_ID,
            clientSecret: env.MICROSOFT_CLIENT_SECRET,
            redirectUri: env.MICROSOFT_REDIRECT_URI,
          };
        }
      );
      const tokens = await runTokenExchangeStage('provider_token_exchange', provider, () =>
        exchangeMicrosoftCodeForTokens(code, config, code_verifier)
      );
      const userInfo = await runTokenExchangeStage('provider_userinfo', provider, () =>
        getMicrosoftUserInfo(tokens.access_token)
      );

      // Normalize Microsoft user info
      return {
        tokens,
        userInfo: {
          id: userInfo.id,
          email: userInfo.mail || userInfo.userPrincipalName,
          name: userInfo.displayName || userInfo.userPrincipalName,
          picture: undefined,
        },
      };
    }
  }
};

/**
 * Exchange authorization code for tokens (called by the client)
 * This is a POST endpoint that completes the OAuth2 flow
 */
export async function exchangeCodeForToken(c: BffContext) {
  let body: unknown;
  try {
    body = await c.req.json<unknown>();
  } catch {
    return c.json(
      { error: 'invalid_request', error_description: 'Token exchange body must be valid JSON' },
      400
    );
  }

  const parsedRequest = parseTokenExchangeRequest(body);
  if (!parsedRequest.ok) {
    return c.json(
      { error: 'invalid_request', error_description: parsedRequest.errorDescription },
      400
    );
  }

  const { code, redirect_uri, provider, code_verifier } = parsedRequest.value;

  if (redirect_uri && !validateRedirectUri(redirect_uri, c)) {
    return c.json(
      {
        error: 'invalid_request',
        error_description: 'Invalid redirect_uri parameter',
      },
      400
    );
  }

  try {
    const env = getEnv(c);

    const { userInfo, tokens } = await getAuthorizationCode({
      provider,
      code,
      code_verifier,
      env,
    });

    // Create session JWT
    const authSessionConfig = await runTokenExchangeStage(
      'session_configuration',
      provider,
      async () => parseAuthSessionConfig(env)
    );
    const sessionDuration = authSessionConfig.durationHours;
    const sessionToken = await runTokenExchangeStage('session_jwt', provider, () =>
      createSessionToken(
        {
          sub: userInfo.id,
          email: userInfo.email,
          name: userInfo.name,
          picture: userInfo.picture,
          provider,
        },
        env.JWT_SECRET,
        sessionDuration,
        env.JWT_ISSUER
      )
    );

    let kvWarning: KvWarning | undefined;
    let responseSessionMode: AuthSessionMode = authSessionConfig.mode;
    let refreshTokenId: string | undefined;
    if (authSessionConfig.mode === 'stateless') {
      responseSessionMode = 'stateless';
    } else if (!env.AUTH_KV) {
      console.error('[auth][token] session persistence degraded', {
        stage: 'session_persistence',
        provider,
        errorType: 'MissingBinding',
      });
      kvWarning = buildKvWarning('login', 'missing_kv', 'none');
      responseSessionMode = 'stateless';
    } else {
      const kvManager = new KVStorageManager(env.AUTH_KV, env.JWT_SECRET);
      try {
        refreshTokenId = await kvManager.storeUserAuth(userInfo.id, {
          email: userInfo.email,
          name: userInfo.name,
          picture: userInfo.picture,
          provider,
          googleRefreshToken: provider === 'google' ? tokens.refresh_token : undefined,
          githubAccessToken: provider === 'github' ? tokens.access_token : undefined,
          microsoftRefreshToken: provider === 'microsoft' ? tokens.refresh_token : undefined,
          sessionToken,
          sessionDuration,
        });
      } catch (error) {
        console.error('[auth][token] session persistence degraded', {
          stage: 'session_persistence',
          provider,
          errorType: error instanceof Error ? error.name : typeof error,
        });
        kvWarning = buildKvWarning('login', 'kv_error', 'none');
        responseSessionMode = 'stateless';
      }
    }

    return c.json({
      access_token: sessionToken,
      token_type: 'Bearer',
      expires_in: sessionDuration * 3600,
      session_mode: responseSessionMode,
      id_token: sessionToken,
      ...(refreshTokenId ? { refresh_token_id: refreshTokenId } : {}),
      scope: 'openid profile email',
      userinfo: {
        sub: userInfo.id,
        email: userInfo.email,
        name: userInfo.name,
        picture: userInfo.picture,
      },
      ...(kvWarning ? { warning: kvWarning } : {}),
    });
  } catch (error) {
    logTokenExchangeFailure(error);
    return c.json(
      {
        error: 'server_error',
        error_description: 'Failed to exchange token',
      },
      500
    );
  }
}
