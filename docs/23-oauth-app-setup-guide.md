# OAuth App Setup Guide for HierarchiDB

## Overview

This guide provides step-by-step instructions for setting up OAuth applications for HierarchiDB's authentication system. You'll need to create OAuth apps for both Google and GitHub to enable user authentication.

## Prerequisites

- Google Cloud Platform account (free tier available)
- GitHub account
- Access to Cloudflare dashboard (for BFF deployment)
- `wrangler` CLI installed (`npm install -g wrangler`)

## Google OAuth Setup

### Step 1: Create a Google Cloud Project

1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Click **Select a project** → **New Project**
3. Enter project details:
   - **Project name**: `HierarchiDB`
   - **Organization**: Select your organization or "No organization"
4. Click **Create**

### Step 2: Enable APIs

1. In the project dashboard, go to **APIs & Services** → **Library**
2. Search for and enable:
   - **Google+ API** (for user profile information)
   - **Google Identity Toolkit API** (for OAuth2)

### Step 3: Configure OAuth Consent Screen

1. Go to **APIs & Services** → **OAuth consent screen**
2. Select **External** user type (unless you have Google Workspace)
3. Fill in the application information:
   - **App name**: `HierarchiDB`
   - **User support email**: Your email
   - **App logo**: Upload HierarchiDB logo (optional)
   - **Application home page**: `https://kubohiroya.github.io/hierarchidb`
   - **Application privacy policy**: Link to privacy policy (if available)
   - **Application terms of service**: Link to terms (if available)
   - **Authorized domains**: 
     - `kubohiroya.github.io`
     - `hierarchidb.vercel.app` (if using Vercel)
     - `hierarchidb.netlify.app` (if using Netlify)
   - **Developer contact information**: Your email
4. Click **Save and Continue**

### Step 4: Add Scopes

1. Click **Add or Remove Scopes**
2. Select these scopes:
   - `.../auth/userinfo.email` (View email address)
   - `.../auth/userinfo.profile` (View basic profile info)
3. Click **Update** → **Save and Continue**

### Step 5: Add Test Users (Optional)

1. If in testing mode, add test user emails
2. Click **Save and Continue**

### Step 6: Create OAuth 2.0 Client ID

1. Go to **APIs & Services** → **Credentials**
2. Click **+ Create Credentials** → **OAuth client ID**
3. Select **Web application** as application type
4. Configure the client:
   - **Name**: `HierarchiDB Web Client`
   - **Authorized JavaScript origins**:
     ```
     http://localhost:4200
     http://localhost:5173
     https://kubohiroya.github.io
     https://hierarchidb.vercel.app
     https://hierarchidb.netlify.app
     https://hierarchidb-bff.kubohiroya.workers.dev
     ```
   - **Authorized redirect URIs**:
     ```
     https://hierarchidb-bff.kubohiroya.workers.dev/auth/callback
     https://hierarchidb-bff.kubohiroya.workers.dev/auth/google/callback
     http://localhost:4200/auth/callback
     ```
5. Click **Create**
6. **Save the credentials**:
   - **Client ID**: Copy and save (will be public)
   - **Client Secret**: Copy and save securely (keep private)

## GitHub OAuth Setup

### Step 1: Create a New OAuth App

1. Go to [GitHub Settings](https://github.com/settings/profile)
2. Navigate to **Developer settings** (bottom of left sidebar)
3. Click **OAuth Apps** → **New OAuth App**

### Step 2: Configure the OAuth App

Fill in the application details:

- **Application name**: `HierarchiDB`
- **Homepage URL**: `https://kubohiroya.github.io/hierarchidb`
- **Application description**: `Tree-structured data management framework`
- **Authorization callback URL**: `https://hierarchidb-bff.kubohiroya.workers.dev/auth/github/callback`
- **Enable Device Flow**: Leave unchecked

### Step 3: Register Application

1. Click **Register application**
2. **Save the credentials**:
   - **Client ID**: Copy and save (will be public)
   - Click **Generate a new client secret**
   - **Client Secret**: Copy and save immediately (shown only once)

### Step 4: Configure Additional Settings (Optional)

1. Upload application logo
2. Add badge URL if available
3. Update webhook URL if needed

## BFF Configuration

### Step 1: Update wrangler.toml

Edit `packages/backend/bff/wrangler.hierarchidb.toml`:

```toml
[vars]
# Replace with your actual Client IDs
GOOGLE_CLIENT_ID = "your-google-client-id.apps.googleusercontent.com"
GITHUB_CLIENT_ID = "your-github-client-id"
```

### Step 2: Set Secrets

```bash
cd packages/backend/bff

# Set Google Client Secret
wrangler secret put GOOGLE_CLIENT_SECRET --config wrangler.hierarchidb.toml
# Paste your Google Client Secret when prompted

# Set GitHub Client Secret
wrangler secret put GITHUB_CLIENT_SECRET --config wrangler.hierarchidb.toml
# Paste your GitHub Client Secret when prompted

# Set JWT Secret (generate a secure random string)
wrangler secret put JWT_SECRET --config wrangler.hierarchidb.toml
# Generate with: openssl rand -base64 32
```

### Step 3: Deploy BFF

```bash
# Deploy to production
wrangler deploy --config wrangler.hierarchidb.toml --env production

# Or use the deployment script
./deploy-hierarchidb.sh
```

## Frontend Configuration

### Update Environment Files

#### Development Environment
Edit `scripts/env/development.sh`:
```bash
export VITE_GOOGLE_CLIENT_ID="your-google-client-id.apps.googleusercontent.com"
export VITE_GITHUB_CLIENT_ID="your-github-client-id"
```

#### Production Environment
Edit `scripts/env/production.sh`:
```bash
export VITE_GOOGLE_CLIENT_ID="your-google-client-id.apps.googleusercontent.com"
export VITE_GITHUB_CLIENT_ID="your-github-client-id"
```

### Optional: Use .env.secrets
For better security, create `app/.env.secrets`:
```bash
VITE_GOOGLE_CLIENT_ID=your-google-client-id.apps.googleusercontent.com
VITE_GITHUB_CLIENT_ID=your-github-client-id
```

## Testing OAuth Flow

### Local Development Test

1. Start the development server:
   ```bash
   pnpm dev
   ```

2. Navigate to http://localhost:4200

3. Click "Sign in with Google" or "Sign in with GitHub"

4. Complete the OAuth flow

5. Verify successful authentication:
   - JWT token stored in localStorage
   - User profile displayed
   - Protected routes accessible

### Production Test

1. Build and deploy:
   ```bash
   pnpm build
   gh-pages -d packages/app/dist
   ```

2. Navigate to your production URL

3. Test both OAuth providers

4. Monitor logs:
   ```bash
   wrangler tail --config wrangler.hierarchidb.toml --env production
   ```

## Security Checklist

### Client IDs (Public)
- ✅ Can be exposed in frontend code
- ✅ Add to environment variables for easy management
- ✅ Include in version control (optional)

### Client Secrets (Private)
- ❌ Never commit to version control
- ❌ Never expose in frontend code
- ✅ Store using Cloudflare Secrets
- ✅ Rotate periodically
- ✅ Use different secrets for dev/prod

### Redirect URIs
- ✅ Explicitly list all allowed URIs
- ✅ Use HTTPS for production
- ✅ Include both www and non-www variants if needed
- ❌ Avoid wildcard redirects

### JWT Secrets
- ✅ Generate cryptographically secure random strings
- ✅ Use different secrets for each environment
- ✅ Minimum 256 bits (32 bytes)
- ✅ Rotate periodically

## Troubleshooting

### Common Issues

#### "Redirect URI mismatch" Error
**Problem**: OAuth provider rejects the callback
**Solution**: 
- Verify exact URI match (including trailing slashes)
- Check for http vs https
- Ensure URI is in the allowed list

#### "Invalid Client" Error
**Problem**: Client ID or secret is incorrect
**Solution**:
- Verify Client ID in wrangler.toml
- Re-set Client Secret using wrangler
- Check for extra spaces or newlines

#### CORS Errors
**Problem**: Browser blocks cross-origin requests
**Solution**:
- Verify origin is in BFF's ALLOWED_ORIGINS
- Check BFF deployment status
- Use browser dev tools to inspect headers

#### "User not authenticated" After OAuth
**Problem**: JWT not properly stored or validated
**Solution**:
- Check localStorage for JWT token
- Verify JWT_SECRET is set in BFF
- Check token expiry time

### Debug Commands

```bash
# Check BFF configuration
wrangler config --config wrangler.hierarchidb.toml

# View real-time logs
wrangler tail --config wrangler.hierarchidb.toml --env production

# Test OAuth endpoint
curl https://hierarchidb-bff.kubohiroya.workers.dev/health

# Verify secrets are set (lists names only)
wrangler secret list --config wrangler.hierarchidb.toml
```

## Migration from Existing OAuth Apps

If migrating from another OAuth setup:

### Google OAuth Migration
1. Create new OAuth client (don't modify existing)
2. Add new redirect URIs
3. Update Client ID in code
4. Test thoroughly before removing old client

### GitHub OAuth Migration
1. Create new OAuth app
2. Keep old app during transition
3. Update Client ID and Secret
4. Monitor both apps during migration
5. Delete old app after verification

## Best Practices

### Development Workflow
1. Use separate OAuth apps for dev/staging/prod
2. Implement proper error handling
3. Log authentication events for debugging
4. Test with multiple accounts

### Security
1. Implement PKCE for OAuth 2.0
2. Use state parameter to prevent CSRF
3. Validate JWT signatures
4. Implement token refresh mechanism
5. Set appropriate token expiry times

### Monitoring
1. Track authentication success/failure rates
2. Monitor for suspicious patterns
3. Set up alerts for authentication errors
4. Regular security audits

## Additional Resources

- [Google OAuth 2.0 Documentation](https://developers.google.com/identity/protocols/oauth2)
- [GitHub OAuth Documentation](https://docs.github.com/en/developers/apps/building-oauth-apps)
- [Cloudflare Workers Documentation](https://developers.cloudflare.com/workers/)
- [OAuth 2.0 Security Best Practices](https://datatracker.ietf.org/doc/html/draft-ietf-oauth-security-topics)