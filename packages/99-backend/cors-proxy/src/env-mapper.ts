/**
 * Map environment variables with CORS_PROXY_ prefix to their non-prefixed counterparts
 * This allows the codebase to use cleaner variable names while maintaining
 * clear namespace separation in configuration files
 */
export function mapEnvironmentVariables(env: Record<string, any>): Record<string, any> {
  return {
    ...env,
    // Map CORS_PROXY-prefixed variables to their non-prefixed names
    JWKS_URL: env.CORS_PROXY_JWKS_URL || env.JWKS_URL,
    TOKEN_ISSUER: env.CORS_PROXY_TOKEN_ISSUER || env.TOKEN_ISSUER,
    TOKEN_AUD: env.CORS_PROXY_TOKEN_AUD || env.TOKEN_AUD,
    ALLOWED_TARGET_LIST: env.CORS_PROXY_ALLOWED_TARGET_LIST || env.ALLOWED_TARGET_LIST,

    // Shared variables
    CLIENT_ID: env.GOOGLE_CLIENT_ID || env.CLIENT_ID, // Maps from GOOGLE_CLIENT_ID
    BFF_JWT_SECRET: env.BFF_JWT_SECRET || env.JWT_SECRET, // Maps from shared JWT_SECRET
    BFF_JWT_ISSUER: env.BFF_JWT_ISSUER || env.JWT_ISSUER,
    MICROSOFT_CLIENT_ID: env.MICROSOFT_CLIENT_ID,
    GITHUB_CLIENT_ID: env.GITHUB_CLIENT_ID,
  };
}

// Type definition for the mapped environment
export interface MappedEnv {
  // CORS Proxy-specific variables (mapped from CORS_PROXY_ prefix)
  JWKS_URL?: string;
  TOKEN_ISSUER?: string;
  TOKEN_AUD?: string;
  ALLOWED_TARGET_LIST: string;

  // Shared variables
  CLIENT_ID?: string; // Google OAuth client ID
  BFF_JWT_SECRET: string; // JWT secret shared with BFF
  BFF_JWT_ISSUER: string;
  MICROSOFT_CLIENT_ID?: string;
  GITHUB_CLIENT_ID?: string;
}
