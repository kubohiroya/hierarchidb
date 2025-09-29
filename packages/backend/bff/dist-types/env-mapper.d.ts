import type { Env } from './types.js';
export type PrefixedEnv = {
    BFF_JWT_ISSUER?: string;
    BFF_SESSION_DURATION_HOURS?: string;
    BFF_ALLOWED_ORIGINS?: string;
    BFF_APP_BASE_URL?: string;
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
    SESSION_DURATION_HOURS: string;
    ALLOWED_ORIGINS: string;
    APP_BASE_URL?: string;
    REDIRECT_URI: string;
    GITHUB_REDIRECT_URI?: string;
    MICROSOFT_REDIRECT_URI?: string;
    STATIC_CALLBACK_PATH?: string;
    USE_HISTORY_WORKAROUND?: string;
}
/**
 * Map environment variables with BFF_ prefix to their non-prefixed counterparts.
 */
export declare function mapEnvironmentVariables(env: RawEnv): MappedEnv;
//# sourceMappingURL=env-mapper.d.ts.map