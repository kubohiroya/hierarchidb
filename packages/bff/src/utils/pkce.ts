/**
 * PKCE (Proof Key for Code Exchange) utilities for OAuth2 flows
 */

/**
 * Generates a cryptographically secure random string for PKCE code verifier
 */
export function generateCodeVerifier(): string {
  const array = new Uint8Array(32);
  crypto.getRandomValues(array);
  return base64UrlEncode(array);
}

/**
 * Generates code challenge from code verifier using SHA256
 */
export async function generateCodeChallenge(codeVerifier: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(codeVerifier);
  const digest = await crypto.subtle.digest('SHA-256', data);
  return base64UrlEncode(new Uint8Array(digest));
}

/**
 * Base64 URL-safe encoding (RFC 4648 Section 5)
 */
function base64UrlEncode(buffer: Uint8Array): string {
  const base64 = btoa(String.fromCharCode(...buffer));
  return base64.replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '');
}

/**
 * Validates PKCE code verifier format
 */
export function isValidCodeVerifier(codeVerifier: string): boolean {
  // RFC 7636: code_verifier = 43*128unreserved
  // unreserved = ALPHA / DIGIT / "-" / "." / "_" / "~"
  return /^[A-Za-z0-9\-._~]{43,128}$/.test(codeVerifier);
}

/**
 * Generates a random state parameter for OAuth2
 */
export function generateState(): string {
  return generateCodeVerifier(); // Can reuse the same secure random generation
}
