import { type BffContext } from '../utils/env.js';
/**
 * Refresh token endpoint handler
 */
export declare function refreshToken(c: BffContext): Promise<(Response & import("hono").TypedResponse<{
    error: string;
}, 401, "json">) | (Response & import("hono").TypedResponse<{
    error: string;
}, 503, "json">) | (Response & import("hono").TypedResponse<{
    error: string;
    error_description: string;
}, 403, "json">) | (Response & import("hono").TypedResponse<{
    access_token: string;
    token_type: string;
    expires_in: number;
    id_token: string;
    refresh_token_id: string | undefined;
    scope: string;
    userinfo: {
        sub: string;
        email: string;
        name: string;
        picture: string | undefined;
    };
}, import("hono/utils/http-status").ContentfulStatusCode, "json">) | (Response & import("hono").TypedResponse<{
    error: string;
    error_description: string;
}, 500, "json">)>;
/**
 * Revoke token endpoint
 */
export declare function revokeToken(c: BffContext): Promise<(Response & import("hono").TypedResponse<{
    error: string;
}, 401, "json">) | (Response & import("hono").TypedResponse<{
    error: string;
}, 503, "json">) | (Response & import("hono").TypedResponse<{
    error: string;
}, 404, "json">) | (Response & import("hono").TypedResponse<{
    message: string;
}, import("hono/utils/http-status").ContentfulStatusCode, "json">) | (Response & import("hono").TypedResponse<{
    error: string;
    error_description: string;
}, 500, "json">)>;
//# sourceMappingURL=refresh.d.ts.map