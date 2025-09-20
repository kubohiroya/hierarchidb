import type { Next } from 'hono';
import { getEnv, type BffContext } from './env.js';

interface TurnstileVerifyResponse {
  success: boolean;
  'error-codes': string[];
  challenge_ts?: string;
  hostname?: string;
  action?: string;
  cdata?: string;
}

export async function verifyTurnstileToken(
  token: string,
  secretKey: string,
  remoteIp?: string,
): Promise<{ success: boolean; error?: string }> {
  try {
    const formData = new FormData();
    formData.append('secret', secretKey);
    formData.append('response', token);
    if (remoteIp) {
      formData.append('remoteip', remoteIp);
    }

    const response = await fetch('https://challenges.cloudflare.com/turnstile/v0/siteverify', {
      method: 'POST',
      body: formData,
    });

    const result: TurnstileVerifyResponse = await response.json();

    if (!result.success) {
      const errorCodes = result['error-codes'] || [];
      console.error('Turnstile verification failed:', errorCodes);

      const errorMessage = errorCodes.includes('missing-input-response')
        ? 'Turnstile token is missing'
        : errorCodes.includes('invalid-input-response')
          ? 'Invalid Turnstile token'
          : errorCodes.includes('timeout-or-duplicate')
            ? 'Turnstile token expired or already used'
            : errorCodes.includes('bad-request')
              ? 'Invalid request to Turnstile'
              : 'Turnstile verification failed';

      return { success: false, error: errorMessage };
    }

    return { success: true };
  } catch (error) {
    console.error('Turnstile verification error:', error);
    return { success: false, error: 'Failed to verify Turnstile token' };
  }
}

const TURNSTILE_QUERY_PARAM = 'cf-turnstile-response';

export function extractTurnstileToken(c: BffContext): string | null {
  const url = new URL(c.req.url);
  const urlToken = url.searchParams.get(TURNSTILE_QUERY_PARAM);
  if (urlToken) {
    return urlToken;
  }

  const headerToken = c.req.header('X-Turnstile-Token');
  if (headerToken) {
    return headerToken;
  }

  return null;
}

export async function requireTurnstile(c: BffContext, next: Next) {
  const env = getEnv(c);

  if (
    env.SKIP_TURNSTILE === 'true' ||
    env.ENVIRONMENT === 'development' ||
    !env.TURNSTILE_SECRET_KEY
  ) {
    return next();
  }

  const token = extractTurnstileToken(c) || (await c.req.json().catch(() => ({}))).turnstileToken;

  if (!token) {
    return c.json({
      error: 'missing_turnstile',
      message: 'Turnstile verification is required',
    }, 400);
  }

  const clientIp = c.req.header('CF-Connecting-IP') || c.req.header('X-Forwarded-For')?.split(',')[0];

  const result = await verifyTurnstileToken(
    token,
    env.TURNSTILE_SECRET_KEY,
    clientIp,
  );

  if (!result.success) {
    return c.json({
      error: 'invalid_turnstile',
      message: result.error || 'Turnstile verification failed',
    }, 403);
  }

  return next();
}
