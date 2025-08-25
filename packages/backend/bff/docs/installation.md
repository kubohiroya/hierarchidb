# HierarchiDB BFF Installation Guide

## Prerequisites

Before installing the HierarchiDB BFF, ensure you have:

- Node.js >= 20.0.0
- pnpm >= 9.0.0
- Cloudflare account with Workers enabled
- Google Cloud Platform account (for Google OAuth)
- GitHub account (for GitHub OAuth)
- `wrangler` CLI installed (`npm install -g wrangler`)

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
      - Authorization callback URL: 
        https://hierarchidb-bff.kubohiroya.workers.dev/auth/github/callback
   4. Click "Register application"
   5. Click "Generate a new client secret"
   6. Save the Client ID and Client Secret
   ```

### Step 3: Configure Wrangler

1. **Copy configuration file**
   ```bash
   # Use the HierarchiDB-specific config
   cp wrangler.hierarchidb.toml wrangler.toml
   ```

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

### Step 5: Create KV Namespaces (Optional)

KV namespaces provide persistent storage for rate limiting, audit logging, and sessions.

```bash
# Create rate limit namespace
wrangler kv:namespace create "RATE_LIMIT"
# Output: ⚡️ Successfully created KV namespace "RATE_LIMIT" with ID "xxxxx"

# Create audit log namespace
wrangler kv:namespace create "AUDIT_LOG"
# Output: ⚡️ Successfully created KV namespace "AUDIT_LOG" with ID "yyyyy"

# Create session namespace
wrangler kv:namespace create "SESSION"
# Output: ⚡️ Successfully created KV namespace "SESSION" with ID "zzzzz"
```

Add the IDs to your `wrangler.toml`:
```toml
[[kv_namespaces]]
binding = "RATE_LIMIT_KV"
id = "xxxxx"

[[kv_namespaces]]
binding = "AUDIT_LOG_KV"
id = "yyyyy"

[[kv_namespaces]]
binding = "SESSION_KV"
id = "zzzzz"
```

### Step 6: Deploy BFF

#### Using the deployment script (Recommended)

```bash
# Make script executable
chmod +x deploy-hierarchidb.sh

# Run deployment script
./deploy-hierarchidb.sh

# Follow the prompts:
# 1. Select environment (1 for development, 2 for production)
# 2. Confirm checklist items
# 3. Create KV namespaces if needed
# 4. The script will guide you through secret setup
```

#### Manual deployment

```bash
# Deploy to development
wrangler deploy --env development

# Deploy to production
wrangler deploy --env production

# Or deploy without environment (uses default)
wrangler deploy
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
   curl -I https://hierarchidb-bff.kubohiroya.workers.dev/auth/google/authorize
   
   # Should redirect to GitHub OAuth
   curl -I https://hierarchidb-bff.kubohiroya.workers.dev/auth/github/authorize
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

### Monitoring and Maintenance

1. **View real-time logs**
   ```bash
   wrangler tail --format pretty
   ```

2. **Check KV storage**
   ```bash
   # List KV keys
   wrangler kv:key list --namespace-id=xxxxx
   
   # Get specific key value
   wrangler kv:key get "ratelimit:192.168.1.1" --namespace-id=xxxxx
   ```

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
| "KV namespace not found" | Check namespace ID in wrangler.toml matches created ID |
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