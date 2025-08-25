/**
 * Simple mock BFF server using Node.js built-in modules
 * No external dependencies required
 */

const http = require('http');
const url = require('url');
const crypto = require('crypto');
const querystring = require('querystring');

const PORT = 8787;

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

// Parse JSON body
function parseBody(req) {
  return new Promise((resolve, reject) => {
    let body = '';
    req.on('data', chunk => {
      body += chunk.toString();
    });
    req.on('end', () => {
      try {
        resolve(body ? JSON.parse(body) : {});
      } catch (e) {
        reject(e);
      }
    });
  });
}

// CORS headers
function setCORSHeaders(res) {
  res.setHeader('Access-Control-Allow-Origin', 'http://localhost:4200');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  res.setHeader('Access-Control-Allow-Credentials', 'true');
}

// Create server
const server = http.createServer(async (req, res) => {
  const parsedUrl = url.parse(req.url, true);
  const pathname = parsedUrl.pathname;
  const query = parsedUrl.query;
  
  // Set CORS headers for all responses
  setCORSHeaders(res);
  
  // Handle preflight requests
  if (req.method === 'OPTIONS') {
    res.writeHead(204);
    res.end();
    return;
  }
  
  console.log(`[Mock BFF] ${req.method} ${pathname}`);
  
  // OAuth2 Authorization endpoint
  if (req.method === 'GET' && pathname.match(/^\/api\/auth\/(\w+)\/authorize$/)) {
    const provider = pathname.split('/')[3];
    const { code_challenge, state, redirect_uri } = query;
    
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
    res.writeHead(302, {
      'Location': callbackUrl.toString()
    });
    res.end();
    return;
  }
  
  // Token exchange endpoint
  if (req.method === 'POST' && pathname === '/api/auth/token') {
    try {
      const body = await parseBody(req);
      const { code, code_verifier, provider, state } = body;
      
      console.log('[Mock BFF] Token exchange request');
      console.log('Code:', code);
      console.log('Provider:', provider);
      
      // Verify PKCE
      const storedData = pkceStore.get(code);
      if (!storedData) {
        res.writeHead(400, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'Invalid authorization code' }));
        return;
      }
      
      // Verify state
      if (storedData.state !== state) {
        res.writeHead(400, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'Invalid state parameter' }));
        return;
      }
      
      // Verify PKCE challenge (simplified - in production, verify properly)
      if (!code_verifier) {
        res.writeHead(400, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'Missing code verifier' }));
        return;
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
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({
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
      }));
    } catch (error) {
      console.error('[Mock BFF] Error:', error);
      res.writeHead(500, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'Internal server error' }));
    }
    return;
  }
  
  // Token refresh endpoint
  if (req.method === 'POST' && pathname === '/api/auth/refresh') {
    try {
      const authHeader = req.headers.authorization;
      const body = await parseBody(req);
      const { refresh_token_id } = body;
      
      console.log('[Mock BFF] Token refresh request');
      
      if (!authHeader || !authHeader.startsWith('Bearer ')) {
        res.writeHead(401, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'Missing authorization header' }));
        return;
      }
      
      const storedToken = tokenStore.get(refresh_token_id);
      if (!storedToken) {
        res.writeHead(401, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'Invalid refresh token' }));
        return;
      }
      
      // Generate new access token
      const newAccessToken = generateMockJWT(storedToken.provider);
      
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({
        access_token: newAccessToken,
        token_type: 'Bearer',
        expires_in: 3600,
        provider: storedToken.provider
      }));
    } catch (error) {
      console.error('[Mock BFF] Error:', error);
      res.writeHead(500, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'Internal server error' }));
    }
    return;
  }
  
  // Token revoke endpoint
  if (req.method === 'POST' && pathname === '/api/auth/revoke') {
    console.log('[Mock BFF] Token revoke request');
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ success: true }));
    return;
  }
  
  // Health check
  if (req.method === 'GET' && pathname === '/api/auth/health') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ status: 'ok', mock: true }));
    return;
  }
  
  // 404 for unknown routes
  res.writeHead(404, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify({ error: 'Not found' }));
});

// Start server
server.listen(PORT, () => {
  console.log(`[Mock BFF] Server running at http://localhost:${PORT}`);
  console.log('[Mock BFF] This is a development mock server');
  console.log('[Mock BFF] OAuth endpoints:');
  console.log(`  - GET  /api/auth/:provider/authorize`);
  console.log(`  - POST /api/auth/token`);
  console.log(`  - POST /api/auth/refresh`);
  console.log(`  - POST /api/auth/revoke`);
  console.log(`  - GET  /api/auth/health`);
});