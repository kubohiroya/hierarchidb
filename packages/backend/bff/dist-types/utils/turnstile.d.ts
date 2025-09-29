import type { Next } from 'hono';
import { type BffContext } from './env.js';
export declare function verifyTurnstileToken(token: string, secretKey: string, remoteIp?: string): Promise<{
    success: boolean;
    error?: string;
}>;
export declare function extractTurnstileToken(c: BffContext): string | null;
export declare function requireTurnstile(c: BffContext, next: Next): Promise<void | (Response & import("hono").TypedResponse<{
    error: string;
    message: string;
}, 400, "json">) | (Response & import("hono").TypedResponse<{
    error: string;
    message: string;
}, 403, "json">)>;
//# sourceMappingURL=turnstile.d.ts.map