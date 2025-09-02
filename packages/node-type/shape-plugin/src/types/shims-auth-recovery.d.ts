declare module '@hierarchidb/auth-recovery' {
  export class AuthRecoveryService {
    static getSingleton(): Promise<AuthRecoveryService>;
    setToken(token: string, type?: 'Bearer' | 'Basic', expiresAt?: number): void;
    getAuthHeaders(): Record<string, string>;
    fetchWithAuth(url: string, init?: RequestInit, ctx?: { sessionId?: string; pluginType?: 'shape' | 'spreadsheet' | 'styler' | 'generic'; maxRetries?: number }): Promise<Response>;
  }
  export const featureDefinition: any;
}
