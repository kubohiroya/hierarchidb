/**
 * Dynamic redirect URI utilities
 */

import { Context } from 'hono';

/**
 * Gets dynamic redirect URI based on request origin
 */
export function getDynamicRedirectUri(c: Context, provider: string = 'google'): string {
  const env = c.env as any;

  // Check for provider-specific redirect URI
  if (provider === 'github' && env.GITHUB_REDIRECT_URI) {
    return env.GITHUB_REDIRECT_URI;
  }
  if (provider === 'microsoft' && env.MICROSOFT_REDIRECT_URI) {
    return env.MICROSOFT_REDIRECT_URI;
  }

  // Use default redirect URI
  if (env.REDIRECT_URI) {
    return env.REDIRECT_URI;
  }

  // Fallback to constructing from request
  const url = new URL(c.req.url);
  return `${url.protocol}//${url.host}/auth/callback`;
}

/**
 * Gets src callback URL from state parameter
 */
export function getAppCallbackUrlFromState(c: Context, state: string | null): string {
  const env = c.env as any;

  // Try to extract origin from state if it's encoded
  if (state) {
    try {
      // State might contain origin info
      const stateData = JSON.parse(atob(state));
      if (stateData.origin) {
        return stateData.origin;
      }
    } catch {
      // State is not JSON encoded, ignore
    }
  }

  // Use configured src base URL
  if (env.APP_BASE_URL) {
    return env.APP_BASE_URL;
  }

  // Fallback to common defaults
  const origin = c.req.header('Origin');
  if (origin) {
    return origin;
  }

  return 'http://localhost:5173';
}

/**
 * Gets src callback URL
 */
export function getAppCallbackUrl(c: Context): string {
  const env = c.env as any;

  if (env.APP_BASE_URL) {
    return env.APP_BASE_URL;
  }

  const origin = c.req.header('Origin');
  if (origin) {
    return origin;
  }

  return 'http://localhost:5173';
}
