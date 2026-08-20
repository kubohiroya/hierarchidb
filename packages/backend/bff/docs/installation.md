# HierarchiDB BFF Installation Guide

## Prerequisites

Before installing the HierarchiDB BFF, ensure you have:

- Node.js >= 20.0.0
- pnpm >= 9.0.0
- Cloudflare account with Workers enabled
- Google Cloud Platform account (for Google OAuth)
- GitHub account (for GitHub OAuth)
- Repository dependencies installed with `pnpm install` (the BFF package pins the supported `wrangler` CLI)

## Step-by-Step Installation

### Step 1: Clone and Setup Project

```bash
# Clone the repository
git clone https://github.com/kubohiroya/hierarchidb.git
cd hierarchidb

# Install dependencies
pnpm install

# Navigate to BFF package
cd packages/backend/bff
```

### Step 2: Create OAuth Applications

#### Google OAuth Setup

1. **Create Google Cloud Project**
   ```
   1. Go to https://console.cloud.google.com/
   2. Click "Select a project" → "New Project"
   3. Name: "HierarchiDB"
   4. Click "Create"
   ```

2. **Enable Required APIs**
   ```
   1. Go to "APIs & Services" → "Library"
   2. Search and enable:
      - Google+ API
      - Google Identity Toolkit API
   ```

3. **Configure OAuth Consent Screen**
   ```
   1. Go to "APIs & Services" → "OAuth consent screen"
   2. Select "External" user type
   3. Fill in:
      - App name: HierarchiDB
      - User support email: your-email@example.com
      - Authorized domains:
        - kubohiroya.github.io
        - hierarchidb.vercel.app (if using)
        - hierarchidb.netlify.app (if using)
      - Developer contact: your-email@example.com
   4. Add scopes:
      - .../auth/userinfo.email
      - .../auth/userinfo.profile
   ```

4. **Create OAuth 2.0 Client ID**
   ```
   1. Go to "APIs & Services" → "Credentials"
   2. Click "+ Create Credentials" → "OAuth client ID"
   3. Application type: "Web application"
   4. Name: "HierarchiDB Web Client"
   5. Authorized JavaScript origins:
      http://localhost:4200
      http://localhost:5173
      https://kubohiroya.github.io
      https://hierarchidb.vercel.app
      https://hierarchidb.netlify.app
      https://hierarchidb-bff.kubohiroya.workers.dev
   6. Authorized redirect URIs:
      https://hierarchidb-bff.kubohiroya.workers.dev/auth/callback
      https://hierarchidb-bff.kubohiroya.workers.dev/auth/google/callback
      https://hierarchidb-bff-dev.kubohiroya.workers.dev/auth/callback
      http://localhost:4200/auth/callback
   7. Click "Create"
   8. Save the Client ID and Client Secret
   ```

#### GitHub OAuth Setup

1. **Create GitHub OAuth App**
   ```
   1. Go to https://github.com/settings/developers
   2. Click "OAuth Apps" → "New OAuth App"
   3. Fill in:
      - Application name: HierarchiDB
      - Homepage URL: https://kubohiroya.github.io/hierarchidb
      - Authorization callback URL for the production OAuth App:
        https://hierarchidb-bff.kubohiroya.workers.dev/auth/github/callback
      - Authorization callback URL for a separate development OAuth App:
        https://hierarchidb-bff-dev.kubohiroya.workers.dev/auth/github/callback
   4. Click "Register application"
   5. Click "Generate a new client secret"
   6. Save the Client ID and Client Secret
   ```

### Step 3: Configure Wrangler

1. **Select the configuration file**
   ```bash
   # Run all Wrangler commands with this repository-owned configuration.
   export BFF_WRANGLER_CONFIG="wrangler.hierarchidb.toml"
   ```

   Do not copy production namespace IDs into another Cloudflare account. For a separate `persistent`
   deployment, create its own `AUTH_KV` namespace in Step 5 and replace the environment-specific IDs.

2. **Update Client IDs**
   ```bash
   # Edit wrangler.toml
   vi wrangler.toml
   ```

   Update these values:
   ```toml
   GOOGLE_CLIENT_ID = "your-google-client-id.apps.googleusercontent.com"
   GITHUB_CLIENT_ID = "your-github-client-id"
   ```

3. **Select the authentication session mode**

   Both variables are required. The BFF does not infer a mode from the KV binding and does not default an
   invalid duration.

   ```toml
   # Development or operational preparation without KV
   AUTH_SESSION_MODE = "stateless"
   SESSION_DURATION_HOURS = "4"

   # Persistent operation with AUTH_KV
   AUTH_SESSION_MODE = "persistent"
   SESSION_DURATION_HOURS = "4"
   ```

   `stateless` issues a short-lived JWT, never calls KV, never refreshes the token, and requires a new login
   after expiry. This is a supported operating mode and does not show a KV warning. `persistent` requires a
   valid `AUTH_KV` binding and shows a warning if the binding or a KV operation fails.

### Step 4: Set Secrets

```bash
# Set Google Client Secret
wrangler secret put GOOGLE_CLIENT_SECRET
# Paste your Google Client Secret when prompted

# Set GitHub Client Secret
wrangler secret put GITHUB_CLIENT_SECRET
# Paste your GitHub Client Secret when prompted

# Generate and set JWT Secret
# First generate a secure secret:
openssl rand -base64 32
# Then set it:
wrangler secret put JWT_SECRET
# Paste the generated secret when prompted
```

For production environment:
```bash
wrangler secret put GOOGLE_CLIENT_SECRET --env production
wrangler secret put GITHUB_CLIENT_SECRET --env production
wrangler secret put JWT_SECRET --env production
```

### Step 5: Create and Bind `AUTH_KV`

Skip this step for `AUTH_SESSION_MODE=stateless`; that mode must not access KV. For
`AUTH_SESSION_MODE=persistent`, create one normal namespace and one preview namespace with the
repository-pinned Wrangler CLI.

```bash
pnpm exec wrangler kv namespace create AUTH_KV \
  --config "$BFF_WRANGLER_CONFIG" \
  --env production

pnpm exec wrangler kv namespace create AUTH_KV \
  --preview \
  --config "$BFF_WRANGLER_CONFIG" \
  --env production
```

Add the returned IDs to the matching environment. Never reuse the production namespace for development.

```toml
[[env.production.kv_namespaces]]
binding = "AUTH_KV"
id = "<production-namespace-id>"
preview_id = "<preview-namespace-id>"
```

The old `RATE_LIMIT_KV`, `AUDIT_LOG_KV`, and `SESSION_KV` examples do not describe the current
authentication implementation. See [BFF `AUTH_KV` operations](./auth-kv-operations.md) for the data,
failure, verification, and rollback contracts.

### Step 6: Deploy BFF

Use the pinned Wrangler CLI and the explicit configuration path. The interactive deployment script uses the
same explicit session-mode and `AUTH_KV` layout, but the commands below remain the canonical, auditable
deployment path.

```bash
# Deploy to development
pnpm exec wrangler deploy --config "$BFF_WRANGLER_CONFIG" --env development

# Deploy to production
pnpm exec wrangler deploy --config "$BFF_WRANGLER_CONFIG" --env production
```

### Step 7: Update Frontend Configuration

1. **Update environment scripts**

   Edit `scripts/env/development.sh`:
   ```bash
   export VITE_BFF_BASE_URL="https://hierarchidb-bff.kubohiroya.workers.dev"
   export VITE_GOOGLE_CLIENT_ID="your-google-client-id.apps.googleusercontent.com"
   export VITE_GITHUB_CLIENT_ID="your-github-client-id"
   ```

   Edit `scripts/env/production.sh`:
   ```bash
   export VITE_BFF_BASE_URL="https://hierarchidb-bff.kubohiroya.workers.dev"
   export VITE_GOOGLE_CLIENT_ID="your-google-client-id.apps.googleusercontent.com"
   export VITE_GITHUB_CLIENT_ID="your-github-client-id"
   ```

2. **Optional: Use .env.secrets for sensitive values**
   
   Create `app/.env.secrets`:
   ```bash
   VITE_GOOGLE_CLIENT_ID=your-google-client-id.apps.googleusercontent.com
   VITE_GITHUB_CLIENT_ID=your-github-client-id
   ```

### Step 8: Verify Installation

1. **Check BFF health**
   ```bash
   curl https://hierarchidb-bff.kubohiroya.workers.dev/health
   # Expected: {"status":"healthy","environment":"production",...}
   ```

2. **Test OAuth endpoints**
   ```bash
   # Should redirect to Google OAuth
   curl -I https://hierarchidb-bff.kubohiroya.workers.dev/auth/authorize/google
   
   # Should redirect to GitHub OAuth
   curl -I https://hierarchidb-bff.kubohiroya.workers.dev/auth/authorize/github
   ```

3. **Monitor logs**
   ```bash
   wrangler tail
   # Or for specific environment
   wrangler tail --env production
   ```

## Post-Installation

### Testing Authentication Flow

1. **Start development server**
   ```bash
   cd /path/to/hierarchidb
   pnpm dev
   ```

2. **Navigate to application**
   ```
   http://localhost:4200
   ```

3. **Test login**
   - Click "Sign in with Google" or "Sign in with GitHub"
   - Complete OAuth flow
   - Verify successful authentication
   - In `stateless`, verify `session_mode=stateless`, no KV warning appears, and login is required again after
     the four-hour JWT expires
   - In `persistent`, verify `session_mode=persistent` and token refresh succeeds

### Monitoring and Maintenance

1. **View real-time logs**
   ```bash
   wrangler tail --format pretty
   ```

2. **Check KV storage**
   ```bash
   # Confirm the namespace exists in the active Cloudflare account.
   pnpm exec wrangler kv namespace list

   # If an authorized operational check is required, list only user-auth keys.
   pnpm exec wrangler kv key list \
     --binding AUTH_KV \
     --prefix user_auth: \
     --remote \
     --config "$BFF_WRANGLER_CONFIG" \
     --env production
   ```

   Key names contain user IDs, so do not save or share the output. Do not list `session_index:` keys because
   their names contain session tokens.

3. **Update secrets**
   ```bash
   # Rotate JWT secret quarterly
   openssl rand -base64 32
   wrangler secret put JWT_SECRET --env production
   ```

## Troubleshooting

### Common Installation Issues

| Issue | Solution |
|-------|----------|
| "Worker name already exists" | Use a unique name in wrangler.toml or add suffix |
| "Invalid Client ID" | Verify Client ID matches exactly from OAuth provider |
| "Redirect URI mismatch" | Ensure redirect URIs match exactly in OAuth settings |
| "KV namespace not found" | In `persistent`, check that the target environment binds the created namespace as exactly `AUTH_KV` |
| `KV namespace AUTH_KV is not configured` | If KV-free operation is intentional, set `AUTH_SESSION_MODE=stateless`; otherwise bind `AUTH_KV` and keep `persistent` |
| `kv_unavailable` warning | Check Worker logs and Cloudflare KV usage/status; the BFF reports quota and other KV failures as `kv_error` |
| `reauthentication_required` | Expected from `/auth/refresh` in `stateless`; do not refresh and start a new login after JWT expiry |
| "Secret not found" | Re-run `wrangler secret put` for missing secret |

### Debug Commands

```bash
# Check configuration
wrangler config

# List all secrets (names only)
wrangler secret list

# Delete and re-add a secret
wrangler secret delete JWT_SECRET
wrangler secret put JWT_SECRET

# Test locally before deploying
wrangler dev
```

### Getting Help

1. Check the [troubleshooting guide](./troubleshooting.md)
2. Review [GitHub Issues](https://github.com/kubohiroya/hierarchidb/issues)
3. Join the community discussion

## Next Steps

1. Configure environment-specific settings
2. Set up monitoring and alerting
3. Review [security best practices](./security.md)
4. Integrate with your frontend application
5. Set up CI/CD pipeline for automatic deployments
