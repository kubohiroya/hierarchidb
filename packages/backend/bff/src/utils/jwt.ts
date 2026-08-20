import { jwtVerify, SignJWT } from 'jose';

export interface SessionPayload {
  sub: string;
  email: string;
  name: string;
  picture?: string;
  provider: string;
  iat?: number;
  exp?: number;
}

const isString = (value: unknown): value is string => typeof value === 'string';

const isNumberOrUndefined = (value: unknown): value is number | undefined =>
  value === undefined || typeof value === 'number';

export async function createSessionToken(
  payload: Omit<SessionPayload, 'iat' | 'exp'>,
  secret: string,
  durationHours: number,
  issuer?: string
): Promise<string> {
  const secretKey = new TextEncoder().encode(secret);

  return await new SignJWT(payload)
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime(`${durationHours}h`)
    .setIssuer(issuer || 'hierarchidb-bff')
    .sign(secretKey);
}

export async function verifySessionToken(
  token: string,
  secret: string,
  issuer?: string
): Promise<SessionPayload> {
  const secretKey = new TextEncoder().encode(secret);

  const { payload } = await jwtVerify(token, secretKey, {
    issuer: issuer || 'hierarchidb-bff',
  });

  if (
    !payload ||
    typeof payload !== 'object' ||
    !isString(payload.sub) ||
    !isString(payload.email) ||
    !isString(payload.name) ||
    !isString(payload.provider) ||
    !isNumberOrUndefined(payload.iat) ||
    !isNumberOrUndefined(payload.exp) ||
    ('picture' in payload && !isString(payload.picture))
  ) {
    throw new Error('Invalid session token payload');
  }
  const picture = isString(payload.picture) ? payload.picture : undefined;

  return {
    sub: payload.sub,
    email: payload.email,
    name: payload.name,
    picture,
    provider: payload.provider,
    iat: payload.iat,
    exp: payload.exp,
  };
}

export function extractBearerToken(authHeader: string | undefined): string | null {
  if (!authHeader) return null;

  const match = authHeader.match(/^Bearer (.+)$/i);
  return match ? match[1] || null : null;
}
