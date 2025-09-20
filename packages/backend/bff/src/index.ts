/// <reference types="@cloudflare/workers-types" />

import { Context, Hono } from 'hono';
import { getCORSHeaders, parseAllowedOrigins } from './utils/cors.js';
import { createSessionToken, extractBearerToken, verifySessionToken } from './utils/jwt.js';
import {
  exchangeCodeForTokens,
  getGoogleUserInfo,
  type GoogleOAuth2Config,
} from './auth/google.js';
import { type GitHubOAuth2Config } from './auth/github.js';
import { type MicrosoftOAuth2Config } from './auth/microsoft.js';
import { exchangeCodeForToken, handleOAuth2Callback } from './auth/callback.js';
import { refreshToken, revokeToken } from './auth/refresh.js';
import { mapEnvironmentVariables } from './env-mapper.js';
import { getDynamicRedirectUri } from './utils/redirect-uri.js';
import { StateManager } from './utils/state-manager.js';
import { validateOrigin } from './middleware/origin-validator.js';
import { requireTurnstile } from './utils/turnstile.js';
import { getEnv, type BffBindings } from './utils/env.js';

const app = new Hono<BffBindings>();

// Environment mapping middleware
app.use('*', async (c, next) => {
  const mapped = mapEnvironmentVariables(c.env);
  c.set('mappedEnv', mapped);
  await next();
});

// CORS middleware for all requests
app.use('*', async (c, next) => {
  const env = getEnv(c);
  const origin = c.req.header('Origin');
  const allowedOrigins = parseAllowedOrigins(env.ALLOWED_ORIGINS);
  const corsHeaders = getCORSHeaders(origin, { allowedOrigins });

  // Handle preflight OPTIONS requests
  if (c.req.method === 'OPTIONS') {
    return c.text('', 200, corsHeaders);
  }

  await next();

  // Add CORS headers to response
  Object.entries(corsHeaders).forEach(([key, value]) => {
    c.res.headers.set(key, value);
  });

  return;
});

// Origin validation middleware for auth endpoints
app.use('/auth/*', validateOrigin);
app.use('/api/auth/*', validateOrigin);

// Health check endpoint
app.get('/', (c) => {
  return c.json({
    service: 'hierarchidb BFF',
    version: '0.0.1',
    status: 'healthy',
    timestamp: new Date().toISOString(),
  });
});

// ============================================================================
// Google OAuth2 + PKCE Flow
// ============================================================================

// Generic authorize endpoint to reduce namespace collisions:
// /auth/authorize/:provider (google|github|microsoft)
app.get('/auth/authorize/:provider', requireTurnstile, async (c) => {
  try {
    const provider = c.req.param('provider');
    const url = new URL(c.req.url);
    const env = getEnv(c);

    switch (provider) {
      case 'google': {
        const redirectUri = getDynamicRedirectUri(c, 'google');
        const config: GoogleOAuth2Config = {
          clientId: env.GOOGLE_CLIENT_ID,
          clientSecret: env.GOOGLE_CLIENT_SECRET,
          redirectUri,
        };

        const code_challenge = url.searchParams.get('code_challenge');
        const code_challenge_method = url.searchParams.get('code_challenge_method');
        const scope = url.searchParams.get('scope');

        const googleAuthUrl = new URL('https://accounts.google.com/o/oauth2/v2/auth');
        googleAuthUrl.searchParams.set('client_id', config.clientId);
        googleAuthUrl.searchParams.set('redirect_uri', config.redirectUri);
        googleAuthUrl.searchParams.set('response_type', 'code');
        googleAuthUrl.searchParams.set('scope', scope || 'openid profile email');
        // Recreate state using StateManager to ensure integrity
        const stateManager = new StateManager(env.JWT_SECRET || 'default-secret');
        const state = await stateManager.createState(c);
        googleAuthUrl.searchParams.set('state', state);
        if (code_challenge) {
          googleAuthUrl.searchParams.set('code_challenge', code_challenge);
          googleAuthUrl.searchParams.set('code_challenge_method', code_challenge_method || 'S256');
        }
        return c.redirect(googleAuthUrl.toString());
      }
      case 'github': {
        if (!env.GITHUB_CLIENT_ID || !env.GITHUB_CLIENT_SECRET) {
          return c.json({ error: 'GitHub OAuth not configured' }, 501);
        }

        const redirectUri = getDynamicRedirectUri(c, 'github');
        const config: GitHubOAuth2Config = {
          clientId: env.GITHUB_CLIENT_ID,
          clientSecret: env.GITHUB_CLIENT_SECRET,
          redirectUri,
        };

        const client_state = url.searchParams.get('state');
        const scope = url.searchParams.get('scope');

        const stateManager = new StateManager(env.JWT_SECRET || 'default-secret');
        const state = await stateManager.createState(c);

        const githubAuthUrl = new URL('https://github.com/login/oauth/authorize');
        githubAuthUrl.searchParams.set('client_id', config.clientId);
        githubAuthUrl.searchParams.set('redirect_uri', config.redirectUri);
        githubAuthUrl.searchParams.set('response_type', 'code');
        githubAuthUrl.searchParams.set('scope', scope || 'read:user user:email');
        githubAuthUrl.searchParams.set('state', client_state || state);
        return c.redirect(githubAuthUrl.toString());
      }
      case 'microsoft': {
        if (!env.MICROSOFT_CLIENT_ID || !env.MICROSOFT_CLIENT_SECRET) {
          return c.json({ error: 'Microsoft OAuth not configured' }, 501);
        }
        const redirectUri = getDynamicRedirectUri(c, 'microsoft');
        const config: MicrosoftOAuth2Config = {
          clientId: env.MICROSOFT_CLIENT_ID,
          clientSecret: env.MICROSOFT_CLIENT_SECRET,
          redirectUri,
        };
        const code_challenge = url.searchParams.get('code_challenge');
        const code_challenge_method = url.searchParams.get('code_challenge_method');
        const client_state = url.searchParams.get('state');
        const scope = url.searchParams.get('scope');

        const stateManager = new StateManager(env.JWT_SECRET || 'default-secret');
        const state = await stateManager.createState(c);

        const microsoftAuthUrl = new URL('https://login.microsoftonline.com/common/oauth2/v2.0/authorize');
        microsoftAuthUrl.searchParams.set('client_id', config.clientId);
        microsoftAuthUrl.searchParams.set('redirect_uri', config.redirectUri);
        microsoftAuthUrl.searchParams.set('response_type', 'code');
        microsoftAuthUrl.searchParams.set('scope', scope || 'openid profile email User.Read');
        microsoftAuthUrl.searchParams.set('state', client_state || state);
        if (code_challenge) {
          microsoftAuthUrl.searchParams.set('code_challenge', code_challenge);
          microsoftAuthUrl.searchParams.set('code_challenge_method', code_challenge_method || 'S256');
        }
        return c.redirect(microsoftAuthUrl.toString());
      }
      default:
        return c.json({ error: 'Unsupported provider' }, 400);
    }
  } catch (error) {
    console.error('Failed to initiate auth via generic authorize:', error);
    return c.json({ error: 'Failed to initiate authentication' }, 500);
  }
});

// Optional: POST variant returns computed URL/state to clients that want to handle redirects themselves
app.post('/auth/authorize/:provider', async (c) => {
  try {
    const provider = c.req.param('provider');
    const url = new URL(c.req.url);
    const env = getEnv(c);
    switch (provider) {
      case 'google': {
        const redirectUri = getDynamicRedirectUri(c, 'google');
        const config: GoogleOAuth2Config = {
          clientId: env.GOOGLE_CLIENT_ID,
          clientSecret: env.GOOGLE_CLIENT_SECRET,
          redirectUri,
        };
        const stateManager = new StateManager(env.JWT_SECRET || 'default-secret');
        const state = await stateManager.createState(c);
        const code_challenge = url.searchParams.get('code_challenge');
        const code_challenge_method = url.searchParams.get('code_challenge_method') || 'S256';
        const scope = url.searchParams.get('scope') || 'openid profile email';
        const googleAuthUrl = new URL('https://accounts.google.com/o/oauth2/v2/auth');
        googleAuthUrl.searchParams.set('client_id', config.clientId);
        googleAuthUrl.searchParams.set('redirect_uri', config.redirectUri);
        googleAuthUrl.searchParams.set('response_type', 'code');
        googleAuthUrl.searchParams.set('scope', scope);
        googleAuthUrl.searchParams.set('state', state);
        if (code_challenge) {
          googleAuthUrl.searchParams.set('code_challenge', code_challenge);
          googleAuthUrl.searchParams.set('code_challenge_method', code_challenge_method);
        }
        return c.json({ authUrl: googleAuthUrl.toString(), state });
      }
      case 'github': {
        if (!env.GITHUB_CLIENT_ID || !env.GITHUB_CLIENT_SECRET) {
          return c.json({ error: 'GitHub OAuth not configured' }, 501);
        }
        const redirectUri = getDynamicRedirectUri(c, 'github');
        const stateManager = new StateManager(env.JWT_SECRET || 'default-secret');
        const state = await stateManager.createState(c);
        const scope = url.searchParams.get('scope') || 'read:user user:email';
        const githubAuthUrl = new URL('https://github.com/login/oauth/authorize');
        githubAuthUrl.searchParams.set('client_id', env.GITHUB_CLIENT_ID);
        githubAuthUrl.searchParams.set('redirect_uri', redirectUri);
        githubAuthUrl.searchParams.set('response_type', 'code');
        githubAuthUrl.searchParams.set('scope', scope);
        githubAuthUrl.searchParams.set('state', state);
        return c.json({ authUrl: githubAuthUrl.toString(), state });
      }
      case 'microsoft': {
        if (!env.MICROSOFT_CLIENT_ID || !env.MICROSOFT_CLIENT_SECRET) {
          return c.json({ error: 'Microsoft OAuth not configured' }, 501);
        }
        const redirectUri = getDynamicRedirectUri(c, 'microsoft');
        const stateManager = new StateManager(env.JWT_SECRET || 'default-secret');
        const state = await stateManager.createState(c);
        const code_challenge = url.searchParams.get('code_challenge');
        const code_challenge_method = url.searchParams.get('code_challenge_method') || 'S256';
        const scope = url.searchParams.get('scope') || 'openid profile email User.Read';
        const microsoftAuthUrl = new URL('https://login.microsoftonline.com/common/oauth2/v2.0/authorize');
        microsoftAuthUrl.searchParams.set('client_id', env.MICROSOFT_CLIENT_ID);
        microsoftAuthUrl.searchParams.set('redirect_uri', redirectUri);
        microsoftAuthUrl.searchParams.set('response_type', 'code');
        microsoftAuthUrl.searchParams.set('scope', scope);
        microsoftAuthUrl.searchParams.set('state', state);
        if (code_challenge) {
          microsoftAuthUrl.searchParams.set('code_challenge', code_challenge);
          microsoftAuthUrl.searchParams.set('code_challenge_method', code_challenge_method);
        }
        return c.json({ authUrl: microsoftAuthUrl.toString(), state });
      }
      default:
        return c.json({ error: 'Unsupported provider' }, 400);
    }
  } catch (error) {
    console.error('Failed to prepare auth via generic authorize (POST):', error);
    return c.json({ error: 'Failed to initiate authentication' }, 500);
  }
});


// Step 2: Handle OAuth2 callback from Google (GET request)
app.get('/auth/callback', handleOAuth2Callback);
app.get('/auth/google/callback', handleOAuth2Callback);

// Step 3: Token endpoint - Exchange code for tokens (POST request)
app.post('/auth/token', exchangeCodeForToken);
app.post('/auth/google/token', exchangeCodeForToken);

// Legacy callback endpoint for backward compatibility
app.post('/auth/google/callback', async (c) => {
  try {
    const { code, codeVerifier } = await c.req.json();

    if (!code || !codeVerifier) {
      return c.json({ error: 'Missing required parameters' }, 400);
    }

    const config: GoogleOAuth2Config = {
      clientId: c.env.GOOGLE_CLIENT_ID,
      clientSecret: c.env.GOOGLE_CLIENT_SECRET,
      redirectUri: c.env.REDIRECT_URI,
    };

    // Exchange authorization code for tokens
    const tokens = await exchangeCodeForTokens(code, config, codeVerifier);

    // Get user information
    const userInfo = await getGoogleUserInfo(tokens.access_token);

    // Create session JWT
    const sessionDuration = parseInt(c.env.SESSION_DURATION_HOURS || '24');
    const sessionToken = await createSessionToken(
      {
        sub: userInfo.id,
        email: userInfo.email,
        name: userInfo.name,
        picture: userInfo.picture,
        provider: 'google',
      },
      c.env.JWT_SECRET,
      sessionDuration,
      c.env.JWT_ISSUER,
    );

    return c.json({
      sessionToken,
      user: {
        id: userInfo.id,
        email: userInfo.email,
        name: userInfo.name,
        picture: userInfo.picture,
        provider: 'google',
      },
      expiresIn: sessionDuration * 3600, // Convert hours to seconds
    });
  } catch (error) {
    console.error('Failed to process OAuth callback:', error);
    return c.json({ error: 'Authentication failed' }, 401);
  }
});

// ============================================================================
// GitHub OAuth2 Flow
// ============================================================================


// Step 2: Handle OAuth2 callback from GitHub (GET request)
app.get('/auth/github/callback', handleOAuth2Callback);

// Step 3: Token endpoint - Exchange code for tokens (POST request)
app.post('/auth/github/token', exchangeCodeForToken);

// ============================================================================
// Microsoft OAuth2 + PKCE Flow
// ============================================================================


// Step 2: Handle OAuth2 callback from Microsoft (GET request)
app.get('/auth/microsoft/callback', handleOAuth2Callback);

// Step 3: Token endpoint - Exchange code for tokens (POST request)
app.post('/auth/microsoft/token', exchangeCodeForToken);

// ============================================================================
// Session Management
// ============================================================================

// Verify session token
app.post('/auth/verify', async (c) => {
  try {
    const authHeader = c.req.header('Authorization');
    const token = extractBearerToken(authHeader);

    if (!token) {
      return c.json({ error: 'Missing authorization token' }, 401);
    }

    const payload = await verifySessionToken(token, c.env.JWT_SECRET, c.env.JWT_ISSUER);

    return c.json({
      valid: true,
      user: {
        id: payload.sub,
        email: payload.email,
        name: payload.name,
        picture: payload.picture,
        provider: payload.provider,
      },
    });
  } catch (error) {
    console.error('Token verification failed:', error);
    return c.json({ error: 'Invalid token' }, 401);
  }
});

// Get user information from session
app.get('/auth/userinfo', async (c) => {
  try {
    const authHeader = c.req.header('Authorization');
    const token = extractBearerToken(authHeader);

    if (!token) {
      return c.json({ error: 'Missing authorization token' }, 401);
    }

    const payload = await verifySessionToken(token, c.env.JWT_SECRET, c.env.JWT_ISSUER);

    return c.json({
      id: payload.sub,
      email: payload.email,
      name: payload.name,
      picture: payload.picture,
      provider: payload.provider,
    });
  } catch (error) {
    console.error('Failed to get user info:', error);
    return c.json({ error: 'Invalid token' }, 401);
  }
});

// Token refresh endpoint
app.post('/auth/refresh', refreshToken);

// Token revocation endpoint
app.post('/auth/revoke', revokeToken);

// Logout endpoint (invalidate session)
app.post('/auth/logout', async (c) => {
  if (c.env.AUTH_KV) {
    try {
      const authHeader = c.req.header('Authorization');
      const token = extractBearerToken(authHeader);

      if (token) {
        const kvManager = new (await import('./utils/kv-storage.js')).KVStorageManager(
          c.env.AUTH_KV,
          c.env.JWT_SECRET,
        );

        const userData = await kvManager.getUserAuthBySession(token);
        if (userData) {
          await kvManager.revokeUser(userData.userId);
        }
      }
    } catch (error) {
      console.error('Failed to revoke tokens during logout:', error);
    }
  }

  return c.json({ message: 'Logged out successfully' });
});

// ============================================================================
// OpenID Connect Discovery (for provider-oidc-theme compatibility)
// ============================================================================

// OpenID discovery configuration handler
const oidcDiscoveryHandler = (c: Context) => {
  const baseUrl = new URL(c.req.url).origin;

  return c.json({
    issuer: baseUrl,
    authorization_endpoint: `${baseUrl}/auth/authorize`,
    authorization_endpoints: {
      google: `${baseUrl}/auth/authorize/google`,
      github: `${baseUrl}/auth/authorize/github`,
      microsoft: `${baseUrl}/auth/authorize/microsoft`,
    },
    token_endpoint: `${baseUrl}/auth/token`,
    userinfo_endpoint: `${baseUrl}/auth/userinfo`,
    jwks_uri: `${baseUrl}/.well-known/jwks.json`,
    response_types_supported: ['code'],
    grant_types_supported: ['authorization_code'],
    code_challenge_methods_supported: ['S256'],
    scopes_supported: ['openid', 'profile', 'email'],
    claims_supported: ['sub', 'email', 'name', 'picture', 'provider', 'github_username'],
    subject_types_supported: ['public'],
    id_token_signing_alg_values_supported: ['RS256'],
    token_endpoint_auth_methods_supported: ['none'], // Public client with PKCE
    providers_supported: ['google', 'github', 'microsoft'],
  });
};

// Support both with hyphen (standard) and underscore (legacy)
app.get('/.well-known/openid-configuration', oidcDiscoveryHandler);
app.get('/.well-known/openid_configuration', oidcDiscoveryHandler);

export default app;
