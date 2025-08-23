/**
 * Map environment variables with BFF_ prefix to their non-prefixed counterparts
 * This allows the codebase to use cleaner variable names while maintaining
 * clear namespace separation in configuration files
 */
export function mapEnvironmentVariables(env: Record<string, any>): Record<string, any> {
  return {
    ...env,
    // Map BFF-prefixed variables to their non-prefixed names
    JWT_ISSUER: env.BFF_JWT_ISSUER || env.JWT_ISSUER,
    SESSION_DURATION_HOURS: env.BFF_SESSION_DURATION_HOURS || env.SESSION_DURATION_HOURS,
    ALLOWED_ORIGINS: env.BFF_ALLOWED_ORIGINS || env.ALLOWED_ORIGINS,
    APP_BASE_URL: env.BFF_APP_BASE_URL || env.APP_BASE_URL,
    REDIRECT_URI: env.BFF_REDIRECT_URI || env.REDIRECT_URI,
    GITHUB_REDIRECT_URI: env.BFF_GITHUB_REDIRECT_URI || env.GITHUB_REDIRECT_URI,
    MICROSOFT_REDIRECT_URI: env.BFF_MICROSOFT_REDIRECT_URI || env.MICROSOFT_REDIRECT_URI,
    STATIC_CALLBACK_PATH: env.BFF_STATIC_CALLBACK_PATH || env.STATIC_CALLBACK_PATH,
    USE_HISTORY_WORKAROUND: env.BFF_USE_HISTORY_WORKAROUND || env.USE_HISTORY_WORKAROUND,

    // Shared variables (no prefix needed)
    GOOGLE_CLIENT_ID: env.GOOGLE_CLIENT_ID,
    GOOGLE_CLIENT_SECRET: env.GOOGLE_CLIENT_SECRET,
    MICROSOFT_CLIENT_ID: env.MICROSOFT_CLIENT_ID,
    MICROSOFT_CLIENT_SECRET: env.MICROSOFT_CLIENT_SECRET,
    GITHUB_CLIENT_ID: env.GITHUB_CLIENT_ID,
    GITHUB_CLIENT_SECRET: env.GITHUB_CLIENT_SECRET,
    JWT_SECRET: env.JWT_SECRET,
  };
}

import { Env } from './types';

// Type definition for the mapped environment
export interface MappedEnv extends Env {
  // BFF-specific variables (mapped from BFF_ prefix)
  JWT_ISSUER: string;
  SESSION_DURATION_HOURS: string;
  ALLOWED_ORIGINS: string;
  APP_BASE_URL?: string;
  REDIRECT_URI: string;
  GITHUB_REDIRECT_URI?: string;
  MICROSOFT_REDIRECT_URI?: string;
  STATIC_CALLBACK_PATH?: string;
  USE_HISTORY_WORKAROUND?: string;

  // Shared OAuth configuration
  GOOGLE_CLIENT_ID: string;
  GOOGLE_CLIENT_SECRET: string;
  MICROSOFT_CLIENT_ID?: string;
  MICROSOFT_CLIENT_SECRET?: string;
  GITHUB_CLIENT_ID?: string;
  GITHUB_CLIENT_SECRET?: string;

  // Shared JWT secret
  JWT_SECRET: string;

  // KV namespace
  AUTH_KV?: KVNamespace;
}
