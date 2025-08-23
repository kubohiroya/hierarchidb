# @hierarchidb/cors-proxy

CORS proxy service for hierarchidb - Secure API gateway with multiple authentication methods using Cloudflare Workers.

## Features

- 🔐 **Multiple Authentication Methods**
  - BFF JWT tokens (from @hierarchidb/bff)
  - Google OAuth2 access tokens
  - GitHub OAuth2 access tokens
  - Microsoft OAuth2 access tokens
  - JWKS-based JWT verification (ID tokens)
- 🌐 **CORS Support**
  - Configurable CORS headers
  - Automatic preflight handling
  - Credentials support
- 🛡️ **Security Features**
  - Target URL allowlist
  - Token validation with multiple fallback methods
  - Environment variable prefix mapping
- ⚡ **Performance**
  - Built on Cloudflare Workers edge network
  - Automatic JWKS caching (~10 minutes)
  - Minimal latency overhead

## Setup

### Prerequisites

- Node.js >= 20.0.0
- pnpm >= 9.0.0
- Cloudflare account with Workers enabled
- Authentication provider configuration (at least one)

### Installation

```bash
# Install dependencies
pnpm install

# Copy configuration template
cp wrangler.toml.template wrangler.toml
```

### Configuration

Edit `wrangler.toml`:

```toml
name = "hierarchidb-cors-proxy"
main = "src/openstreetmap-type.ts"
compatibility_date = "2024-12-01"

# Development environment
[env.development]
name = "hierarchidb-cors-proxy-dev"

[env.development.vars]
# Required: Comma-separated list of allowed target URLs
ALLOWED_TARGET_LIST = "https://api.example.com,https://another-api.com"

# BFF JWT verification (recommended)
BFF_JWT_ISSUER = "hierarchidb-bff"

# Google OAuth (optional)
CLIENT_ID = "your-google-client-id"

# Microsoft OAuth (optional)
MICROSOFT_CLIENT_ID = "your-microsoft-client-id"

# GitHub OAuth (optional)
GITHUB_CLIENT_ID = "your-github-client-id"

# JWKS verification for ID tokens (optional)
JWKS_URL = "https://your-auth-provider.com/.well-known/jwks.json"
TOKEN_ISSUER = "https://your-auth-provider.com"
TOKEN_AUD = "your-client-id"

# Production environment
[env.production]
name = "hierarchidb-cors-proxy-prod"

[env.production.vars]
ALLOWED_TARGET_LIST = "https://api.production.com"
BFF_JWT_ISSUER = "hierarchidb-bff-prod"
# ... other production configs
```

### Setting Secrets

```bash
# BFF JWT Secret (if using BFF authentication)
wrangler secret put BFF_JWT_SECRET
# Use the same secret as configured in your BFF service

# For production environment
wrangler secret put BFF_JWT_SECRET --env production
```

## Authentication Methods

The CORS proxy supports multiple authentication methods and will try them in order until one succeeds:

### 1. BFF JWT Tokens (Recommended)

Tokens issued by @hierarchidb/bff service:

```javascript
// Frontend example
const response = await fetch('https://your-cors-proxy.workers.dev/?url=https://api.example.com/data', {
  headers: {
    'Authorization': `Bearer ${bffToken}`
  }
});
```

Configuration required:
- `BFF_JWT_SECRET`: Shared secret with BFF service
- `BFF_JWT_ISSUER`: JWT issuer (e.g., "hierarchidb-bff")

### 2. Google OAuth2 Access Tokens

Direct Google OAuth2 access tokens:

```javascript
// Using Google access token
const response = await fetch('https://your-cors-proxy.workers.dev/?url=https://api.example.com/data', {
  headers: {
    'Authorization': `Bearer ${googleAccessToken}`
  }
});
```

Configuration required:
- `CLIENT_ID`: Your Google OAuth client ID

### 3. Microsoft OAuth2 Access Tokens

Microsoft/Azure AD access tokens:

```javascript
// Using Microsoft access token
const response = await fetch('https://your-cors-proxy.workers.dev/?url=https://api.example.com/data', {
  headers: {
    'Authorization': `Bearer ${microsoftAccessToken}`
  }
});
```

Configuration required:
- `MICROSOFT_CLIENT_ID`: Your Microsoft OAuth client ID

### 4. GitHub OAuth2 Access Tokens

GitHub OAuth2 access tokens:

```javascript
// Using GitHub access token
const response = await fetch('https://your-cors-proxy.workers.dev/?url=https://api.example.com/data', {
  headers: {
    'Authorization': `Bearer ${githubAccessToken}`
  }
});
```

Configuration required:
- `GITHUB_CLIENT_ID`: Your GitHub OAuth client ID

### 5. JWKS-based JWT Verification

For ID tokens from OpenID Connect providers:

```javascript
// Using ID token
const response = await fetch('https://your-cors-proxy.workers.dev/?url=https://api.example.com/data', {
  headers: {
    'Authorization': `Bearer ${idToken}`
  }
});
```

Configuration required:
- `JWKS_URL`: JWKS endpoint URL
- `TOKEN_ISSUER`: Expected token issuer
- `TOKEN_AUD`: Expected audience (client ID)

## Development

```bash
# Start development server
pnpm dev

# The service will be available at http://localhost:8787
```

## Deployment

```bash
# Deploy to development environment
pnpm deploy

# Deploy to production
pnpm deploy:production
```

## API Usage

### Making Proxied Requests

```
GET /?url=<target-url>
Authorization: Bearer <token>
```

Parameters:
- `url` (required): The target URL to proxy the request to

Headers:
- `Authorization` (required): Bearer token for authentication

Example:

```javascript
// Complete example with error handling
async function fetchWithCORS(targetUrl, token) {
  try {
    const proxyUrl = new URL('https://your-cors-proxy.workers.dev/');
    proxyUrl.searchParams.set('url', targetUrl);
    
    const response = await fetch(proxyUrl.toString(), {
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      }
    });
    
    if (!response.ok) {
      if (response.status === 401) {
        throw new Error('Authentication failed - invalid or expired token');
      } else if (response.status === 403) {
        throw new Error('Target URL not allowed');
      }
      throw new Error(`Request failed: ${response.status}`);
    }
    
    return await response.json();
  } catch (error) {
    console.error('CORS proxy request failed:', error);
    throw error;
  }
}

// Usage
const data = await fetchWithCORS(
  'https://api.example.com/users',
  localStorage.getItem('authToken')
);
```

### Response Headers

The proxy automatically adds appropriate CORS headers:
- `Access-Control-Allow-Origin`: Request origin
- `Access-Control-Allow-Methods`: GET, HEAD, OPTIONS
- `Access-Control-Allow-Headers`: Authorization
- `Access-Control-Allow-Credentials`: true
- `Vary`: Origin

## Environment Variables

### Required Variables

| Variable | Description |
|----------|-------------|
| `ALLOWED_TARGET_LIST` | Comma-separated list of allowed target URL prefixes |

### Authentication Variables (at least one required)

| Variable | Description |
|----------|-------------|
| `BFF_JWT_SECRET` | Secret key for BFF JWT verification |
| `BFF_JWT_ISSUER` | Expected JWT issuer for BFF tokens |
| `CLIENT_ID` | Google OAuth client ID |
| `MICROSOFT_CLIENT_ID` | Microsoft OAuth client ID |
| `GITHUB_CLIENT_ID` | GitHub OAuth client ID |
| `JWKS_URL` | JWKS endpoint for JWT verification |
| `TOKEN_ISSUER` | Expected token issuer for JWKS verification |
| `TOKEN_AUD` | Expected audience for JWKS verification |

### Environment Variable Prefixes

The CORS proxy supports prefixed environment variables:

- `CORS_PROXY_ALLOWED_TARGET_LIST` → `ALLOWED_TARGET_LIST`
- `CORS_PROXY_BFF_JWT_SECRET` → `BFF_JWT_SECRET`
- `CORS_PROXY_BFF_JWT_ISSUER` → `BFF_JWT_ISSUER`
- `CORS_PROXY_CLIENT_ID` → `CLIENT_ID`
- `CORS_PROXY_MICROSOFT_CLIENT_ID` → `MICROSOFT_CLIENT_ID`
- `CORS_PROXY_GITHUB_CLIENT_ID` → `GITHUB_CLIENT_ID`

## Security Considerations

1. **Target URL Allowlist**: Always configure `ALLOWED_TARGET_LIST` to restrict which APIs can be accessed
2. **Token Security**: Never expose tokens in URLs or logs
3. **HTTPS Only**: Always use HTTPS in production for both proxy and target URLs
4. **Token Rotation**: Implement token refresh mechanisms in your frontend
5. **Rate Limiting**: Consider implementing rate limiting for production deployments
6. **Monitoring**: Set up logging and monitoring for suspicious activity

## Troubleshooting

### Common Issues

1. **401 Unauthorized - Missing Bearer token**
   - Ensure Authorization header is properly formatted: `Bearer <token>`
   - Check that the token is not expired

2. **401 Unauthorized - Invalid token**
   - Verify the token is valid and not expired
   - Check that the correct authentication method is configured
   - For BFF tokens, ensure `BFF_JWT_SECRET` matches the BFF service

3. **403 Forbidden - Target not allowed**
   - Add the target URL to `ALLOWED_TARGET_LIST`
   - Check that the URL prefix matches exactly

4. **CORS errors in browser**
   - The proxy handles CORS headers automatically
   - Check browser console for specific error messages
   - Ensure credentials are included if needed

5. **Token validation fails for specific provider**
   - Google: Verify `CLIENT_ID` matches your OAuth app
   - Microsoft: Check `MICROSOFT_CLIENT_ID` configuration
   - GitHub: Ensure `GITHUB_CLIENT_ID` is correct
   - JWKS: Verify `JWKS_URL`, `TOKEN_ISSUER`, and `TOKEN_AUD`

### Debug Mode

To debug authentication issues, check the Worker logs:

```bash
# View real-time logs
wrangler tail

# View logs for specific environment
wrangler tail --env production
```

## Performance Tips

1. **Token Caching**: Cache valid tokens in your frontend to reduce validation overhead
2. **Request Batching**: Batch multiple API calls when possible
3. **Edge Locations**: Deploy to Cloudflare Workers for global edge distribution
4. **JWKS Caching**: The proxy automatically caches JWKS keys for ~10 minutes

## Testing

### Test Setup

Install test dependencies:

```bash
pnpm add -D vitest @vitest/ui
```

### Running Tests

#### Integration Tests (Local)

Run against local development server:

```bash
# Start the CORS proxy locally
pnpm dev

# In another terminal, run integration tests
CORS_PROXY_TEST_URL=http://localhost:8788 pnpm test:integration

# With authentication tokens for full testing
CORS_PROXY_TEST_URL=http://localhost:8788 \
TEST_BFF_TOKEN=your-bff-token \
TEST_TARGET_URL=https://jsonplaceholder.typicode.com/posts/1 \
pnpm test:integration
```

#### E2E Tests (Deployed)

Run against deployed Cloudflare Workers:

```bash
# Test staging environment
DEPLOYED_CORS_PROXY_URL=https://hierarchidb-cors-proxy-dev.workers.dev \
TEST_BFF_TOKEN=your-bff-token \
pnpm test:e2e

# Test production environment
DEPLOYED_CORS_PROXY_URL=https://hierarchidb-cors-proxy.workers.dev \
DEPLOYED_BFF_URL=https://hierarchidb-bff.workers.dev \
TEST_BFF_TOKEN=your-bff-token \
pnpm test:e2e
```

### Test Configuration

Add to `package.json`:

```json
{
  "scripts": {
    "test": "vitest",
    "test:integration": "vitest run tests/integration.test.ts",
    "test:e2e": "vitest run tests/e2e.test.ts",
    "test:watch": "vitest watch",
    "test:ui": "vitest --ui"
  }
}
```

### Testing with Different Authentication Methods

#### BFF JWT Token

Generate a test token using the BFF service:

```bash
# See BFF README for token generation
cd ../bff
JWT_SECRET=your-secret node scripts/generate-test-token.js
```

#### Google Access Token

For testing with Google tokens:

```bash
# Use OAuth playground to get a test token
# https://developers.google.com/oauthplayground/

TEST_GOOGLE_TOKEN=ya29.xxx... pnpm test:integration
```

#### GitHub Access Token

For testing with GitHub tokens:

```bash
# Generate a personal access token
# https://github.com/settings/tokens

TEST_GITHUB_TOKEN=ghp_xxx... pnpm test:integration
```

#### Microsoft Access Token

For testing with Microsoft tokens:

```bash
# Use Microsoft Graph Explorer
# https://developer.microsoft.com/en-us/graph/graph-explorer

TEST_MICROSOFT_TOKEN=eyJ0xxx... pnpm test:integration
```

### Continuous Integration

GitHub Actions example (`.github/workflows/test-cors-proxy.yml`):

```yaml
name: Test CORS Proxy

on:
  push:
    paths:
      - 'packages/cors-proxy/**'
  pull_request:
    paths:
      - 'packages/cors-proxy/**'

jobs:
  test:
    runs-on: ubuntu-latest
    
    steps:
      - uses: actions/checkout@v3
      
      - uses: pnpm/action-setup@v2
        with:
          version: 9
      
      - uses: actions/setup-node@v3
        with:
          node-version: '20'
          cache: 'pnpm'
      
      - run: pnpm install
      
      - name: Run Integration Tests
        run: |
          cd packages/cors-proxy
          pnpm test:integration
        env:
          CORS_PROXY_TEST_URL: http://localhost:8788
          TEST_BFF_TOKEN: ${{ secrets.TEST_BFF_TOKEN }}
          
      - name: Run E2E Tests
        if: github.ref == 'refs/heads/main'
        run: |
          cd packages/cors-proxy
          pnpm test:e2e
        env:
          DEPLOYED_CORS_PROXY_URL: ${{ secrets.CORS_PROXY_STAGING_URL }}
          DEPLOYED_BFF_URL: ${{ secrets.BFF_STAGING_URL }}
          TEST_BFF_TOKEN: ${{ secrets.TEST_BFF_TOKEN }}
```

### Testing Allowed URLs

Create a test configuration for allowed URLs:

```toml
# wrangler.test.toml
[env.test]
name = "hierarchidb-cors-proxy-test"

[env.test.vars]
ALLOWED_TARGET_LIST = "https://jsonplaceholder.typicode.com,https://httpbin.org,https://api.github.com"
BFF_JWT_ISSUER = "hierarchidb-bff"
```

Run with test configuration:

```bash
wrangler dev --env test
```

### Mock Server for Testing

For isolated testing, create a mock target server:

```javascript
// tests/mock-server.js
import { createServer } from 'http';

const server = createServer((req, res) => {
  res.writeHead(200, {
    'Content-Type': 'application/json',
    'X-Test-Header': 'test-value'
  });
  
  res.end(JSON.stringify({
    path: req.url,
    method: req.method,
    headers: req.headers
  }));
});

server.listen(3001, () => {
  console.log('Mock server running on http://localhost:3001');
});
```

### Test Coverage

Generate coverage reports:

```bash
pnpm test -- --coverage
```

View coverage in browser:

```bash
pnpm test -- --coverage --ui
```

## License

MIT