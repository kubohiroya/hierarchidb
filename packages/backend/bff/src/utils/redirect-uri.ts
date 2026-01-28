/**
 * Dynamic redirect URI utilities
 */

import { parseAllowedOrigins } from './cors.js';
import { type BffContext, getEnv } from './env.js';

const parseAppBaseUrls = (value?: string): string[] => {
  if (!value) return [];
  return value
    .split(',')
    .map((entry) => entry.trim())
    .filter((entry) => entry.length > 0);
};

const resolveAppBaseUrlForOrigin = (origin: string | undefined, appBaseUrls: string[]): string | undefined => {
  if (!origin) return undefined;
  for (const baseUrl of appBaseUrls) {
    try {
      const parsed = new URL(baseUrl);
      if (`${parsed.protocol}//${parsed.host}` === origin) {
        return baseUrl;
      }
    } catch {
      // Skip invalid base URLs.
    }
  }
  return undefined;
};

const isLocalhostUrl = (value: string): boolean => {
  try {
    const parsed = new URL(value);
    return parsed.hostname === 'localhost' || parsed.hostname === '127.0.0.1';
  } catch {
    return false;
  }
};

const resolveFallbackAppBaseUrl = (c: BffContext, appBaseUrls: string[]): string | undefined => {
  if (appBaseUrls.length === 0) return undefined;
  let requestHost = '';
  try {
    requestHost = new URL(c.req.url).host;
  } catch {
    requestHost = '';
  }
  const preferLocalhost = requestHost.startsWith('localhost') || requestHost.startsWith('127.0.0.1');
  if (preferLocalhost) {
    return appBaseUrls.find(isLocalhostUrl) ?? appBaseUrls[0];
  }
  return appBaseUrls.find((entry) => !isLocalhostUrl(entry)) ?? appBaseUrls[0];
};

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

const normalizePath = (value: string): string => {
  if (!value) return '/';
  return value.startsWith('/') ? value : `/${value}`;
};

const joinPaths = (basePath: string, childPath: string): string => {
  const normalizedBase = basePath === '/' ? '' : basePath.replace(/\/+$/, '');
  const normalizedChild = normalizePath(childPath);
  return `${normalizedBase}${normalizedChild}` || '/';
};

export function getAppCallbackPath(c: BffContext, appBaseUrl?: string): string {
  const env = getEnv(c);
  if (env.STATIC_CALLBACK_PATH) {
    return normalizePath(env.STATIC_CALLBACK_PATH);
  }
  if (appBaseUrl && appBaseUrl.includes('github.io')) {
    return '/auth/callback.html';
  }
  return '/auth/callback';
}

export function buildAppCallbackUrl(c: BffContext, appBaseUrl: string): URL {
  const baseUrl = new URL(appBaseUrl);
  const callbackPath = getAppCallbackPath(c, appBaseUrl);
  baseUrl.pathname = joinPaths(baseUrl.pathname, callbackPath);
  return baseUrl;
}

export function resolveStateOrigin(c: BffContext, returnOrigin?: string | null): string | undefined {
  const env = getEnv(c);
  const appBaseUrls = parseAppBaseUrls(env.APP_BASE_URLS);
  const allowedOrigins = parseAllowedOrigins(env.ALLOWED_ORIGINS || '');
  const candidates = [returnOrigin ?? undefined, c.req.header('Origin') ?? undefined]
    .filter((value): value is string => typeof value === 'string' && value.length > 0);

  for (const candidate of candidates) {
    try {
      const parsed = new URL(candidate);
      const origin = `${parsed.protocol}//${parsed.host}`;
      const matchedExactBase = appBaseUrls.find((entry) => entry === candidate);
      if (matchedExactBase) {
        return matchedExactBase;
      }
      const matchedBase = resolveAppBaseUrlForOrigin(origin, appBaseUrls);
      if (matchedBase) return matchedBase;
      if (allowedOrigins.includes(origin)) return origin;
      if (
        origin.startsWith('http://localhost:')
        || origin.startsWith('http://127.0.0.1:')
        || origin.startsWith('https://localhost:')
        || origin.startsWith('https://127.0.0.1:')
      ) {
        return origin;
      }
    } catch {
      // Ignore invalid origin candidates
    }
  }

  return undefined;
}

/**
 * Gets src callback URL from atoms parameter
 */
export function getAppCallbackUrlFromState(
  c: BffContext,
  state: string | null,
  stateOriginOverride?: string
): string {
  const env = getEnv(c);
  const appBaseUrls = parseAppBaseUrls(env.APP_BASE_URLS);
  const requestOrigin = c.req.header('Origin');

  // Try to extract origin from atoms if it's encoded
  let stateOrigin: string | undefined = stateOriginOverride;
  if (!stateOrigin && state) {
    try {
      // State might contain origin info
      const stateData = JSON.parse(atob(state));
      stateOrigin =
        stateData.origin ||
        stateData.returnOrigin ||
        stateData.return_origin;
    } catch {
      // State is not JSON encoded, ignore
    }
  }

  const matchedStateBaseUrl =
    (stateOrigin ? appBaseUrls.find((entry) => entry === stateOrigin) : undefined) ??
    resolveAppBaseUrlForOrigin(stateOrigin, appBaseUrls);
  const matchedBaseUrl = matchedStateBaseUrl ?? resolveAppBaseUrlForOrigin(requestOrigin, appBaseUrls);
  if (matchedBaseUrl) {
    return matchedBaseUrl;
  }

  //  1:
  if (env.APP_BASE_URL) {
    return env.APP_BASE_URL;
  }

  const fallbackBaseUrl = resolveFallbackAppBaseUrl(c, appBaseUrls);
  if (fallbackBaseUrl) {
    return fallbackBaseUrl;
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
  const appBaseUrls = parseAppBaseUrls(env.APP_BASE_URLS);

  //  1:
  if (env.APP_BASE_URL) {
    return env.APP_BASE_URL;
  }

  const origin = c.req.header('Origin');
  const matchedBaseUrl = resolveAppBaseUrlForOrigin(origin, appBaseUrls);
  if (matchedBaseUrl) {
    return matchedBaseUrl;
  }

  const fallbackBaseUrl = resolveFallbackAppBaseUrl(c, appBaseUrls);
  if (fallbackBaseUrl) {
    return fallbackBaseUrl;
  }

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
