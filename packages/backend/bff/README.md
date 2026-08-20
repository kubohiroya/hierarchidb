# @hierarchidb/bff

Backend for Frontend (BFF) service for hierarchidb - OAuth2 authentication and session management using Cloudflare Workers.

## Features

- 🔐 **OAuth2 Authentication Support**
  - Google OAuth2 with PKCE
  - GitHub OAuth2
  - Microsoft OAuth2 with PKCE
- 🔑 **Session Management**
  - JWT-based session tokens
  - Explicit `persistent` and `stateless` modes
  - KV-backed token refresh and revocation in `persistent`
  - Short-lived JWT and re-login after expiry in `stateless`
- 🌐 **Standards Compliance**
  - OpenID Connect Discovery endpoint
  - Standard OAuth2 token endpoint
  - CORS support
- 🚀 **Advanced Features**
  - Environment variable prefix mapping
  - Dynamic redirect URI based on request origin
  - Multi-environment support (dev/staging/prod)

## Setup

### Prerequisites

- Node.js >= 20.0.0
- pnpm >= 9.0.0
- Cloudflare account with Workers enabled
- OAuth applications created for providers you want to use

### Installation

```bash
# Install dependencies
pnpm install

# Inspect the repository-owned configuration and replace environment-specific IDs for another account.
pnpm exec wrangler --version
```

Use `wrangler.hierarchidb.toml` for this repository. Do not copy its production namespace IDs into another
Cloudflare account; create and bind account-specific `AUTH_KV` namespaces as described below.

### OAuth Provider Setup

#### Google OAuth

1. Go to [Google Cloud Console](https://console.cloud.google.com)
2. Create a new project or select existing
3. Enable Google+ API
4. Create OAuth 2.0 credentials
5. Add authorized redirect URIs:
   - Development: `http://localhost:8787/auth/callback`
   - Production: `https://your-bff-worker.workers.dev/auth/callback`

#### GitHub OAuth

1. Go to GitHub Settings > Developer settings > OAuth Apps
2. Create a new OAuth App
3. Set Authorization callback URL:
   - Development: `http://localhost:8787/auth/callback`
   - Production: `https://your-bff-worker.workers.dev/auth/callback`

#### Microsoft OAuth

1. Go to [Azure Portal](https://portal.azure.com)
2. Register an application in Azure AD
3. Add redirect URIs:
   - Development: `http://localhost:8787/auth/callback`
   - Production: `https://your-bff-worker.workers.dev/auth/callback`
4. Create a client secret

### Configuration

Edit `wrangler.toml`:

```toml
name = "hierarchidb-bff"
main = "src/index.ts"
compatibility_date = "2025-06-28"

# Development environment
[env.development]
name = "hierarchidb-bff-dev"

[env.development.vars]
GOOGLE_CLIENT_ID = "your-google-client-id"
GITHUB_CLIENT_ID = "your-github-client-id"  # Optional
MICROSOFT_CLIENT_ID = "your-microsoft-client-id"  # Optional
REDIRECT_URI = "http://localhost:8787/auth/callback"
AUTH_SESSION_MODE = "stateless"
SESSION_DURATION_HOURS = "4"
JWT_ISSUER = "hierarchidb-bff"
ALLOWED_ORIGINS = "http://localhost:5173,http://localhost:3000"
APP_BASE_URL = "http://localhost:5173"  # Your frontend URL

# Production environment
[env.production]
name = "hierarchidb-bff-prod"

[env.production.vars]
GOOGLE_CLIENT_ID = "your-google-client-id"
GITHUB_CLIENT_ID = "your-github-client-id"  # Optional
MICROSOFT_CLIENT_ID = "your-microsoft-client-id"  # Optional
REDIRECT_URI = "https://your-bff-worker.workers.dev/auth/callback"
AUTH_SESSION_MODE = "persistent"
SESSION_DURATION_HOURS = "4"
JWT_ISSUER = "hierarchidb-bff"
ALLOWED_ORIGINS = "https://your-app.com"
APP_BASE_URL = "https://your-app.com"

[[env.production.kv_namespaces]]
binding = "AUTH_KV"
id = "your-production-kv-namespace-id"
preview_id = "your-preview-kv-namespace-id"
```

`AUTH_SESSION_MODE` and `SESSION_DURATION_HOURS` are required. `stateless` is the supported KV-free mode:
it issues a four-hour JWT, does not refresh it, and requires login again after expiry without showing a KV
warning. `persistent` requires `AUTH_KV` for refresh and server-side revocation; missing or failing KV in
that mode produces an explicit warning. Follow [BFF `AUTH_KV` operations](./docs/auth-kv-operations.md)
for the complete contract.

### Setting Secrets

```bash
# JWT Secret (required)
wrangler secret put JWT_SECRET
# Generate a strong secret: openssl rand -base64 32

# Google OAuth (required)
wrangler secret put GOOGLE_CLIENT_SECRET

# GitHub OAuth (optional)
wrangler secret put GITHUB_CLIENT_SECRET

# Microsoft OAuth (optional)
wrangler secret put MICROSOFT_CLIENT_SECRET

# For production environment
wrangler secret put JWT_SECRET --env production
wrangler secret put GOOGLE_CLIENT_SECRET --env production
# ... repeat for other secrets
```

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

## API Endpoints

### Health Check
```
GET /
```

### OAuth2 Authorization

Initiate OAuth2 flow:
```
GET /auth/authorize/:provider (google|github|microsoft)
```

Query parameters (optional):
- `code_challenge`: PKCE code challenge
- `code_challenge_method`: Challenge method (default: S256)
- `state`: Client state
- `scope`: OAuth scopes

### OAuth2 Callback

Handle OAuth2 callback (automatically redirects to your app):
```
GET /auth/callback
GET /auth/google/callback
GET /auth/github/callback
GET /auth/microsoft/callback
```

### Token Exchange

Exchange authorization code for tokens:
```
POST /auth/token
POST /auth/google/token
POST /auth/github/token
POST /auth/microsoft/token
```

Request body:
```json
{
  "code": "authorization_code",
  "code_verifier": "pkce_verifier",  // Optional for PKCE
  "redirect_uri": "your_redirect_uri",  // Optional
  "provider": "google"  // or "github", "microsoft"
}
```

Response:
```json
{
  "access_token": "jwt_token",
  "token_type": "Bearer",
  "expires_in": 14400,
  "session_mode": "persistent",
  "refresh_token_id": "opaque-refresh-id",
  "id_token": "jwt_token",
  "scope": "openid profile email",
  "userinfo": {
    "sub": "user_id",
    "email": "user@example.com",
    "name": "User Name",
    "picture": "profile_picture_url"
  }
}
```

### Session Management

Verify session token:
```
POST /auth/verify
Authorization: Bearer <token>
```

Get user information:
```
GET /auth/userinfo
Authorization: Bearer <token>
```

Refresh token:
```
POST /auth/refresh
Authorization: Bearer <token>
```

Revoke token:
```
POST /auth/revoke
Authorization: Bearer <token>
```

Logout:
```
POST /auth/logout
Authorization: Bearer <token>
```

### OpenID Connect Discovery

```
GET /.well-known/openid-configuration
GET /.well-known/openid_configuration
```

## Frontend Integration

### Using Fetch API

```javascript
// Initiate OAuth2 flow
window.location.href = 'https://your-bff-worker.workers.dev/auth/authorize/google';

// Handle callback (in your callback page)
const urlParams = new URLSearchParams(window.location.search);
const code = urlParams.get('code');
const state = urlParams.get('state');

if (code) {
  // Exchange code for token
  const response = await fetch('https://your-bff-worker.workers.dev/auth/token', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      code,
      provider: 'google'
    })
  });
  
  const data = await response.json();
  // Store the access_token
  localStorage.setItem('token', data.access_token);
}

// Use token for authenticated requests
const userResponse = await fetch('https://your-bff-worker.workers.dev/auth/userinfo', {
  headers: {
    'Authorization': `Bearer ${localStorage.getItem('token')}`
  }
});
```

### Using with PKCE

```javascript
// Generate PKCE challenge
async function generatePKCE() {
  const codeVerifier = generateRandomString(128);
  const encoder = new TextEncoder();
  const data = encoder.encode(codeVerifier);
  const digest = await crypto.subtle.digest('SHA-256', data);
  const codeChallenge = btoa(String.fromCharCode(...new Uint8Array(digest)))
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=/g, '');
  
  return { codeVerifier, codeChallenge };
}

// Initiate OAuth2 with PKCE
const { codeVerifier, codeChallenge } = await generatePKCE();
localStorage.setItem('code_verifier', codeVerifier);

const authUrl = new URL('https://your-bff-worker.workers.dev/auth/authorize/google');
authUrl.searchParams.set('code_challenge', codeChallenge);
authUrl.searchParams.set('code_challenge_method', 'S256');
window.location.href = authUrl.toString();

// Exchange code with verifier
const response = await fetch('https://your-bff-worker.workers.dev/auth/token', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
  },
  body: JSON.stringify({
    code,
    code_verifier: localStorage.getItem('code_verifier'),
    provider: 'google'
  })
});
```

## Environment Variables

### Required Variables

| Variable | Description |
|----------|-------------|
| `GOOGLE_CLIENT_ID` | Google OAuth client ID |
| `GOOGLE_CLIENT_SECRET` | Google OAuth client secret (set via wrangler secret) |
| `JWT_SECRET` | Secret key for JWT signing (set via wrangler secret) |
| `JWT_ISSUER` | JWT issuer identifier |
| `AUTH_SESSION_MODE` | Explicit `persistent` or `stateless` session contract |
| `SESSION_DURATION_HOURS` | Positive integer JWT duration in hours; no implicit default |
| `ALLOWED_ORIGINS` | Comma-separated list of allowed CORS origins |
| `REDIRECT_URI` | OAuth redirect URI |

### Optional Variables

| Variable | Description |
|----------|-------------|
| `GITHUB_CLIENT_ID` | GitHub OAuth client ID |
| `GITHUB_CLIENT_SECRET` | GitHub OAuth client secret |
| `MICROSOFT_CLIENT_ID` | Microsoft OAuth client ID |
| `MICROSOFT_CLIENT_SECRET` | Microsoft OAuth client secret |
| `APP_BASE_URL` | Frontend application base URL |

### Cloudflare Bindings

| Binding | Requirement | Description |
|---------|-------------|-------------|
| `AUTH_KV` | Required only when `AUTH_SESSION_MODE=persistent` | Encrypted authentication data and session-token indexes |

### Environment Variable Prefixes

The BFF supports prefixed environment variables for better namespace separation:

- `BFF_JWT_ISSUER` → `JWT_ISSUER`
- `BFF_AUTH_SESSION_MODE` → `AUTH_SESSION_MODE`
- `BFF_SESSION_DURATION_HOURS` → `SESSION_DURATION_HOURS`
- `BFF_ALLOWED_ORIGINS` → `ALLOWED_ORIGINS`
- `BFF_APP_BASE_URL` → `APP_BASE_URL`
- `BFF_REDIRECT_URI` → `REDIRECT_URI`

## Security Considerations

1. **Always use HTTPS in production**
2. **Keep secrets secure** - Never commit secrets to version control
3. **Configure CORS properly** - Only allow trusted origins
4. **Use PKCE for public clients** - Enhances OAuth2 security
5. **Rotate JWT secrets regularly**
6. **Set appropriate session durations**
7. **Implement rate limiting** in production

## Troubleshooting

### Common Issues

1. **CORS errors**
   - Ensure your frontend origin is in `ALLOWED_ORIGINS`
   - Check that the request includes proper headers

2. **OAuth redirect mismatch**
   - Verify redirect URIs match exactly in OAuth provider settings
   - Check environment-specific configurations

3. **Token verification failures**
   - Ensure `JWT_SECRET` is the same across environments
   - Check `JWT_ISSUER` matches between token creation and verification

4. **KV storage not working**
   - Ensure the selected Wrangler environment binds the namespace as exactly `AUTH_KV`
   - Check the namespace ID against `wrangler kv namespace list`
   - Treat `kv_unavailable` as a visible degraded condition and follow the operations guide

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
# Start the BFF service locally
pnpm dev

# In another terminal, run integration tests
BFF_TEST_URL=http://localhost:8787 pnpm test:integration

# With environment variables for full testing
GOOGLE_CLIENT_ID=your-client-id \
TEST_JWT_TOKEN=your-test-token \
pnpm test:integration
```

#### E2E Tests (Deployed)

Run against deployed Cloudflare Workers:

```bash
# Test staging environment
DEPLOYED_BFF_URL=https://hierarchidb-bff-dev.workers.dev \
pnpm test:e2e

# Test production environment
DEPLOYED_BFF_URL=https://hierarchidb-bff.workers.dev \
DEPLOYED_FRONTEND_URL=https://your-app.com \
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

### Generating Test Tokens

For testing authenticated endpoints, generate a test JWT token:

```javascript
// scripts/generate-test-token.js
import jwt from 'jsonwebtoken';

const secret = process.env.JWT_SECRET || 'test-secret';
const issuer = 'hierarchidb-bff';

const token = jwt.sign(
  {
    sub: 'test-user-123',
    email: 'test@example.com',
    name: 'Test User',
    picture: 'https://example.com/photo.jpg',
    provider: 'google'
  },
  secret,
  {
    issuer,
    expiresIn: '24h'
  }
);

console.log('Test Token:', token);
```

Run:
```bash
JWT_SECRET=your-secret node scripts/generate-test-token.js
```

### Continuous Integration

GitHub Actions example (`.github/workflows/test-bff.yml`):

```yaml
name: Test BFF

on:
  push:
    paths:
      - 'packages/bff/**'
  pull_request:
    paths:
      - 'packages/bff/**'

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
          cd packages/bff
          pnpm test:integration
        env:
          BFF_TEST_URL: http://localhost:8787
          
      - name: Run E2E Tests
        if: github.ref == 'refs/heads/main'
        run: |
          cd packages/bff
          pnpm test:e2e
        env:
          DEPLOYED_BFF_URL: ${{ secrets.BFF_STAGING_URL }}
          TEST_BFF_TOKEN: ${{ secrets.TEST_BFF_TOKEN }}
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
