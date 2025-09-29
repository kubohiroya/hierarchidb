/**
 * Dynamic redirect URI utilities
 */
import { type BffContext } from './env.js';
/**
 * Gets dynamic redirect URI based on request origin
 */
export declare function getDynamicRedirectUri(c: BffContext, provider?: string): string;
/**
 * Gets src callback URL from state parameter
 */
export declare function getAppCallbackUrlFromState(c: BffContext, state: string | null): string;
/**
 * Gets src callback URL
 */
export declare function getAppCallbackUrl(c: BffContext): string;
/**
  * Validates redirect_uri parameter
 * : localhost
 * : ALLOWED_ORIGINSREDIRECT_URI
  */
export declare function validateRedirectUri(redirectUri: string, c: BffContext): boolean;
//# sourceMappingURL=redirect-uri.d.ts.map