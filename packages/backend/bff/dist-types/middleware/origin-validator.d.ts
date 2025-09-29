/**
 * Origin validation middleware
 */
import type { Next } from 'hono';
import { type BffContext } from '../utils/env.js';
/**
  * Origin
 * localhost
 * ALLOWED_ORIGINS
  */
export declare function validateOrigin(c: BffContext, next: Next): Promise<void | (Response & import("hono").TypedResponse<{
    error: string;
    message: string;
}, 403, "json">)>;
/**
  * Origin
  */
export declare function requireValidOrigin(paths: string[]): (c: BffContext, next: Next) => Promise<void | (Response & import("hono").TypedResponse<{
    error: string;
    message: string;
}, 403, "json">)>;
//# sourceMappingURL=origin-validator.d.ts.map