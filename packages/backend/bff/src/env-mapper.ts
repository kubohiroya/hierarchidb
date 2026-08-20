import type { Env } from '~/types';

export type PrefixedEnv = {
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
};

export type AdditionalEnv = {
  AUTH_KV?: KVNamespace;
  ENVIRONMENT?: string;
  NODE_ENV?: string;
  TURNSTILE_SECRET_KEY?: string;
  SKIP_TURNSTILE?: string;
  STATIC_CALLBACK_PATH?: string;
  USE_HISTORY_WORKAROUND?: string;
};

export type RawEnv = Env & PrefixedEnv & AdditionalEnv & Record<string, unknown>;

export interface MappedEnv extends Env, AdditionalEnv {
  JWT_ISSUER: string;
  AUTH_SESSION_MODE?: string;
  SESSION_DURATION_HOURS?: string;
  ALLOWED_ORIGINS: string;
  APP_BASE_URL?: string;
  APP_BASE_URLS?: string;
  REDIRECT_URI: string;
  GITHUB_REDIRECT_URI?: string;
  MICROSOFT_REDIRECT_URI?: string;
  STATIC_CALLBACK_PATH?: string;
  USE_HISTORY_WORKAROUND?: string;
}

/**
 * Map environment variables with BFF_ prefix to their non-prefixed counterparts.
 */
export function mapEnvironmentVariables(env: RawEnv): MappedEnv {
  return {
    ...env,
    JWT_ISSUER: env.BFF_JWT_ISSUER || env.JWT_ISSUER || '',
    AUTH_SESSION_MODE: env.BFF_AUTH_SESSION_MODE ?? env.AUTH_SESSION_MODE,
    SESSION_DURATION_HOURS: env.BFF_SESSION_DURATION_HOURS ?? env.SESSION_DURATION_HOURS,
    ALLOWED_ORIGINS: env.BFF_ALLOWED_ORIGINS || env.ALLOWED_ORIGINS || '',
    APP_BASE_URL: env.BFF_APP_BASE_URL || env.APP_BASE_URL,
    APP_BASE_URLS: env.BFF_APP_BASE_URLS || env.APP_BASE_URLS,
    REDIRECT_URI: env.BFF_REDIRECT_URI || env.REDIRECT_URI || '',
    GITHUB_REDIRECT_URI: env.BFF_GITHUB_REDIRECT_URI || env.GITHUB_REDIRECT_URI,
    MICROSOFT_REDIRECT_URI: env.BFF_MICROSOFT_REDIRECT_URI || env.MICROSOFT_REDIRECT_URI,
    STATIC_CALLBACK_PATH: env.BFF_STATIC_CALLBACK_PATH || env.STATIC_CALLBACK_PATH,
    USE_HISTORY_WORKAROUND: env.BFF_USE_HISTORY_WORKAROUND || env.USE_HISTORY_WORKAROUND,
  } satisfies MappedEnv;
}
