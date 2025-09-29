/**
 * Map environment variables with CORS_PROXY_ prefix to their non-prefixed counterparts
 * This allows the codebase to use cleaner variable names while maintaining
 * clear namespace separation in configuration files
 */
export declare function mapEnvironmentVariables(env: Record<string, any>): Record<string, any>;
export interface MappedEnv {
    JWKS_URL?: string;
    TOKEN_ISSUER?: string;
    TOKEN_AUD?: string;
    ALLOWED_TARGET_LIST: string;
    CLIENT_ID?: string;
    BFF_JWT_SECRET: string;
    BFF_JWT_ISSUER: string;
    MICROSOFT_CLIENT_ID?: string;
    GITHUB_CLIENT_ID?: string;
}
//# sourceMappingURL=env-mapper.d.ts.map