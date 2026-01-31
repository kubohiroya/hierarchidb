export class AuthService {
  static async getSingleton(): Promise<AuthService> {
    return new AuthService();
  }

  async fetchWithAuth(url: string, init: RequestInit = {}, _ctx?: unknown): Promise<Response> {
    return fetch(url, init);
  }

  getAuthHeaders(): Record<string, string> {
    return {};
  }

  setToken(_token: string, _type?: 'Bearer' | 'Basic', _expiresAt?: number): void {
    // no-op (mock)
  }
}

// Legacy alias
export class AuthRecoveryService extends AuthService {}
