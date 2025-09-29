/**
 * Environment variables for the BFF (Backend for Frontend) service
 * This extends the base Cloudflare Workers environment
 */
export interface Env {
    GOOGLE_CLIENT_ID: string;
    GOOGLE_CLIENT_SECRET: string;
    GITHUB_CLIENT_ID?: string;
    GITHUB_CLIENT_SECRET?: string;
    MICROSOFT_CLIENT_ID?: string;
    MICROSOFT_CLIENT_SECRET?: string;
    JWT_SECRET: string;
    JWT_ISSUER?: string;
    SESSION_DURATION_HOURS?: string;
    ENVIRONMENT?: string;
    NODE_ENV?: string;
    ALLOWED_ORIGINS: string;
    APP_BASE_URL?: string;
    REDIRECT_URI: string;
    GITHUB_REDIRECT_URI?: string;
    MICROSOFT_REDIRECT_URI?: string;
    BFF_JWT_ISSUER?: string;
    BFF_SESSION_DURATION_HOURS?: string;
    BFF_ALLOWED_ORIGINS?: string;
    BFF_APP_BASE_URL?: string;
    BFF_REDIRECT_URI?: string;
    BFF_GITHUB_REDIRECT_URI?: string;
    BFF_MICROSOFT_REDIRECT_URI?: string;
    BFF_STATIC_CALLBACK_PATH?: string;
    BFF_USE_HISTORY_WORKAROUND?: string;
    AUTH_KV?: KVNamespace;
    TURNSTILE_SECRET_KEY?: string;
    SKIP_TURNSTILE?: string;
    STATIC_CALLBACK_PATH?: string;
    USE_HISTORY_WORKAROUND?: string;
}
//# sourceMappingURL=types.d.ts.map