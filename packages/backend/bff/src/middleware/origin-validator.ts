/**
 * Origin validation middleware
 */

import { Next } from 'hono';
import { parseAllowedOrigins } from '../utils/cors.js';
import { getEnv, type BffContext } from '../utils/env.js';

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
    const allowedOrigins = parseAllowedOrigins(env.ALLOWED_ORIGINS || '');

    if (!allowedOrigins.includes(origin)) {
      console.warn(`Blocked request from unauthorized origin in production: ${origin}`);
      return c.json(
        {
          error: 'Forbidden',
          message: 'Origin not allowed',
        },
        403,
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
        403,
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
