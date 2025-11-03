/**
 * Dynamic redirect URI utilities
 */

import { parseAllowedOrigins } from './cors.js';
import { type BffContext, getEnv } from './env.js';

/**
 * Gets dynamic redirect URI based on request origin
 */
export function getDynamicRedirectUri(c: BffContext, provider: string = 'google'): string {
  const env = getEnv(c);

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
export function getAppCallbackUrlFromState(c: BffContext, state: string | null): string {
  const env = getEnv(c);

  // Try to extract origin from state if it's encoded
  let stateOrigin: string | undefined;
  if (state) {
    try {
      // State might contain origin info
      const stateData = JSON.parse(atob(state));
      if (stateData.origin) {
        stateOrigin = stateData.origin;
      }
    } catch {
      // State is not JSON encoded, ignore
    }
  }

  //  1:
  if (env.APP_BASE_URL) {
    return env.APP_BASE_URL;
  }

  //  : ALLOWED_ORIGINS
  if (env.ENVIRONMENT === 'production' || env.NODE_ENV === 'production') {
    const allowedOrigins = parseAllowedOrigins(env.ALLOWED_ORIGINS || '');

    //  stateorigin
    if (stateOrigin && allowedOrigins.includes(stateOrigin)) {
      return stateOrigin;
    }

    //  Origin
    const origin = c.req.header('Origin');
    if (origin && allowedOrigins.includes(origin)) {
      return origin;
    }

    return env.APP_BASE_URL || env.ALLOWED_ORIGINS?.split(',')[0] || '';
  }

  //  : localhost
  //  stateorigin
  if (stateOrigin) {
    if (
      stateOrigin.startsWith('http://localhost:') ||
      stateOrigin.startsWith('http://127.0.0.1:')
    ) {
      return stateOrigin;
    }
    console.warn(`Rejected non-localhost origin from state in development: ${stateOrigin}`);
  }

  //  Origin
  const origin = c.req.header('Origin');
  if (origin) {
    if (origin.startsWith('http://localhost:') || origin.startsWith('http://127.0.0.1:')) {
      return origin;
    }
    console.warn(`Rejected non-localhost origin in development: ${origin}`);
  }

  return 'http://localhost:4200';
}

/**
 * Gets src callback URL
 */
export function getAppCallbackUrl(c: BffContext): string {
  const env = getEnv(c);

  //  1:
  if (env.APP_BASE_URL) {
    return env.APP_BASE_URL;
  }

  const origin = c.req.header('Origin');

  //  : ALLOWED_ORIGINS
  if (env.ENVIRONMENT === 'production' || env.NODE_ENV === 'production') {
    if (origin) {
      const allowedOrigins = parseAllowedOrigins(env.ALLOWED_ORIGINS || '');
      if (allowedOrigins.includes(origin)) {
        return origin;
      }
      console.warn(`Rejected origin in production: ${origin}`);
    }
    return env.APP_BASE_URL || env.ALLOWED_ORIGINS?.split(',')[0] || '';
  }

  //  : localhost
  if (origin) {
    if (origin.startsWith('http://localhost:') || origin.startsWith('http://127.0.0.1:')) {
      return origin;
    }
    console.warn(`Rejected non-localhost origin in development: ${origin}`);
  }

  return 'http://localhost:4200';
}

/**
 * Validates redirect_uri parameter
 * : localhost
 * : ALLOWED_ORIGINSREDIRECT_URI
 */
export function validateRedirectUri(redirectUri: string, c: BffContext): boolean {
  const env = getEnv(c);

  try {
    const url = new URL(redirectUri);
    const origin = `${url.protocol}//${url.host}`;

    if (env.ENVIRONMENT === 'production' || env.NODE_ENV === 'production') {
      //  redirect_uri
      if (env.REDIRECT_URI && redirectUri === env.REDIRECT_URI) {
        return true;
      }
      if (env.GITHUB_REDIRECT_URI && redirectUri === env.GITHUB_REDIRECT_URI) {
        return true;
      }
      if (env.MICROSOFT_REDIRECT_URI && redirectUri === env.MICROSOFT_REDIRECT_URI) {
        return true;
      }

      //  ALLOWED_ORIGINSredirect_uri
      const allowedOrigins = parseAllowedOrigins(env.ALLOWED_ORIGINS || '');
      if (allowedOrigins.includes(origin)) {
        return true;
      }

      console.warn(`Invalid redirect_uri in production: ${redirectUri}`);
      return false;
    }

    //  : localhost
    if (
      origin.startsWith('http://localhost:') ||
      origin.startsWith('http://127.0.0.1:') ||
      origin.startsWith('https://localhost:') ||
      origin.startsWith('https://127.0.0.1:')
    ) {
      return true;
    }

    console.warn(`Invalid redirect_uri in development (not localhost): ${redirectUri}`);
    return false;
  } catch (error) {
    console.error(`Invalid redirect_uri format: ${redirectUri}`, error);
    return false;
  }
}
