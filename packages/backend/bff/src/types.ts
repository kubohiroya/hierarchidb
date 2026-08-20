/**
 * Environment variables for the BFF (Backend for Frontend) service
 * This extends the base Cloudflare Workers environment
 */
export interface Env {
  // OAuth2 Configuration
  GOOGLE_CLIENT_ID: string;
  GOOGLE_CLIENT_SECRET: string;
  GITHUB_CLIENT_ID?: string;
  GITHUB_CLIENT_SECRET?: string;
  MICROSOFT_CLIENT_ID?: string;
  MICROSOFT_CLIENT_SECRET?: string;

  // JWT Configuration
  JWT_SECRET: string;
  JWT_ISSUER?: string;
  AUTH_SESSION_MODE?: string;
  SESSION_DURATION_HOURS?: string;
  ENVIRONMENT?: string;
  NODE_ENV?: string;

  // CORS and App Configuration
  ALLOWED_ORIGINS: string;
  APP_BASE_URL?: string;
  APP_BASE_URLS?: string;
  REDIRECT_URI: string;
  GITHUB_REDIRECT_URI?: string;
  MICROSOFT_REDIRECT_URI?: string;

  // BFF-specific prefixed variables
  BFF_JWT_ISSUER?: string;
  BFF_AUTH_SESSION_MODE?: string;
  BFF_SESSION_DURATION_HOURS?: string;
  BFF_ALLOWED_ORIGINS?: string;
  BFF_APP_BASE_URL?: string;
  BFF_APP_BASE_URLS?: string;
  BFF_REDIRECT_URI?: string;
  BFF_GITHUB_REDIRECT_URI?: string;
  BFF_MICROSOFT_REDIRECT_URI?: string;
  BFF_STATIC_CALLBACK_PATH?: string;
  BFF_USE_HISTORY_WORKAROUND?: string;

  // Cloudflare KV
  AUTH_KV?: KVNamespace;

  // Turnstile / features toggles
  TURNSTILE_SECRET_KEY?: string;
  SKIP_TURNSTILE?: string;

  // Miscellaneous flags
  STATIC_CALLBACK_PATH?: string;
  USE_HISTORY_WORKAROUND?: string;
}
