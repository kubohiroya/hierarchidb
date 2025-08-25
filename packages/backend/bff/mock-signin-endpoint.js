/**
 * Temporary mock endpoint for /api/auth/signin
 * This redirects to the correct OAuth flow
 */

const http = require('http');
const url = require('url');

const PORT = process.env.PORT || 8787;

// CORS headers
function setCORSHeaders(res) {
  res.setHeader('Access-Control-Allow-Origin', 'http://localhost:4200');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  res.setHeader('Access-Control-Allow-Credentials', 'true');
}

const server = http.createServer((req, res) => {
  const parsedUrl = url.parse(req.url, true);
  const pathname = parsedUrl.pathname;
  
  setCORSHeaders(res);
  
  // Handle preflight
  if (req.method === 'OPTIONS') {
    res.writeHead(204);
    res.end();
    return;
  }
  
  console.log(`[Mock] ${req.method} ${pathname}`);
  
  // Handle the incorrect /api/auth/signin endpoint
  if (pathname === '/api/auth/signin' && req.method === 'POST') {
    console.log('[Mock] Received POST to /api/auth/signin - redirecting to OAuth flow');
    
    // Return a redirect response
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({
      redirect_url: '/api/auth/google/authorize',
      message: 'Please use OAuth flow'
    }));
    return;
  }
  
  // Handle the correct OAuth authorize endpoint
  if (pathname.match(/^\/api\/auth\/(\w+)\/authorize$/)) {
    const provider = pathname.split('/')[3];
    console.log(`[Mock] OAuth authorize for ${provider}`);
    
    // Generate mock auth code
    const authCode = 'mock-auth-code-' + Date.now();
    const state = parsedUrl.query.state || 'mock-state';
    
    // Redirect to callback
    const callbackUrl = new URL('http://localhost:4200/auth/callback');
    callbackUrl.searchParams.set('code', authCode);
    callbackUrl.searchParams.set('state', state);
    
    res.writeHead(302, {
      'Location': callbackUrl.toString()
    });
    res.end();
    return;
  }
  
  // Default response
  res.writeHead(404, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify({ error: 'Not found' }));
});

server.listen(PORT, () => {
  console.log(`[Mock BFF] Server running at http://localhost:${PORT}`);
  console.log('[Mock BFF] Handling legacy /api/auth/signin endpoint');
});