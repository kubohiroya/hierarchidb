export interface SessionPayload {
    sub: string;
    email: string;
    name: string;
    picture?: string;
    provider: string;
    iat?: number;
    exp?: number;
}
export declare function createSessionToken(payload: Omit<SessionPayload, 'iat' | 'exp'>, secret: string, durationHours?: number, issuer?: string): Promise<string>;
export declare function verifySessionToken(token: string, secret: string, issuer?: string): Promise<SessionPayload>;
export declare function extractBearerToken(authHeader: string | undefined): string | null;
//# sourceMappingURL=jwt.d.ts.map