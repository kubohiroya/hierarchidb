# HierarchiDB BFF Specification

## Architecture Overview

HierarchiDB BFF (Backend for Frontend) is a Cloudflare Workers-based authentication service that implements a **single BFF, multiple frontends** architecture. This design enables centralized authentication management while supporting multiple deployment targets.

```mermaid
graph TB
    subgraph "Frontend Deployments"
        LOCAL["localhost:4200<br/>(Development)"]
        GH["kubohiroya.github.io<br/>(GitHub Pages)"]
        VERCEL["hierarchidb.vercel.app<br/>(Vercel)"]
        NETLIFY["hierarchidb.netlify.app<br/>(Netlify)"]
    end
    
    subgraph "BFF Layer"
        BFF["hierarchidb-bff.kubohiroya.workers.dev<br/>(Cloudflare Worker)"]
        
        subgraph "Security Features"
            CORS["CORS Validation"]
            RATE["Rate Limiting"]
            AUDIT["Audit Logging"]
            CSP["Security Headers"]
        end
    end
    
    subgraph "OAuth Providers"
        GOOGLE["Google OAuth"]
        GITHUB["GitHub OAuth"]
    end
    
    LOCAL --> BFF
    GH --> BFF
    VERCEL --> BFF
    NETLIFY --> BFF
    
    BFF --> CORS
    BFF --> RATE
    BFF --> AUDIT
    BFF --> CSP
    
    BFF --> GOOGLE
    BFF --> GITHUB
```

## Core Features

### 1. Multi-Origin Support

The BFF validates and accepts requests from multiple trusted origins:

- **Development**: `http://localhost:4200`, `http://localhost:5173`
- **Production**: 
  - `https://kubohiroya.github.io`
  - `https://hierarchidb.vercel.app`
  - `https://hierarchidb.netlify.app`

### 2. Environment-Aware Configuration

The BFF automatically detects the request origin and applies appropriate settings:

| Setting | Development | Production |
|---------|-------------|------------|
| Authentication session mode | `stateless` | `persistent` |
| JWT Expiry | 4 hours | 4 hours |
| Rate Limit | 100 req/min | 20 req/min |
| Log Level | debug | warn |
| Security Headers | Basic | Strict |

### 3. Security Layers

#### Origin Validation
- Strict whitelist of allowed origins
- Automatic CORS header configuration
- Request rejection for unauthorized origins

#### Rate Limiting
- Per-IP rate limiting using Cloudflare KV
- Environment-specific limits
- Automatic reset windows (60 seconds)

#### Audit Logging
- Comprehensive logging of authentication events
- Suspicious activity detection
- KV-based log storage with TTL

#### Security Headers
- Content Security Policy (CSP)
- XSS Protection
- Frame Options
- Content Type Options

## OAuth2 Flow Implementation

### Authorization Flow with PKCE

```mermaid
sequenceDiagram
    participant User
    participant Frontend
    participant BFF
    participant OAuth
    
    User->>Frontend: Click Login
    Frontend->>Frontend: Generate PKCE challenge
    Frontend->>BFF: GET /auth/authorize/{provider}
    Note over BFF: Validate origin
    BFF->>BFF: Store state & PKCE
    BFF->>OAuth: Redirect to OAuth provider
    OAuth->>User: Show consent screen
    User->>OAuth: Approve
    OAuth->>BFF: Callback with code
    BFF->>BFF: Validate state
    BFF->>Frontend: Redirect callback with code and state
    Frontend->>BFF: POST /auth/token with code, provider, and PKCE verifier
    BFF->>OAuth: Exchange code for provider token
    OAuth->>BFF: Return access token
    BFF->>OAuth: Request provider user info
    BFF->>BFF: Generate JWT
    BFF->>Frontend: Return session token response
    Frontend->>Frontend: Store JWT
```

### Supported OAuth Providers

#### Google OAuth
- OAuth 2.0 with PKCE support
- Required scopes: `openid`, `profile`, `email`
- Token endpoint: `https://oauth2.googleapis.com/token`
- User info endpoint: `https://www.googleapis.com/oauth2/v2/userinfo`

#### GitHub OAuth
- OAuth 2.0 (no PKCE)
- Required scopes: `user:email`
- Token endpoint: `https://github.com/login/oauth/access_token`
- User info endpoint: `https://api.github.com/user`

## API Endpoints

### Authentication Endpoints

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/auth/authorize/{provider}` | GET | Initiate OAuth flow |
| `/auth/callback` | GET | Validate state and return the authorization code to the frontend callback |
| `/auth/token` | POST | Exchange code for JWT |
| `/auth/userinfo` | GET | Get user information |
| `/auth/verify` | POST | Verify JWT token |
| `/auth/refresh` | POST | Refresh JWT token |
| `/auth/revoke` | POST | Revoke all sessions for the authenticated user |
| `/auth/logout` | POST | Complete local logout and revoke all server-side sessions for the authenticated user |

### Health & Discovery

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/health` | GET | Health check |
| `/.well-known/openid-configuration` | GET | OpenID Connect discovery |

## JWT Token Structure

### Token Claims

```json
{
  "sub": "user-unique-id",
  "email": "user@example.com",
  "name": "User Name",
  "picture": "https://example.com/photo.jpg",
  "provider": "google",
  "iss": "hierarchidb-bff",
  "iat": 1234567890,
  "exp": 1234567890,
  "aud": "hierarchidb"
}
```

### Token Security

- **Signing Algorithm**: HS256
- **Secret Storage**: Cloudflare Secrets
- **Rotation Policy**: Quarterly rotation recommended
- **Expiry**: Required positive integer configuration; checked-in environments use 4 hours
- **Stateless expiry behavior**: Clear the local session and require a new login

## Configuration

### Environment Variables

#### Required Variables

| Variable | Description | Example |
|----------|-------------|---------|
| `GOOGLE_CLIENT_ID` | Google OAuth client ID | `123456.apps.googleusercontent.com` |
| `GOOGLE_CLIENT_SECRET` | Google OAuth client secret | Stored as secret |
| `JWT_SECRET` | JWT signing secret | Generated with `openssl rand -base64 32` |
| `JWT_ISSUER` | JWT issuer identifier | `hierarchidb-bff` |
| `AUTH_SESSION_MODE` | `persistent` or `stateless` authentication mode | `stateless` |
| `SESSION_DURATION_HOURS` | Positive integer JWT lifetime; no implicit default | `4` |
| `ALLOWED_ORIGINS` | Comma-separated allowed origins | `http://localhost:4200,https://kubohiroya.github.io` |

#### Optional Variables

| Variable | Description | Default |
|----------|-------------|---------|
| `GITHUB_CLIENT_ID` | GitHub OAuth client ID | - |
| `GITHUB_CLIENT_SECRET` | GitHub OAuth client secret | - |
| `ENABLE_RATE_LIMIT` | Enable rate limiting | `true` |
| `RATE_LIMIT_PER_MINUTE` | Requests per minute | `30` |
| `ENABLE_AUDIT_LOG` | Enable audit logging | `true` |
| `LOG_LEVEL` | Logging level | `info` |

### KV Namespaces

The current authentication implementation uses one Cloudflare Workers KV binding.

| Namespace | Binding | Purpose |
|-----------|---------|---------|
| Environment-specific authentication namespace | `AUTH_KV` | Encrypted user authentication data and session-token indexes |

`AUTH_SESSION_MODE` explicitly selects the authentication contract. `persistent` requires `AUTH_KV` for
session persistence, token refresh, and server-side revocation. `stateless` does not access `AUTH_KV`,
does not refresh tokens, and requires a new login after the configured JWT lifetime. A missing binding in
`stateless` mode is expected and must not produce a KV warning.

`AUTH_SESSION_MODE` and `SESSION_DURATION_HOURS` are required. Missing values, unknown modes, zero,
negative, fractional, or non-numeric durations are configuration errors rather than defaulted values.

The former `RATE_LIMIT_KV`, `AUDIT_LOG_KV`, and `SESSION_KV` bindings are not used by the current
authentication implementation. Provisioning, verification, rollback, key prefixes, and TTL rules are
defined in [BFF `AUTH_KV` operations](./auth-kv-operations.md).

### Authentication Session Modes

| Configured mode | Login response | Refresh | Revoke/logout | KV warning |
|-----------------|----------------|---------|---------------|------------|
| `persistent` with healthy KV | `session_mode=persistent` and `refresh_token_id` | Rotate the session | Revoke server-side state | No |
| `persistent` with missing/failing KV | Effective `session_mode=stateless` | Unavailable | Local completion | Yes |
| `stateless` | `session_mode=stateless`, no refresh ID | HTTP 401 `reauthentication_required` | Local completion | No |

The UI persists `session_mode`. It never calls `/auth/refresh` for `stateless` sessions and clears the local
session when the JWT expires, after which the user signs in again. The warning dialog is response-driven:
it is shown only for an explicit valid `warning` returned from an unexpectedly degraded `persistent`
operation. It must not claim a fixed Cloudflare quota reset or recovery time.

### `AUTH_KV` Unexpected-Degradation Contract

When `persistent` is configured and the binding is missing or a KV operation fails, the BFF includes this
warning object in the response:

```json
{
  "warning": {
    "code": "kv_unavailable",
    "operation": "refresh",
    "action": "relogin",
    "reason": "missing_kv"
  }
}
```

Allowed values are:

- `operation`: `login | refresh | revoke | logout`
- `action`: `none | relogin`
- `reason`: `missing_kv | kv_error`

| Operation | Available KV in `persistent` | Missing binding or KV failure in `persistent` |
|-----------|------------------------------|-----------------------------------------------|
| Login/token exchange | Persist the session and return `session_mode=persistent` | Return an effective `session_mode=stateless` token without persistence and include an `action=none` warning |
| Refresh | Validate the session and rotate the token | Return HTTP 503 with an `action=relogin` warning; do not issue a token |
| Revoke | Delete the user's server-side sessions | Return local completion with an `action=none` warning |
| Logout | Delete all server-side sessions for the authenticated user | Return local logout completion with an `action=none` warning |

The BFF reports quota exhaustion and other KV operation failures as `reason=kv_error`; it does not infer a
more specific cause. Cloudflare plan limits and reset conditions must be checked in the active Cloudflare
account rather than hard-coded into this specification.

## Security Considerations

### CORS Policy

```typescript
// Allowed origins are strictly validated
const allowedOrigins = [
  "http://localhost:4200",
  "https://kubohiroya.github.io",
  "https://hierarchidb.vercel.app",
  "https://hierarchidb.netlify.app"
];

// Only exact matches are allowed
if (!allowedOrigins.includes(origin)) {
  return new Response("Forbidden", { status: 403 });
}
```

### Content Security Policy

```
default-src 'self';
script-src 'self' 'unsafe-inline' 'unsafe-eval';
style-src 'self' 'unsafe-inline';
img-src 'self' data: https:;
font-src 'self' data:;
connect-src 'self' https://hierarchidb-bff.kubohiroya.workers.dev;
frame-ancestors 'none';
```

### Rate Limiting Strategy

```typescript
// Per-IP rate limiting
const limits = {
  development: { perMinute: 100, perHour: 1000 },
  production: { perMinute: 20, perHour: 300 }
};

// Exponential backoff for repeated failures
if (failureCount > 5) {
  blockDuration = Math.min(3600, 60 * Math.pow(2, failureCount - 5));
}
```

## Error Handling

### Error Response Format

```json
{
  "error": "invalid_request",
  "error_description": "The request is missing a required parameter",
  "error_uri": "https://docs.hierarchidb.com/errors#invalid_request"
}
```

### Token exchange request and diagnostics

`POST /auth/token` requires a non-empty authorization `code` and an explicit
`provider` whose value is `google | github | microsoft`. Missing, empty, or unknown providers are
HTTP 400 `invalid_request`; the BFF does not default them to Google.

Internal token exchange failures return the generic HTTP 500 `server_error` response. Cloudflare
server logs distinguish these stages without logging request credentials or personal data:

- `provider_configuration`
- `provider_token_exchange`
- `provider_userinfo`
- `session_configuration`
- `session_jwt`
- `session_persistence`

Failure log metadata is limited to the stage, provider, error type, provider HTTP status, and a
provider-defined machine-readable error code when available. Logs and client responses must not
include authorization codes, PKCE verifiers, provider access or refresh tokens, OAuth client secrets,
JWTs, email addresses, names, or provider user information.

### Common Error Codes

| Code | Description | HTTP Status |
|------|-------------|-------------|
| `invalid_request` | Missing or invalid parameters | 400 |
| `unauthorized_client` | Client not authorized | 401 |
| `access_denied` | Resource access denied | 403 |
| `unsupported_response_type` | Response type not supported | 400 |
| `invalid_scope` | Invalid scope requested | 400 |
| `server_error` | Internal server error | 500 |
| `temporarily_unavailable` | Service temporarily unavailable | 503 |

## Performance Optimization

### Caching Strategy

- **Static Assets**: Cached at CDN edge (1 hour)
- **User Info**: Cached in KV (5 minutes)
- **OAuth Config**: Cached in memory (1 hour)

### Response Times

| Operation | Target | Maximum |
|-----------|--------|---------|
| Health Check | < 50ms | 100ms |
| OAuth Redirect | < 100ms | 200ms |
| Token Exchange | < 500ms | 1000ms |
| User Info | < 200ms | 500ms |

## Monitoring & Observability

### Metrics to Track

- Authentication success/failure rates
- Average response times
- Rate limit violations
- Origin distribution
- Provider usage distribution

### Logging Levels

| Level | Usage |
|-------|-------|
| `debug` | Detailed debugging information |
| `info` | General informational messages |
| `warn` | Warning messages |
| `error` | Error messages |

### Audit Log Format

```json
{
  "timestamp": "2025-08-25T10:00:00Z",
  "type": "auth_success",
  "userId": "user-123",
  "email": "user@example.com",
  "provider": "google",
  "origin": "https://kubohiroya.github.io",
  "environment": "production",
  "ip": "192.168.1.1",
  "userAgent": "Mozilla/5.0...",
  "level": "info"
}
```

## Testing Strategy

### Unit Tests
- JWT generation and validation
- CORS validation logic
- Rate limiting calculations
- Security header generation

### Integration Tests
- OAuth flow with mock providers
- Token exchange process
- Session management
- Error handling

### E2E Tests
- Complete authentication flow
- Multi-origin support
- Rate limiting behavior
- Security header validation

## Future Enhancements

### Planned Features

1. **Additional OAuth Providers**
   - Microsoft/Azure AD
   - Apple Sign In
   - SAML 2.0 support

2. **Advanced Security**
   - Web Application Firewall (WAF)
   - DDoS protection
   - Behavioral analysis

3. **Performance**
   - Cloudflare Durable Objects for sessions
   - Response caching optimization
   - Geographic routing

4. **Observability**
   - Cloudflare Analytics integration
   - Custom dashboards
   - Real-time alerting
