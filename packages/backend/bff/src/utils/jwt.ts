import { SignJWT, jwtVerify } from 'jose';

export interface SessionPayload {
  sub: string;
  email: string;
  name: string;
  picture?: string;
  provider: string;
  iat?: number;
  exp?: number;
}

export async function createSessionToken(
  payload: Omit<SessionPayload, 'iat' | 'exp'>,
  secret: string,
  durationHours: number = 24,
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

  return payload as unknown as SessionPayload;
}

export function extractBearerToken(authHeader: string | undefined): string | null {
  if (!authHeader) return null;

  const match = authHeader.match(/^Bearer (.+)$/i);
  return match ? match[1] || null : null;
}
