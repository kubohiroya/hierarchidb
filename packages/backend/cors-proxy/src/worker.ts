import { mapEnvironmentVariables, type RawEnv } from './env-mapper.js';

type JwtHeader = {
  alg?: string;
  kid?: string;
  typ?: string;
};

type JwtPayload = {
  iss?: string;
  aud?: string | string[];
  exp?: number;
  nbf?: number;
  iat?: number;
  [key: string]: unknown;
};

type Validator = (token: string) => Promise<boolean>;

type CorsConfig = {
  allowOrigin: string | null;
  allowCredentials: boolean;
  allowHeaders: string;
};

type JWKSCache = {
  fetchedAt: number;
  keys: CryptoKey[];
};

const DEFAULT_ALLOW_METHODS = 'GET,HEAD,POST,PUT,PATCH,DELETE,OPTIONS';
const DEFAULT_ALLOW_HEADERS = 'authorization,content-type,x-requested-with';
const JWKS_CACHE_TTL_MS = 10 * 60 * 1000;

const globalCache = globalThis as typeof globalThis & {
  __HDB_JWKS_CACHE__?: JWKSCache;
};

export default {
  async fetch(request: Request, env: RawEnv): Promise<Response> {
    const mapped = mapEnvironmentVariables(env);
    const url = new URL(request.url);
    const origin = request.headers.get('Origin');
    const allowedOrigins = parseList(env.ALLOWED_ORIGINS ?? env.CORS_PROXY_ALLOWED_ORIGINS ?? '*');
    const cors = resolveCors(origin, allowedOrigins, request.headers.get('Access-Control-Request-Headers'));

    if (request.method.toUpperCase() === 'OPTIONS') {
      if (!cors.allowOrigin) {
        return new Response('Origin not allowed', { status: 403 });
      }
      return new Response(null, { status: 200, headers: buildCorsHeaders(cors) });
    }

    if (!cors.allowOrigin) {
      return new Response('Origin not allowed', { status: 403 });
    }

    const target = url.searchParams.get('url')?.trim();
    if (!target) {
      return withCors(new Response('Missing url parameter', { status: 400 }), cors);
    }

    let targetUrl: URL;
    try {
      targetUrl = new URL(target);
    } catch {
      return withCors(new Response('Invalid url parameter', { status: 400 }), cors);
    }

    const allowlist = parseList(mapped.ALLOWED_TARGET_LIST);
    if (!isAllowedTarget(targetUrl, allowlist)) {
      return withCors(new Response('Target not allowed', { status: 403 }), cors);
    }

    const token = extractBearerToken(request.headers.get('Authorization'));
    if (!token) {
      return withCors(new Response('Missing Bearer token', { status: 401 }), cors);
    }

    const validators = buildValidators(mapped, env);
    if (validators.length === 0) {
      return withCors(new Response('Invalid token', { status: 401 }), cors);
    }
    const ok = await validateToken(token, validators);
    if (!ok) {
      return withCors(new Response('Invalid token', { status: 401 }), cors);
    }

    const outboundHeaders = filterOutboundHeaders(request.headers);
    try {
      const proxyResponse = await fetch(targetUrl.toString(), {
        method: request.method,
        headers: outboundHeaders,
        body: shouldSendBody(request.method) ? request.body : undefined,
        redirect: 'follow',
      });
      const response = new Response(proxyResponse.body, {
        status: proxyResponse.status,
        statusText: proxyResponse.statusText,
        headers: proxyResponse.headers,
      });
      return withCors(response, cors);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to fetch';
      return withCors(new Response(`Proxy fetch failed: ${message}`, { status: 502 }), cors);
    }
  },
};

function shouldSendBody(method: string): boolean {
  const upper = method.toUpperCase();
  return !['GET', 'HEAD'].includes(upper);
}

function extractBearerToken(header: string | null): string | null {
  if (!header) return null;
  const [type, token] = header.split(' ');
  if (type?.toLowerCase() !== 'bearer' || !token) return null;
  return token.trim();
}

function parseList(value: unknown): string[] {
  if (typeof value !== 'string') return [];
  return value
    .split(',')
    .map((entry) => entry.trim())
    .filter((entry) => entry.length > 0);
}

function resolveCors(origin: string | null, allowedOrigins: string[], requestHeaders: string | null): CorsConfig {
  if (!origin) {
    return {
      allowOrigin: '*',
      allowCredentials: false,
      allowHeaders: requestHeaders ?? DEFAULT_ALLOW_HEADERS,
    };
  }
  const allowAll = allowedOrigins.includes('*');
  if (allowAll || allowedOrigins.includes(origin)) {
    return {
      allowOrigin: origin,
      allowCredentials: true,
      allowHeaders: requestHeaders ?? DEFAULT_ALLOW_HEADERS,
    };
  }
  return { allowOrigin: null, allowCredentials: false, allowHeaders: DEFAULT_ALLOW_HEADERS };
}

function buildCorsHeaders(cors: CorsConfig): Headers {
  const headers = new Headers();
  headers.set('Access-Control-Allow-Origin', cors.allowOrigin ?? '*');
  headers.set('Access-Control-Allow-Methods', DEFAULT_ALLOW_METHODS);
  headers.set('Access-Control-Allow-Headers', cors.allowHeaders);
  headers.set('Access-Control-Allow-Credentials', cors.allowCredentials ? 'true' : 'false');
  headers.set('Vary', 'Origin');
  return headers;
}

function withCors(response: Response, cors: CorsConfig): Response {
  const headers = new Headers(response.headers);
  for (const [key, value] of buildCorsHeaders(cors).entries()) {
    headers.set(key, value);
  }
  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers,
  });
}

function isAllowedTarget(target: URL, allowlist: string[]): boolean {
  if (allowlist.length === 0) return false;
  const normalized = target.toString();
  return allowlist.some((entry) => {
    try {
      const allowed = new URL(entry);
      if (allowed.origin === entry && allowed.pathname === '/') {
        return target.origin === allowed.origin;
      }
      return normalized.startsWith(entry);
    } catch {
      return normalized.startsWith(entry);
    }
  });
}

function filterOutboundHeaders(headers: Headers): Headers {
  const filtered = new Headers();
  headers.forEach((value, key) => {
    const lower = key.toLowerCase();
    if (['authorization', 'cookie', 'origin', 'referer', 'host'].includes(lower)) return;
    filtered.set(key, value);
  });
  return filtered;
}

function buildValidators(mapped: ReturnType<typeof mapEnvironmentVariables>, env: RawEnv): Validator[] {
  const validators: Validator[] = [];
  const bffSecret = mapped.BFF_JWT_SECRET;
  const bffIssuer = mapped.BFF_JWT_ISSUER;
  if (bffSecret) {
    validators.push((token) => validateHs256(token, bffSecret, bffIssuer));
  }
  if (mapped.JWKS_URL && mapped.TOKEN_ISSUER && mapped.TOKEN_AUD) {
    validators.push((token) => validateJwks(token, mapped.JWKS_URL!, mapped.TOKEN_ISSUER!, mapped.TOKEN_AUD!));
  }
  if (mapped.CLIENT_ID) {
    validators.push((token) => validateGoogleAccessToken(token, mapped.CLIENT_ID!));
  }
  if (mapped.GITHUB_CLIENT_ID || env.GITHUB_CLIENT_ID) {
    validators.push((token) => validateGitHubToken(token));
  }
  if (mapped.MICROSOFT_CLIENT_ID) {
    validators.push((token) => validateMicrosoftToken(token));
  }
  return validators;
}

async function validateToken(token: string, validators: Validator[]): Promise<boolean> {
  for (const validator of validators) {
    try {
      if (await validator(token)) return true;
    } catch {
      // ignore and continue to next validator
    }
  }
  return false;
}

async function validateHs256(token: string, secret: string, issuer?: string): Promise<boolean> {
  const { header, payload, signature, signingInput } = parseJwt(token);
  if (header.alg !== 'HS256') return false;
  if (issuer && payload.iss !== issuer) return false;
  if (!isJwtActive(payload)) return false;
  const key = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['verify'],
  );
  return await crypto.subtle.verify(
    'HMAC',
    key,
    signature,
    new TextEncoder().encode(signingInput),
  );
}

async function validateJwks(token: string, jwksUrl: string, issuer: string, audience: string): Promise<boolean> {
  const { header, payload, signature, signingInput } = parseJwt(token);
  if (header.alg !== 'RS256') return false;
  if (payload.iss !== issuer) return false;
  if (!audienceMatches(payload.aud, audience)) return false;
  if (!isJwtActive(payload)) return false;

  const keys = await getJwksKeys(jwksUrl, header.kid);
  const data = new TextEncoder().encode(signingInput);
  for (const key of keys) {
    const ok = await crypto.subtle.verify(
      { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' },
      key,
      signature,
      data,
    );
    if (ok) return true;
  }
  return false;
}

async function getJwksKeys(jwksUrl: string, kid?: string): Promise<CryptoKey[]> {
  const now = Date.now();
  const cache = globalCache.__HDB_JWKS_CACHE__;
  if (cache && now - cache.fetchedAt < JWKS_CACHE_TTL_MS) {
    return cache.keys;
  }
  const response = await fetch(jwksUrl);
  if (!response.ok) {
    throw new Error(`JWKS fetch failed: ${response.status}`);
  }
  const data = await response.json() as { keys?: Array<Record<string, string>> };
  const keys = data.keys ?? [];
  const cryptoKeys: CryptoKey[] = [];
  for (const key of keys) {
    if (kid && key.kid !== kid) continue;
    if (key.kty !== 'RSA') continue;
    const imported = await importRsaKey(key);
    if (imported) cryptoKeys.push(imported);
  }
  globalCache.__HDB_JWKS_CACHE__ = { fetchedAt: now, keys: cryptoKeys };
  return cryptoKeys;
}

async function importRsaKey(jwk: Record<string, string>): Promise<CryptoKey | null> {
  if (!jwk.n || !jwk.e) return null;
  const keyData = {
    kty: 'RSA',
    n: jwk.n,
    e: jwk.e,
    alg: 'RS256',
    ext: true,
  };
  return await crypto.subtle.importKey(
    'jwk',
    keyData,
    { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' },
    false,
    ['verify'],
  );
}

async function validateGoogleAccessToken(token: string, clientId: string): Promise<boolean> {
  const response = await fetch(`https://oauth2.googleapis.com/tokeninfo?access_token=${encodeURIComponent(token)}`);
  if (!response.ok) return false;
  const data = await response.json() as { aud?: string };
  return data.aud === clientId;
}

async function validateGitHubToken(token: string): Promise<boolean> {
  const response = await fetch('https://api.github.com/user', {
    headers: {
      Authorization: `Bearer ${token}`,
      'User-Agent': 'hierarchidb-cors-proxy',
    },
  });
  return response.ok;
}

async function validateMicrosoftToken(token: string): Promise<boolean> {
  const response = await fetch('https://graph.microsoft.com/v1.0/me', {
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });
  return response.ok;
}

function parseJwt(token: string): {
  header: JwtHeader;
  payload: JwtPayload;
  signature: ArrayBuffer;
  signingInput: string;
} {
  const parts = token.split('.');
  if (parts.length !== 3) {
    throw new Error('Invalid token');
  }
  const [encodedHeader, encodedPayload, encodedSignature] = parts;
  const header = JSON.parse(decodeBase64Url(encodedHeader)) as JwtHeader;
  const payload = JSON.parse(decodeBase64Url(encodedPayload)) as JwtPayload;
  const signature = decodeBase64UrlToArrayBuffer(encodedSignature);
  return {
    header,
    payload,
    signature,
    signingInput: `${encodedHeader}.${encodedPayload}`,
  };
}

function decodeBase64Url(input: string): string {
  return new TextDecoder().decode(decodeBase64UrlToArrayBuffer(input));
}

function decodeBase64UrlToArrayBuffer(input: string): ArrayBuffer {
  const padded = input.replace(/-/g, '+').replace(/_/g, '/').padEnd(Math.ceil(input.length / 4) * 4, '=');
  const binary = atob(padded);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i += 1) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes.buffer;
}

function isJwtActive(payload: JwtPayload): boolean {
  const now = Math.floor(Date.now() / 1000);
  if (typeof payload.nbf === 'number' && payload.nbf > now) return false;
  if (typeof payload.exp === 'number' && payload.exp < now) return false;
  return true;
}

function audienceMatches(aud: string | string[] | undefined, expected: string): boolean {
  if (!aud) return false;
  if (Array.isArray(aud)) return aud.includes(expected);
  return aud === expected;
}
