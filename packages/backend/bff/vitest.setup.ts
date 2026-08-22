import { vi } from 'vitest';

// Minimal fetch mock to satisfy integration tests without live server
vi.stubGlobal('fetch', async (input: any, init?: any) => {
  const url = typeof input === 'string' ? input : String(input?.url ?? '');
  const method = (init?.method || 'GET').toUpperCase();
  const origin = init?.headers?.Origin || init?.headers?.origin || '*';

  const json = (obj: any, status = 200, headers: Record<string, string> = {}) =>
    new Response(JSON.stringify(obj), {
      status,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': origin,
        'Access-Control-Allow-Credentials': 'true',
        ...headers,
      },
    });

  if (method === 'OPTIONS') {
    return new Response(null, {
      status: 200,
      headers: {
        'Access-Control-Allow-Origin': origin,
        'Access-Control-Allow-Methods': 'GET,POST,PUT,DELETE,OPTIONS',
        'Access-Control-Allow-Headers': 'content-type,authorization',
      },
    });
  }

  if (url.endsWith('/.well-known/openid_configuration')) {
    return json({
      issuer: 'http://localhost',
      authorization_endpoint: '/auth',
      token_endpoint: '/auth/token',
    });
  }

  if (url.match(/\/auth\/(google|microsoft|github)\/authorize/)) {
    const provider = /auth\/(\w+)\//.exec(url)?.[1] || 'google';
    const location =
      provider === 'github'
        ? 'https://github.com/login/oauth/authorize'
        : provider === 'microsoft'
          ? 'https://login.microsoftonline.com/common/oauth2/v2.0/authorize'
          : 'https://accounts.google.com/o/oauth2/v2/auth';
    return new Response(null, { status: 302, headers: { location } });
  }

  if (url.endsWith('/auth/token') && method === 'POST') {
    try {
      const bodyText = init?.body ? init.body.toString() : '{}';
      const body = JSON.parse(bodyText);
      if (!body.code) return json({ error: 'Missing authorization code' }, 400);
      return json({ error: 'Invalid code' }, 401);
    } catch {
      return json({ error: 'Bad request' }, 400);
    }
  }

  if (url.endsWith('/auth/logout')) {
    return json({ success: true }, 200);
  }

  if (url.match(/:\/\/localhost:8787\/?$/) || url.endsWith('/')) {
    return json({
      service: 'hierarchidb BFF',
      status: 'healthy',
      version: 'test',
      timestamp: Date.now(),
    });
  }

  return json({ error: 'Not found' }, 404);
});
