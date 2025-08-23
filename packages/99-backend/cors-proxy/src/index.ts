/// <reference types="@cloudflare/workers-types" />

import { createRemoteJWKSet, jwtVerify } from 'jose';
import type { Env } from 'hono';
import { Hono } from 'hono';
import { mapEnvironmentVariables, MappedEnv } from './env-mapper';

export interface Bindings extends Env {
  JWKS_URL?: string;
  TOKEN_ISSUER?: string;
  TOKEN_AUD?: string;
  ALLOWED_TARGET_LIST: string;
  CLIENT_ID?: string;
  MICROSOFT_CLIENT_ID?: string;
  GITHUB_CLIENT_ID?: string;
  BFF_JWT_SECRET?: string;
  BFF_JWT_ISSUER?: string;
}

const app = new Hono<{ Bindings: Bindings }>();

// Environment mapping middleware
app.use('*', async (c, next) => {
  // Map prefixed environment variables to non-prefixed names
  c.env = mapEnvironmentVariables(c.env) as MappedEnv;
  await next();
});

// Allow OPTIONS for all paths
app.options('*', (c) => {
  const origin = c.req.header('Origin') ?? '*';
  const reqHeaders = c.req.header('Access-Control-Request-Headers') ?? '';
  return c.body(null, 200, corsHeaders(origin, reqHeaders));
});

// CORS middleware for all requests
app.use('*', async (c, next) => {
  const origin = c.req.header('Origin') ?? '*';
  const reqHeaders = c.req.header('Access-Control-Request-Headers') ?? '';
  // Handle preflight requests
  if (c.req.method === 'OPTIONS') {
    return c.body(null, 200, corsHeaders(origin, reqHeaders));
  }
  await next();
  Object.entries(corsHeaders(origin)).forEach(([k, v]) => {
    c.res.headers.set(k, v);
  });
  return;
});

// JWKS getter (RemoteJWKSet caches internally for ~10 minutes)
let jwks: ReturnType<typeof createRemoteJWKSet>;
app.use('*', async (c, next) => {
  if (c.req.method !== 'OPTIONS' && !jwks && c.env.JWKS_URL) {
    jwks = createRemoteJWKSet(new URL(c.env.JWKS_URL));
  }
  await next();
});

// Verify BFF JWT token
async function verifyBFFToken(
  token: string,
  secret: string,
  expectedIssuer?: string
): Promise<boolean> {
  try {
    const secretKey = new TextEncoder().encode(secret);
    // Accept both dev and prod issuers if no specific issuer is expected
    const issuers = expectedIssuer ? [expectedIssuer] : ['hierarchidb-bff', 'hierarchidb-bff-prod'];

    const { payload } = await jwtVerify(token, secretKey, {
      issuer: issuers,
    });

    // Check required fields
    if (payload.sub && payload.email) {
      return true;
    }
    return false;
  } catch (error) {
    return false;
  }
}

// Proxy fetch handler
app.get('/', async (c) => {
  const origin = c.req.header('Origin') ?? '*';
  // 1) Extract JWT
  const auth = c.req.header('Authorization') ?? '';
  const [, token] = auth.match(/^Bearer (.+)$/i) ?? [];
  if (!token) {
    return c.text('Missing Bearer token', 401, corsHeaders(origin));
  }
  // 2) Verify token
  try {
    let tokenValid = false;

    // First try BFF JWT verification
    if (c.env.BFF_JWT_SECRET) {
      const isBFFTokenValid = await verifyBFFToken(
        token,
        c.env.BFF_JWT_SECRET,
        c.env.BFF_JWT_ISSUER
      );
      if (isBFFTokenValid) {
        // BFF JWT is valid
        tokenValid = true;
      }
    }

    // If BFF JWT is invalid or not configured, try other verification methods
    if (!tokenValid) {
      // Try JWT verification (for ID tokens)
      if (jwks && c.env.TOKEN_ISSUER && c.env.CLIENT_ID) {
        try {
          await jwtVerify(token, jwks, {
            issuer: c.env.TOKEN_ISSUER,
            audience: c.env.CLIENT_ID,
          });
          tokenValid = true;
        } catch (jwtError) {
          // Try provider-specific token validation
        }
      }

      // Try Google access token validation
      if (!tokenValid && c.env.CLIENT_ID) {
        try {
          const googleResponse = await fetch(
            `https://www.googleapis.com/oauth2/v1/tokeninfo?access_token=${token}`
          );

          if (googleResponse.ok) {
            const tokenInfo = (await googleResponse.json()) as {
              audience?: string;
              expires_in?: number;
              error?: string;
            };

            if (
              !tokenInfo.error &&
              tokenInfo.audience === c.env.CLIENT_ID &&
              tokenInfo.expires_in &&
              tokenInfo.expires_in > 0
            ) {
              tokenValid = true;
            }
          }
        } catch {}
      }

      // Try Microsoft access token validation
      if (!tokenValid && c.env.MICROSOFT_CLIENT_ID) {
        try {
          const msResponse = await fetch('https://graph.microsoft.com/v1.0/me', {
            headers: {
              Authorization: `Bearer ${token}`,
            },
          });

          if (msResponse.ok) {
            tokenValid = true;
          }
        } catch {}
      }

      // Try GitHub access token validation
      if (!tokenValid && c.env.GITHUB_CLIENT_ID) {
        try {
          const ghResponse = await fetch('https://api.github.com/user', {
            headers: {
              Authorization: `Bearer ${token}`,
              Accept: 'application/vnd.github.v3+json',
            },
          });

          if (ghResponse.ok) {
            tokenValid = true;
          }
        } catch {}
      }

      if (!tokenValid) {
        throw new Error('Invalid access token');
      }
    }
  } catch (e) {
    return c.text('Invalid token: ' + (e as Error).message, 401, corsHeaders(origin));
  }
  // 3) Target URL
  const target = new URL(c.req.url).searchParams.get('url');
  if (!target) return c.text('query ?url= is required', 400, corsHeaders(origin));
  // 4) Check allow-list
  const allow = c.env.ALLOWED_TARGET_LIST.split(',').filter(Boolean);
  if (allow.length && !allow.some((base) => target.startsWith(base))) {
    return c.text('Target not allowed', 403, corsHeaders(origin));
  }
  // 5) Fetch upstream with detailed headers
  const upstream = await fetch(target, {
    headers: {
      ...c.req.raw.headers,
      Origin: new URL(target).origin, // Forward the target's origin
    },
    method: 'GET',
  });
  const res = new Response(upstream.body, upstream);
  // 6) Add CORS headers
  Object.entries(corsHeaders(origin)).forEach(([k, v]) => res.headers.set(k, v));
  return res;
});

export default app;

// Common CORS headers
function corsHeaders(origin: string, reqHeaders = '') {
  return {
    'Access-Control-Allow-Origin': origin,
    'Access-Control-Allow-Methods': 'GET,HEAD,OPTIONS',
    'Access-Control-Allow-Headers': reqHeaders || 'Authorization',
    'Access-Control-Allow-Credentials': 'true',
    Vary: 'Origin',
  };
}
