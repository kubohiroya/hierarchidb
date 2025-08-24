/// <reference types="@cloudflare/workers-types" />

import { Hono, Context } from 'hono';
import { Env } from './types';
import { getCORSHeaders, parseAllowedOrigins } from './utils/cors';
import { extractBearerToken, verifySessionToken, createSessionToken } from './utils/jwt';
import {
  initiateGoogleAuth,
  exchangeCodeForTokens,
  getGoogleUserInfo,
  type GoogleOAuth2Config,
} from './auth/google';
import { initiateGitHubAuth, type GitHubOAuth2Config } from './auth/github';
import { initiateMicrosoftAuth, type MicrosoftOAuth2Config } from './auth/microsoft';
import { handleOAuth2Callback, exchangeCodeForToken } from './auth/callback';
import { refreshToken, revokeToken } from './auth/refresh';
import { mapEnvironmentVariables, MappedEnv } from './env-mapper';
import { getDynamicRedirectUri } from './utils/redirect-uri';

const app = new Hono<{ Bindings: Env & { AUTH_KV?: KVNamespace } }>();

// Environment mapping middleware
app.use('*', async (c, next) => {
  // Map prefixed environment variables to non-prefixed names
  c.env = mapEnvironmentVariables(c.env) as MappedEnv;
  await next();
});

// CORS middleware for all requests
app.use('*', async (c, next) => {
  const origin = c.req.header('Origin');
  const allowedOrigins = parseAllowedOrigins(c.env.ALLOWED_ORIGINS);
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

// Step 1: Initiate OAuth2 flow (GET request as per standard OAuth2)
app.get('/auth/google/authorize', async (c) => {
  try {
    // Use dynamic redirect URI based on request origin
    const redirectUri = getDynamicRedirectUri(c, 'google');

    const config: GoogleOAuth2Config = {
      clientId: c.env.GOOGLE_CLIENT_ID,
      clientSecret: c.env.GOOGLE_CLIENT_SECRET,
      redirectUri,
    };

    const { state } = await initiateGoogleAuth(config);

    // For standard OAuth2 flow, redirect to Google's authorization page
    // The client should have sent code_challenge in the request
    const url = new URL(c.req.url);
    const code_challenge = url.searchParams.get('code_challenge');
    const code_challenge_method = url.searchParams.get('code_challenge_method');
    const client_state = url.searchParams.get('state');

    // Build Google OAuth URL with PKCE parameters
    const googleAuthUrl = new URL('https://accounts.google.com/o/oauth2/v2/auth');
    googleAuthUrl.searchParams.set('client_id', config.clientId);
    googleAuthUrl.searchParams.set('redirect_uri', config.redirectUri); // Always use BFF's redirect URI
    googleAuthUrl.searchParams.set('response_type', 'code');
    googleAuthUrl.searchParams.set(
      'scope',
      url.searchParams.get('scope') || 'openid profile email'
    );
    googleAuthUrl.searchParams.set('state', client_state || state);

    // Add PKCE parameters if provided
    if (code_challenge) {
      googleAuthUrl.searchParams.set('code_challenge', code_challenge);
      googleAuthUrl.searchParams.set('code_challenge_method', code_challenge_method || 'S256');
    }

    // Redirect to Google's OAuth page
    return c.redirect(googleAuthUrl.toString());
  } catch (error) {
    console.error('Failed to initiate Google auth:', error);
    return c.json({ error: 'Failed to initiate authentication' }, 500);
  }
});

// Also support POST for backward compatibility
app.post('/auth/google/authorize', async (c) => {
  try {
    // Use dynamic redirect URI based on request origin
    const redirectUri = getDynamicRedirectUri(c, 'google');

    const config: GoogleOAuth2Config = {
      clientId: c.env.GOOGLE_CLIENT_ID,
      clientSecret: c.env.GOOGLE_CLIENT_SECRET,
      redirectUri,
    };

    const { authUrl, codeVerifier, state } = await initiateGoogleAuth(config);

    // Store code verifier and state temporarily (in a real implementation,
    // you might want to use KV storage or encrypt and return to client)
    return c.json({
      authUrl,
      codeVerifier, // Client will store this temporarily
      state,
    });
  } catch (error) {
    console.error('Failed to initiate Google auth:', error);
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
      c.env.JWT_ISSUER
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

// Step 1: Initiate OAuth2 flow (GET request as per standard OAuth2)
app.get('/auth/github/authorize', async (c) => {
  try {
    if (!c.env.GITHUB_CLIENT_ID || !c.env.GITHUB_CLIENT_SECRET) {
      return c.json({ error: 'GitHub OAuth not configured' }, 501);
    }

    // Use dynamic redirect URI based on request origin
    const redirectUri = getDynamicRedirectUri(c, 'github');

    const config: GitHubOAuth2Config = {
      clientId: c.env.GITHUB_CLIENT_ID,
      clientSecret: c.env.GITHUB_CLIENT_SECRET,
      redirectUri,
    };

    const { state } = await initiateGitHubAuth(config);

    // For standard OAuth2 flow, redirect to GitHub's authorization page
    const url = new URL(c.req.url);
    const client_state = url.searchParams.get('state');
    const scope = url.searchParams.get('scope');

    // Build GitHub OAuth URL
    const githubAuthUrl = new URL('https://github.com/login/oauth/authorize');
    githubAuthUrl.searchParams.set('client_id', config.clientId);
    githubAuthUrl.searchParams.set('redirect_uri', config.redirectUri); // Always use BFF's redirect URI
    githubAuthUrl.searchParams.set('response_type', 'code');
    githubAuthUrl.searchParams.set('scope', scope || 'read:user user:email');
    githubAuthUrl.searchParams.set('state', client_state || state);

    // Redirect to GitHub's OAuth page
    return c.redirect(githubAuthUrl.toString());
  } catch (error) {
    console.error('Failed to initiate GitHub auth:', error);
    return c.json({ error: 'Failed to initiate authentication' }, 500);
  }
});

// Also support POST for backward compatibility
app.post('/auth/github/authorize', async (c) => {
  try {
    if (!c.env.GITHUB_CLIENT_ID || !c.env.GITHUB_CLIENT_SECRET) {
      return c.json({ error: 'GitHub OAuth not configured' }, 501);
    }

    // Use dynamic redirect URI based on request origin
    const redirectUri = getDynamicRedirectUri(c, 'github');

    const config: GitHubOAuth2Config = {
      clientId: c.env.GITHUB_CLIENT_ID,
      clientSecret: c.env.GITHUB_CLIENT_SECRET,
      redirectUri,
    };

    const { authUrl, codeVerifier, state } = await initiateGitHubAuth(config);

    // Return auth URL and state for client to handle
    return c.json({
      authUrl,
      codeVerifier, // Client will store this temporarily
      state,
    });
  } catch (error) {
    console.error('Failed to initiate GitHub auth:', error);
    return c.json({ error: 'Failed to initiate authentication' }, 500);
  }
});

// Step 2: Handle OAuth2 callback from GitHub (GET request)
app.get('/auth/github/callback', handleOAuth2Callback);

// Step 3: Token endpoint - Exchange code for tokens (POST request)
app.post('/auth/github/token', exchangeCodeForToken);

// ============================================================================
// Microsoft OAuth2 + PKCE Flow
// ============================================================================

// Step 1: Initiate OAuth2 flow (GET request as per standard OAuth2)
app.get('/auth/microsoft/authorize', async (c) => {
  try {
    if (!c.env.MICROSOFT_CLIENT_ID || !c.env.MICROSOFT_CLIENT_SECRET) {
      return c.json({ error: 'Microsoft OAuth not configured' }, 501);
    }

    // Use dynamic redirect URI based on request origin
    const redirectUri = getDynamicRedirectUri(c, 'microsoft');

    const config: MicrosoftOAuth2Config = {
      clientId: c.env.MICROSOFT_CLIENT_ID,
      clientSecret: c.env.MICROSOFT_CLIENT_SECRET,
      redirectUri,
    };

    const { state } = await initiateMicrosoftAuth(config);

    // For standard OAuth2 flow, redirect to Microsoft's authorization page
    const url = new URL(c.req.url);
    const code_challenge = url.searchParams.get('code_challenge');
    const code_challenge_method = url.searchParams.get('code_challenge_method');
    const client_state = url.searchParams.get('state');
    const scope = url.searchParams.get('scope');

    // Build Microsoft OAuth URL with PKCE parameters
    const microsoftAuthUrl = new URL(
      'https://login.microsoftonline.com/common/oauth2/v2.0/authorize'
    );
    microsoftAuthUrl.searchParams.set('client_id', config.clientId);
    microsoftAuthUrl.searchParams.set('redirect_uri', config.redirectUri);
    microsoftAuthUrl.searchParams.set('response_type', 'code');
    microsoftAuthUrl.searchParams.set('scope', scope || 'openid profile email User.Read');
    microsoftAuthUrl.searchParams.set('state', client_state || state);

    // Add PKCE parameters if provided
    if (code_challenge) {
      microsoftAuthUrl.searchParams.set('code_challenge', code_challenge);
      microsoftAuthUrl.searchParams.set('code_challenge_method', code_challenge_method || 'S256');
    }

    // Redirect to Microsoft's OAuth page
    return c.redirect(microsoftAuthUrl.toString());
  } catch (error) {
    console.error('Failed to initiate Microsoft auth:', error);
    return c.json({ error: 'Failed to initiate authentication' }, 500);
  }
});

// Also support POST for backward compatibility
app.post('/auth/microsoft/authorize', async (c) => {
  try {
    if (!c.env.MICROSOFT_CLIENT_ID || !c.env.MICROSOFT_CLIENT_SECRET) {
      return c.json({ error: 'Microsoft OAuth not configured' }, 501);
    }

    // Use dynamic redirect URI based on request origin
    const redirectUri = getDynamicRedirectUri(c, 'microsoft');

    const config: MicrosoftOAuth2Config = {
      clientId: c.env.MICROSOFT_CLIENT_ID,
      clientSecret: c.env.MICROSOFT_CLIENT_SECRET,
      redirectUri,
    };

    const { authUrl, codeVerifier, state } = await initiateMicrosoftAuth(config);

    // Return auth URL and state for client to handle
    return c.json({
      authUrl,
      codeVerifier, // Client will store this temporarily
      state,
    });
  } catch (error) {
    console.error('Failed to initiate Microsoft auth:', error);
    return c.json({ error: 'Failed to initiate authentication' }, 500);
  }
});

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
        const kvManager = new (await import('./utils/kv-storage')).KVStorageManager(
          c.env.AUTH_KV,
          c.env.JWT_SECRET
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
// OpenID Connect Discovery (for react-oidc-theme compatibility)
// ============================================================================

// OpenID discovery configuration handler
const oidcDiscoveryHandler = (c: Context) => {
  const baseUrl = new URL(c.req.url).origin;

  return c.json({
    issuer: baseUrl,
    authorization_endpoint: `${baseUrl}/auth/authorize`,
    authorization_endpoints: {
      google: `${baseUrl}/auth/google/authorize`,
      github: `${baseUrl}/auth/github/authorize`,
      microsoft: `${baseUrl}/auth/microsoft/authorize`,
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
