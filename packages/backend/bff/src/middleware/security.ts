import { parseEnvInt } from '~/utils/number';

export interface Env {
  ALLOWED_ORIGINS: string;
  PRODUCTION_ORIGINS?: string;
  STAGING_ORIGINS?: string;
  DEVELOPMENT_ORIGINS?: string;
  ENABLE_RATE_LIMIT?: string;
  RATE_LIMIT_PER_MINUTE?: string;
  ENABLE_AUDIT_LOG?: string;
  LOG_LEVEL?: string;
  ENABLE_SECURITY_HEADERS?: string;
  CSP_REPORT_URI?: string;
  RATE_LIMIT_KV?: KVNamespace;
  AUDIT_LOG_KV?: KVNamespace;
  JWT_EXPIRY_HOURS_PROD?: string;
  JWT_EXPIRY_HOURS_STAGING?: string;
  JWT_EXPIRY_HOURS_DEV?: string;
}

export function validateOrigin(
  request: Request,
  env: Env
): {
  isValid: boolean;
  origin: string | null;
  environment: 'production' | 'staging' | 'development' | 'unknown';
} {
  const origin = request.headers.get('Origin');

  if (!origin) {
    return { isValid: false, origin: null, environment: 'unknown' };
  }

  //  Origin
  const allowedOrigins = env.ALLOWED_ORIGINS.split(',')
    .map((o) => o.trim())
    .filter((o) => o.length > 0);

  //  Origin
  const isValid = allowedOrigins.includes(origin);

  let environment: 'production' | 'staging' | 'development' | 'unknown' = 'unknown';

  if (env.PRODUCTION_ORIGINS?.split(',').some((o) => o.trim() === origin)) {
    environment = 'production';
  } else if (env.STAGING_ORIGINS?.split(',').some((o) => o.trim() === origin)) {
    environment = 'staging';
  } else if (env.DEVELOPMENT_ORIGINS?.split(',').some((o) => o.trim() === origin)) {
    environment = 'development';
  }

  return { isValid, origin, environment };
}

export function addCorsHeaders(response: Response, origin: string | null, env: Env): Response {
  const headers = new Headers(response.headers);

  if (origin) {
    //  Origin
    const { isValid } = validateOrigin(
      new Request('https://example.com', { headers: { Origin: origin } }),
      env
    );
    if (isValid) {
      headers.set('Access-Control-Allow-Origin', origin);
      headers.set('Access-Control-Allow-Credentials', 'true');
    }
  }

  headers.set('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  headers.set('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  headers.set('Access-Control-Max-Age', '86400'); //  24

  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers,
  });
}

export async function checkRateLimit(
  request: Request,
  env: Env
): Promise<{ allowed: boolean; remaining: number }> {
  if (env.ENABLE_RATE_LIMIT !== 'true' || !env.RATE_LIMIT_KV) {
    return { allowed: true, remaining: 999 };
  }

  const ip =
    request.headers.get('CF-Connecting-IP') ||
    request.headers.get('X-Forwarded-For')?.split(',')[0] ||
    'unknown';

  const key = `ratelimit:${ip}`;
  const limit = parseEnvInt(env.RATE_LIMIT_PER_MINUTE, 30);
  const now = Date.now();
  const window = 60000; //  1

  const data = (await env.RATE_LIMIT_KV.get(key, 'json')) as {
    count: number;
    resetAt: number;
  } | null;

  if (!data || data.resetAt < now) {
    await env.RATE_LIMIT_KV.put(
      key,
      JSON.stringify({
        count: 1,
        resetAt: now + window,
      }),
      { expirationTtl: 60 }
    );

    return { allowed: true, remaining: limit - 1 };
  }

  if (data.count >= limit) {
    return { allowed: false, remaining: 0 };
  }

  data.count++;
  await env.RATE_LIMIT_KV.put(key, JSON.stringify(data), {
    expirationTtl: Math.ceil((data.resetAt - now) / 1000),
  });

  return { allowed: true, remaining: limit - data.count };
}

export function addSecurityHeaders(response: Response, env: Env): Response {
  if (env.ENABLE_SECURITY_HEADERS !== 'true') {
    return response;
  }

  const headers = new Headers(response.headers);

  // Content Security Policy
  const cspDirectives = [
    "default-src 'self'",
    "script-src 'self' 'unsafe-inline' 'unsafe-eval'", //  React
    "style-src 'self' 'unsafe-inline'",
    "img-src 'self' data: https:",
    "font-src 'self' data:",
    "connect-src 'self' https://hierarchidb-bff.kubohiroya.workers.dev",
    "frame-ancestors 'none'",
  ];

  if (env.CSP_REPORT_URI) {
    cspDirectives.push(`report-uri ${env.CSP_REPORT_URI}`);
  }

  headers.set('Content-Security-Policy', cspDirectives.join('; '));

  headers.set('X-Content-Type-Options', 'nosniff');
  headers.set('X-Frame-Options', 'DENY');
  headers.set('X-XSS-Protection', '1; mode=block');
  headers.set('Referrer-Policy', 'strict-origin-when-cross-origin');
  headers.set('Permissions-Policy', 'geolocation=(), microphone=(), camera=()');

  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers,
  });
}

export async function logAuditEvent(
  event: {
    type: 'auth_attempt' | 'auth_success' | 'auth_failure' | 'token_refresh' | 'logout';
    userId?: string;
    email?: string;
    provider?: string;
    origin: string | null;
    environment: string;
    ip: string;
    userAgent: string | null;
    error?: string;
  },
  env: Env
): Promise<void> {
  if (env.ENABLE_AUDIT_LOG !== 'true' || !env.AUDIT_LOG_KV) {
    console.log('[Audit]', JSON.stringify(event));
    return;
  }

  const timestamp = new Date().toISOString();
  const key = `audit:${timestamp}:${Math.random().toString(36).substr(2, 9)}`;

  const logEntry = {
    ...event,
    timestamp,
    level: event.type.includes('failure') ? 'error' : 'info',
  };

  await env.AUDIT_LOG_KV.put(key, JSON.stringify(logEntry), {
    expirationTtl: 86400,
  });

  if (event.type === 'auth_failure' && event.error) {
    await checkForSuspiciousActivity(event.ip, env);
  }
}

async function checkForSuspiciousActivity(ip: string, env: Env): Promise<void> {
  if (!env.AUDIT_LOG_KV) return;

  const key = `suspicious:${ip}`;
  const data = (await env.AUDIT_LOG_KV.get(key, 'json')) as {
    count: number;
    firstSeen: number;
  } | null;
  const now = Date.now();

  if (!data) {
    await env.AUDIT_LOG_KV.put(
      key,
      JSON.stringify({
        count: 1,
        firstSeen: now,
      }),
      { expirationTtl: 3600 }
    ); //  1
    return;
  }

  data.count++;

  if (data.count >= 5 && now - data.firstSeen < 3600000) {
    console.error(`[Security Alert] Suspicious activity from IP: ${ip}, failures: ${data.count}`);
  }

  await env.AUDIT_LOG_KV.put(key, JSON.stringify(data), {
    expirationTtl: Math.ceil((data.firstSeen + 3600000 - now) / 1000),
  });
}

export function getJwtExpiry(environment: string, env: Env): number {
  const hours =
    environment === 'production'
      ? parseEnvInt(env.JWT_EXPIRY_HOURS_PROD, 2)
      : environment === 'staging'
        ? parseEnvInt(env.JWT_EXPIRY_HOURS_STAGING, 8)
        : parseEnvInt(env.JWT_EXPIRY_HOURS_DEV, 24);

  return hours * 3600;
}

export async function handleSecurity(
  request: Request,
  env: Env,
  handler: () => Promise<Response>
): Promise<Response> {
  //  1. Origin
  const { isValid, origin } = validateOrigin(request, env);

  if (!isValid && request.method !== 'OPTIONS') {
    await logAuditEvent(
      {
        type: 'auth_failure',
        origin,
        environment: 'unknown',
        ip: request.headers.get('CF-Connecting-IP') || 'unknown',
        userAgent: request.headers.get('User-Agent'),
        error: 'Invalid origin',
      },
      env
    );

    return new Response('Forbidden', { status: 403 });
  }

  const { allowed, remaining } = await checkRateLimit(request, env);

  if (!allowed) {
    return new Response('Too Many Requests', {
      status: 429,
      headers: {
        'Retry-After': '60',
        'X-RateLimit-Remaining': '0',
      },
    });
  }

  if (request.method === 'OPTIONS') {
    const response = new Response(null, { status: 204 });
    return addCorsHeaders(response, origin, env);
  }

  let response = await handler();

  response = addCorsHeaders(response, origin, env);
  response = addSecurityHeaders(response, env);

  const headers = new Headers(response.headers);
  headers.set('X-RateLimit-Remaining', remaining.toString());

  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers,
  });
}
