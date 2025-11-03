/**
 * Map environment variables with CORS_PROXY_ prefix to their non-prefixed counterparts
 * This allows the codebase to use cleaner variable names while maintaining
 * clear namespace separation in configuration files
 */
const readString = (value: unknown): string | undefined =>
  typeof value === 'string' && value.length > 0 ? value : undefined;

export type RawEnv = Record<string, unknown>;

export function mapEnvironmentVariables(env: RawEnv): MappedEnv {
  return {
    ...env,
    // Map CORS_PROXY-prefixed variables to their non-prefixed names
    JWKS_URL: readString(env.CORS_PROXY_JWKS_URL) ?? readString(env.JWKS_URL),
    TOKEN_ISSUER: readString(env.CORS_PROXY_TOKEN_ISSUER) ?? readString(env.TOKEN_ISSUER),
    TOKEN_AUD: readString(env.CORS_PROXY_TOKEN_AUD) ?? readString(env.TOKEN_AUD),
    ALLOWED_TARGET_LIST:
      readString(env.CORS_PROXY_ALLOWED_TARGET_LIST) ?? readString(env.ALLOWED_TARGET_LIST) ?? '',

    // Shared variables
    CLIENT_ID: readString(env.GOOGLE_CLIENT_ID) ?? readString(env.CLIENT_ID),
    BFF_JWT_SECRET: readString(env.BFF_JWT_SECRET) ?? readString(env.JWT_SECRET) ?? '',
    BFF_JWT_ISSUER: readString(env.BFF_JWT_ISSUER) ?? readString(env.JWT_ISSUER) ?? '',
    MICROSOFT_CLIENT_ID: readString(env.MICROSOFT_CLIENT_ID),
    GITHUB_CLIENT_ID: readString(env.GITHUB_CLIENT_ID),
  } satisfies MappedEnv;
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
