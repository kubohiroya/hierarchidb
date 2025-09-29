import { type BffContext } from '../utils/env.js';
/**
 * Handle OAuth2 callback from OAuth providers
 * This receives the authorization code and exchanges it for tokens
 */
export declare function handleOAuth2Callback(c: BffContext): Promise<Response & import("hono").TypedResponse<undefined, 302, "redirect">>;
/**
 * Exchange authorization code for tokens (called by the client)
 * This is a POST endpoint that completes the OAuth2 flow
 */
export declare function exchangeCodeForToken(c: BffContext): Promise<(Response & import("hono").TypedResponse<{
    error: string;
}, 400, "json">) | (Response & import("hono").TypedResponse<{
    access_token: string;
    token_type: string;
    expires_in: number;
    id_token: string;
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
//# sourceMappingURL=callback.d.ts.map