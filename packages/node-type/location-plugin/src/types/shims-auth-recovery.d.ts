declare module '@hierarchidb/auth-recovery' {
  export class AuthRecoveryService {
    static getSingleton(): Promise<AuthRecoveryService>;
    fetchWithAuth(url: string, init?: RequestInit, ctx?: { pluginType?: 'generic' | 'shape' | 'spreadsheet' | 'styler'; sessionId?: string }): Promise<Response>;
  }
}
