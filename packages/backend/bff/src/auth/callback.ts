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
import { type BffContext, getEnv } from '~/utils/env';
import { createSessionToken } from '~/utils/jwt';
import { KVStorageManager } from '~/utils/kv-storage';
import { buildKvWarning, type KvWarning } from '~/utils/kv-warning';
import { type AuthSessionMode, parseAuthSessionConfig } from '~/utils/parseAuthSessionConfig';
import {
  buildAppCallbackUrl,
  getAppCallbackUrlFromState,
  getDynamicRedirectUri,
  validateRedirectUri,
} from '~/utils/redirect-uri';
import { StateManager } from '~/utils/state-manager';

/**
 * Handle OAuth2 callback from OAuth providers
 * This receives the authorization code and exchanges it for tokens
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

const getAuthorizationCode = async ({
  provider,
  env,
  redirect_uri,
  code,
  code_verifier,
  c,
}: {
  provider: string;
  env: {
    GOOGLE_CLIENT_ID?: string;
    GOOGLE_CLIENT_SECRET?: string;
    GITHUB_CLIENT_ID?: string;
    GITHUB_CLIENT_SECRET?: string;
    MICROSOFT_CLIENT_ID?: string;
    MICROSOFT_CLIENT_SECRET?: string;
  };
  redirect_uri: string;
  code: string;
  code_verifier?: string;
  c: BffContext;
}): Promise<GetAuthorizationCodeReturn> => {
  switch (provider) {
    case 'google': {
      if (!env.GOOGLE_CLIENT_ID || !env.GOOGLE_CLIENT_SECRET) {
        throw new Error('Google OAuth not configured');
      }
      const config: GoogleOAuth2Config = {
        clientId: env.GOOGLE_CLIENT_ID,
        clientSecret: env.GOOGLE_CLIENT_SECRET,
        redirectUri: redirect_uri || getDynamicRedirectUri(c, 'google'),
      };

      const tokens = await exchangeCodeForTokens(code, config, code_verifier);
      const userInfo = await getGoogleUserInfo(tokens.access_token);
      return {
        tokens,
        userInfo,
      };
    }

    case 'github': {
      if (!env.GITHUB_CLIENT_ID || !env.GITHUB_CLIENT_SECRET) {
        throw new Error('GitHub OAuth not configured');
      }

      const config: GitHubOAuth2Config = {
        clientId: env.GITHUB_CLIENT_ID,
        clientSecret: env.GITHUB_CLIENT_SECRET,
        redirectUri: redirect_uri || getDynamicRedirectUri(c, 'github'),
      };

      const tokens = await exchangeGitHubCodeForTokens(code, config);
      const userInfo = await getGitHubUserInfo(tokens.access_token);

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
      if (!env.MICROSOFT_CLIENT_ID || !env.MICROSOFT_CLIENT_SECRET) {
        throw new Error('Microsoft OAuth not configured');
      }

      const config: MicrosoftOAuth2Config = {
        clientId: env.MICROSOFT_CLIENT_ID,
        clientSecret: env.MICROSOFT_CLIENT_SECRET,
        redirectUri: redirect_uri || getDynamicRedirectUri(c, 'microsoft'),
      };

      const tokens = await exchangeMicrosoftCodeForTokens(code, config);
      const userInfo = await getMicrosoftUserInfo(tokens.access_token);

      // Normalize Microsoft user info
      return {
        tokens,
        userInfo: {
          id: userInfo.id,
          email: userInfo.mail ?? undefined,
          name: userInfo.displayName || userInfo.userPrincipalName,
          picture: undefined,
        },
      };
    }

    default:
      throw new Error('Invalid provider');
    //return c.json({ error:  }, 400);
  }
};

/**
 * Exchange authorization code for tokens (called by the client)
 * This is a POST endpoint that completes the OAuth2 flow
 */
export async function exchangeCodeForToken(c: BffContext) {
  try {
    const body = await c.req.json();
    const { code, redirect_uri, provider = 'google', code_verifier } = body;

    if (!code) {
      return c.json({ error: 'Missing authorization code' }, 400);
    }

    //  redirect_uri
    if (redirect_uri && !validateRedirectUri(redirect_uri, c)) {
      console.error(`Invalid redirect_uri received: ${redirect_uri}`);
      return c.json(
        {
          error: 'invalid_request',
          error_description: 'Invalid redirect_uri parameter',
        },
        400
      );
    }

    const env = getEnv(c);

    const effectiveRedirectUri = env.REDIRECT_URI || redirect_uri;

    const { userInfo, tokens } = await getAuthorizationCode({
      provider,
      redirect_uri: effectiveRedirectUri,
      code,
      code_verifier,
      c,
      env,
    });

    // Create session JWT
    const authSessionConfig = parseAuthSessionConfig(env);
    const sessionDuration = authSessionConfig.durationHours;
    const sessionToken = await createSessionToken(
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
    );

    let kvWarning: KvWarning | undefined;
    let responseSessionMode: AuthSessionMode = authSessionConfig.mode;
    let refreshTokenId: string | undefined;
    if (authSessionConfig.mode === 'stateless') {
      responseSessionMode = 'stateless';
    } else if (!env.AUTH_KV) {
      console.error('KV namespace AUTH_KV is not configured');
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
        console.error('Failed to store session in KV:', error);
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
    console.error('Token exchange error:', error);
    return c.json(
      {
        error: 'server_error',
        error_description: 'Failed to exchange token',
      },
      500
    );
  }
}
