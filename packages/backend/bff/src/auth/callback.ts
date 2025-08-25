import { Context } from 'hono';
import { Env } from '../types';
import { exchangeCodeForTokens, getGoogleUserInfo, type GoogleOAuth2Config } from './google';
import {
  exchangeCodeForTokens as exchangeGitHubCodeForTokens,
  getGitHubUserInfo,
  type GitHubOAuth2Config,
} from './github';
import {
  exchangeCodeForTokens as exchangeMicrosoftCodeForTokens,
  getMicrosoftUserInfo,
  type MicrosoftOAuth2Config,
} from './microsoft';
import { createSessionToken } from '../utils/jwt';
import { KVStorageManager } from '../utils/kv-storage';
import { getAppCallbackUrlFromState, getDynamicRedirectUri, validateRedirectUri } from '../utils/redirect-uri';
import { StateManager } from '../utils/state-manager';

/**
 * Handle OAuth2 callback from OAuth providers
 * This receives the authorization code and exchanges it for tokens
 */
export async function handleOAuth2Callback(c: Context<{ Bindings: Env }>) {
  try {
    const url = new URL(c.req.url);
    const code = url.searchParams.get('code');
    const state = url.searchParams.get('state');
    const error = url.searchParams.get('error');

    // State検証（CSRF対策）
    if (state) {
      const env = c.env as any;
      const stateManager = new StateManager(env.JWT_SECRET || 'default-secret');
      const stateData = await stateManager.validateState(state);
      
      if (!stateData) {
        // 無効なstateの場合はエラーを返す
        const appBaseUrl = getAppCallbackUrlFromState(c, state);
        const appCallbackUrl = new URL(`${appBaseUrl}/auth/callback`);
        appCallbackUrl.searchParams.set('error', 'invalid_state');
        appCallbackUrl.searchParams.set('error_description', 'Invalid or expired state parameter');
        return c.redirect(appCallbackUrl.toString());
      }
    }

    // Handle OAuth2 errors
    if (error) {
      const errorDescription = url.searchParams.get('error_description') || 'Authentication failed';

      // Redirect back to src with error
      const appBaseUrl = getAppCallbackUrlFromState(c, state);
      const appCallbackUrl = new URL(`${appBaseUrl}/auth/callback`);
      appCallbackUrl.searchParams.set('error', error);
      appCallbackUrl.searchParams.set('error_description', errorDescription);
      return c.redirect(appCallbackUrl.toString());
    }

    if (!code) {
      // Redirect back to src with error
      const appBaseUrl = getAppCallbackUrlFromState(c, state);
      const appCallbackUrl = new URL(`${appBaseUrl}/auth/callback`);
      appCallbackUrl.searchParams.set('error', 'invalid_request');
      appCallbackUrl.searchParams.set('error_description', 'Authorization code missing');
      return c.redirect(appCallbackUrl.toString());
    }

    // Redirect to src callback with the authorization code
    const appBaseUrl = getAppCallbackUrlFromState(c, state);
    const appCallbackUrl = new URL(`${appBaseUrl}/auth/callback`);
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
    const appBaseUrl = getAppCallbackUrlFromState(c, state);
    const appCallbackUrl = new URL(`${appBaseUrl}/auth/callback`);
    appCallbackUrl.searchParams.set('error', 'server_error');
    appCallbackUrl.searchParams.set('error_description', 'Failed to process authentication');

    return c.redirect(appCallbackUrl.toString());
  }
}

/**
 * Exchange authorization code for tokens (called by the client)
 * This is a POST endpoint that completes the OAuth2 flow
 */
export async function exchangeCodeForToken(
  c: Context<{ Bindings: Env & { AUTH_KV?: KVNamespace } }>
) {
  try {
    const body = await c.req.json();
    const { code, redirect_uri, provider = 'google' } = body;

    if (!code) {
      return c.json({ error: 'Missing authorization code' }, 400);
    }

    // redirect_uriの検証
    if (redirect_uri && !validateRedirectUri(redirect_uri, c)) {
      console.error(`Invalid redirect_uri received: ${redirect_uri}`);
      return c.json({ 
        error: 'invalid_request',
        error_description: 'Invalid redirect_uri parameter' 
      }, 400);
    }

    const env = c.env as any;
    let tokens: any;
    let userInfo: any;

    // Handle different providers
    switch (provider) {
      case 'google': {
        const config: GoogleOAuth2Config = {
          clientId: env.GOOGLE_CLIENT_ID,
          clientSecret: env.GOOGLE_CLIENT_SECRET,
          redirectUri: redirect_uri || getDynamicRedirectUri(c, 'google'),
        };

        tokens = await exchangeCodeForTokens(code, config);
        userInfo = await getGoogleUserInfo(tokens.access_token);
        break;
      }

      case 'github': {
        if (!env.GITHUB_CLIENT_ID || !env.GITHUB_CLIENT_SECRET) {
          return c.json({ error: 'GitHub OAuth not configured' }, 501);
        }

        const config: GitHubOAuth2Config = {
          clientId: env.GITHUB_CLIENT_ID,
          clientSecret: env.GITHUB_CLIENT_SECRET,
          redirectUri: redirect_uri || getDynamicRedirectUri(c, 'github'),
        };

        tokens = await exchangeGitHubCodeForTokens(code, config);
        userInfo = await getGitHubUserInfo(tokens.access_token);

        // Normalize GitHub user info
        userInfo = {
          id: userInfo.id.toString(),
          email: userInfo.email || `${userInfo.login}@users.noreply.github.com`,
          name: userInfo.name || userInfo.login,
          picture: userInfo.avatar_url,
        };
        break;
      }

      case 'microsoft': {
        if (!env.MICROSOFT_CLIENT_ID || !env.MICROSOFT_CLIENT_SECRET) {
          return c.json({ error: 'Microsoft OAuth not configured' }, 501);
        }

        const config: MicrosoftOAuth2Config = {
          clientId: env.MICROSOFT_CLIENT_ID,
          clientSecret: env.MICROSOFT_CLIENT_SECRET,
          redirectUri: redirect_uri || getDynamicRedirectUri(c, 'microsoft'),
        };

        tokens = await exchangeMicrosoftCodeForTokens(code, config);
        userInfo = await getMicrosoftUserInfo(tokens.access_token);

        // Normalize Microsoft user info
        userInfo = {
          id: userInfo.id,
          email: userInfo.mail || userInfo.userPrincipalName,
          name: userInfo.displayName,
          picture: undefined,
        };
        break;
      }

      default:
        return c.json({ error: 'Invalid provider' }, 400);
    }

    // Create session JWT
    const sessionDuration = parseInt(env.SESSION_DURATION_HOURS || '24');
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

    // Store in KV if available
    if (c.env.AUTH_KV) {
      const kvManager = new KVStorageManager(c.env.AUTH_KV, env.JWT_SECRET);
      await kvManager.storeUserAuth(userInfo.id, {
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
    }

    return c.json({
      access_token: sessionToken,
      token_type: 'Bearer',
      expires_in: sessionDuration * 3600,
      id_token: sessionToken,
      scope: 'openid profile email',
      userinfo: {
        sub: userInfo.id,
        email: userInfo.email,
        name: userInfo.name,
        picture: userInfo.picture,
      },
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
