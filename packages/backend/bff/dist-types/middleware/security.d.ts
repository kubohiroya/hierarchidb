export interface Env {
    ALLOWED_ORIGINS: string;
    PRODUCTION_ORIGINS?: string;
    STAGING_ORIGINS?: string;
    DEVELOPMENT_ORIGINS?: string;
    ENABLE_RATE_LIMIT?: string;
    RATE_LIMIT_PER_MINUTE?: string;
    ENABLE_AUDIT_LOG?: string;
    LOG_LEVEL?: string;
    ENABLE_SECURITY_HEADERS?: string;
    CSP_REPORT_URI?: string;
    RATE_LIMIT_KV?: KVNamespace;
    AUDIT_LOG_KV?: KVNamespace;
    JWT_EXPIRY_HOURS_PROD?: string;
    JWT_EXPIRY_HOURS_STAGING?: string;
    JWT_EXPIRY_HOURS_DEV?: string;
}
export declare function validateOrigin(request: Request, env: Env): {
    isValid: boolean;
    origin: string | null;
    environment: 'production' | 'staging' | 'development' | 'unknown';
};
export declare function addCorsHeaders(response: Response, origin: string | null, env: Env): Response;
export declare function checkRateLimit(request: Request, env: Env): Promise<{
    allowed: boolean;
    remaining: number;
}>;
export declare function addSecurityHeaders(response: Response, env: Env): Response;
export declare function logAuditEvent(event: {
    type: 'auth_attempt' | 'auth_success' | 'auth_failure' | 'token_refresh' | 'logout';
    userId?: string;
    email?: string;
    provider?: string;
    origin: string | null;
    environment: string;
    ip: string;
    userAgent: string | null;
    error?: string;
}, env: Env): Promise<void>;
export declare function getJwtExpiry(environment: string, env: Env): number;
export declare function handleSecurity(request: Request, env: Env, handler: () => Promise<Response>): Promise<Response>;
//# sourceMappingURL=security.d.ts.map