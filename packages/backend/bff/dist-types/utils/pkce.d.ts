/**
 * PKCE (Proof Key for Code Exchange) utilities for OAuth2 flows
 */
/**
 * Generates a cryptographically secure random string for PKCE code verifier
 */
export declare function generateCodeVerifier(): string;
/**
 * Generates code challenge from code verifier using SHA256
 */
export declare function generateCodeChallenge(codeVerifier: string): Promise<string>;
/**
 * Validates PKCE code verifier format
 */
export declare function isValidCodeVerifier(codeVerifier: string): boolean;
/**
 * Generates a random state parameter for OAuth2
 */
export declare function generateState(): string;
//# sourceMappingURL=pkce.d.ts.map