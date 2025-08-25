/**
 * Mock BFF server for local development
 * Simulates OAuth2 flow without actual provider integration
 */

const express = require('express');
const cors = require('cors');
const crypto = require('crypto');

const app = express();
const PORT = 8787;

// Middleware
app.use(cors({ origin: 'http://localhost:4200', credentials: true }));
app.use(express.json());

// Store for PKCE verifiers (in production, use KV or Redis)
const pkceStore = new Map();
const tokenStore = new Map();

// Mock JWT token generation
function generateMockJWT(provider = 'google') {
  const header = {
    alg: 'HS256',
    typ: 'JWT'
  };
  
  const payload = {
    sub: 'mock-user-123',
    email: 'test@example.com',
    name: 'Test User',
    picture: 'https://ui-avatars.com/api/?name=Test+User',
    provider: provider,
    iat: Math.floor(Date.now() / 1000),
    exp: Math.floor(Date.now() / 1000) + 3600 // 1 hour
  };
  
  const base64Header = Buffer.from(JSON.stringify(header)).toString('base64url');
  const base64Payload = Buffer.from(JSON.stringify(payload)).toString('base64url');
  const signature = crypto
    .createHmac('sha256', 'mock-secret')
    .update(`${base64Header}.${base64Payload}`)
    .digest('base64url');
  
  return `${base64Header}.${base64Payload}.${signature}`;
}

// OAuth2 Authorization endpoint
app.get('/api/auth/:provider/authorize', (req, res) => {
  const { provider } = req.params;
  const { code_challenge, state, redirect_uri } = req.query;
  
  console.log(`[Mock BFF] Authorization request for ${provider}`);
  console.log('Code challenge:', code_challenge);
  console.log('State:', state);
  
  // Store PKCE challenge
  const authCode = crypto.randomBytes(32).toString('hex');
  pkceStore.set(authCode, {
    challenge: code_challenge,
    provider,
    state
  });
  
  // Simulate OAuth provider redirect
  const callbackUrl = new URL(redirect_uri || 'http://localhost:4200/auth/callback');
  callbackUrl.searchParams.set('code', authCode);
  callbackUrl.searchParams.set('state', state);
  
  // Redirect to callback with authorization code
  res.redirect(callbackUrl.toString());
});

// Token exchange endpoint
app.post('/api/auth/token', (req, res) => {
  const { code, code_verifier, provider, state } = req.body;
  
  console.log('[Mock BFF] Token exchange request');
  console.log('Code:', code);
  console.log('Provider:', provider);
  
  // Verify PKCE
  const storedData = pkceStore.get(code);
  if (!storedData) {
    return res.status(400).json({ error: 'Invalid authorization code' });
  }
  
  // Verify state
  if (storedData.state !== state) {
    return res.status(400).json({ error: 'Invalid state parameter' });
  }
  
  // Verify PKCE challenge (simplified - in production, verify properly)
  // For mock, we'll just check it exists
  if (!code_verifier) {
    return res.status(400).json({ error: 'Missing code verifier' });
  }
  
  // Generate tokens
  const accessToken = generateMockJWT(provider || storedData.provider);
  const refreshTokenId = crypto.randomBytes(32).toString('hex');
  
  // Store refresh token
  tokenStore.set(refreshTokenId, {
    provider: provider || storedData.provider,
    createdAt: Date.now()
  });
  
  // Clean up PKCE store
  pkceStore.delete(code);
  
  // Return tokens
  res.json({
    access_token: accessToken,
    token_type: 'Bearer',
    expires_in: 3600,
    refresh_token_id: refreshTokenId,
    provider: provider || storedData.provider,
    userinfo: {
      sub: 'mock-user-123',
      email: 'test@example.com',
      name: 'Test User',
      picture: 'https://ui-avatars.com/api/?name=Test+User'
    }
  });
});

// Token refresh endpoint
app.post('/api/auth/refresh', (req, res) => {
  const authHeader = req.headers.authorization;
  const { refresh_token_id } = req.body;
  
  console.log('[Mock BFF] Token refresh request');
  
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Missing authorization header' });
  }
  
  const storedToken = tokenStore.get(refresh_token_id);
  if (!storedToken) {
    return res.status(401).json({ error: 'Invalid refresh token' });
  }
  
  // Generate new access token
  const newAccessToken = generateMockJWT(storedToken.provider);
  
  res.json({
    access_token: newAccessToken,
    token_type: 'Bearer',
    expires_in: 3600,
    provider: storedToken.provider
  });
});

// Token revoke endpoint
app.post('/api/auth/revoke', (req, res) => {
  console.log('[Mock BFF] Token revoke request');
  // In production, invalidate the token
  res.json({ success: true });
});

// Health check
app.get('/api/auth/health', (req, res) => {
  res.json({ status: 'ok', mock: true });
});

// Start server
app.listen(PORT, () => {
  console.log(`[Mock BFF] Server running at http://localhost:${PORT}`);
  console.log('[Mock BFF] This is a development mock server');
  console.log('[Mock BFF] OAuth endpoints:');
  console.log(`  - GET  /api/auth/:provider/authorize`);
  console.log(`  - POST /api/auth/token`);
  console.log(`  - POST /api/auth/refresh`);
  console.log(`  - POST /api/auth/revoke`);
});