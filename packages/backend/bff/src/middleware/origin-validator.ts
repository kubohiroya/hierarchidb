/**
 * Origin validation middleware
 */

import type { Next } from 'hono';
import { parseAllowedOrigins } from '~/utils/cors';
import { type BffContext, getEnv } from '~/utils/env';

const parseAppBaseUrls = (value?: string): string[] => {
  if (!value) return [];
  return value
    .split(',')
    .map((entry) => entry.trim())
    .filter((entry) => entry.length > 0);
};

const extractOrigins = (values: string[]): string[] => {
  const origins: string[] = [];
  for (const entry of values) {
    try {
      const url = new URL(entry);
      origins.push(`${url.protocol}//${url.host}`);
    } catch {
      // Ignore invalid URLs.
    }
  }
  return origins;
};

const collectAllowedOrigins = (env: { ALLOWED_ORIGINS?: string; APP_BASE_URL?: string; APP_BASE_URLS?: string }) => {
  const allowed = parseAllowedOrigins(env.ALLOWED_ORIGINS || '');
  const appBases = [env.APP_BASE_URL, ...parseAppBaseUrls(env.APP_BASE_URLS)].filter(
    (value): value is string => typeof value === 'string' && value.length > 0
  );
  return new Set([...allowed, ...extractOrigins(appBases)]);
};

/**
 * Origin
 * localhost
 * ALLOWED_ORIGINS
 */
export async function validateOrigin(c: BffContext, next: Next) {
  const origin = c.req.header('Origin');
  const env = getEnv(c);

  //  Origin
  if (!origin) {
    return next();
  }

  if (env.ENVIRONMENT === 'production' || env.NODE_ENV === 'production') {
    const allowedOrigins = collectAllowedOrigins(env);

    if (!allowedOrigins.has(origin)) {
      console.warn(`Blocked request from unauthorized origin in production: ${origin}`);
      return c.json(
        {
          error: 'Forbidden',
          message: 'Origin not allowed',
        },
        403
      );
    }
  } else {
    const isLocalhost =
      origin.startsWith('http://localhost:') ||
      origin.startsWith('http://127.0.0.1:') ||
      origin.startsWith('https://localhost:') ||
      origin.startsWith('https://127.0.0.1:');

    if (!isLocalhost) {
      console.warn(`Blocked request from non-localhost origin in development: ${origin}`);
      return c.json(
        {
          error: 'Forbidden',
          message: 'Only localhost origins are allowed in development mode',
        },
        403
      );
    }
  }

  return next();
}

/**
 * Origin
 */
export function requireValidOrigin(paths: string[]) {
  return async (c: BffContext, next: Next) => {
    const path = new URL(c.req.url).pathname;

    if (paths.some((p) => path.startsWith(p))) {
      return validateOrigin(c, next);
    }

    return next();
  };
}
