#!/bin/bash
# Simple mock BFF server for testing

cat > /tmp/mock-bff.js << 'EOF'
const http = require('http');
const url = require('url');

const PORT = 8787;

const server = http.createServer((req, res) => {
  const parsedUrl = url.parse(req.url, true);
  const pathname = parsedUrl.pathname;
  
  // CORS
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  
  if (req.method === 'OPTIONS') {
    res.writeHead(204);
    res.end();
    return;
  }
  
  console.log(`[Mock BFF] ${req.method} ${pathname}`);
  
  // OAuth authorize
  if (pathname.match(/^\/api\/auth\/\w+\/authorize$/)) {
    const provider = pathname.split('/')[3];
    console.log(`[Mock BFF] OAuth authorize for ${provider}`);
    
    // Redirect to callback
    const callbackUrl = new URL('http://localhost:4200/auth/callback');
    callbackUrl.searchParams.set('code', 'mock-code-123');
    callbackUrl.searchParams.set('state', parsedUrl.query.state || 'mock-state');
    
    res.writeHead(302, { 'Location': callbackUrl.toString() });
    res.end();
    return;
  }
  
  res.writeHead(404);
  res.end('Not found');
});

server.listen(PORT, () => {
  console.log(`[Mock BFF] Server running at http://localhost:${PORT}`);
  console.log('[Mock BFF] Ready to handle OAuth redirects');
});
EOF

echo "Starting mock BFF server on port 8787..."
node /tmp/mock-bff.js