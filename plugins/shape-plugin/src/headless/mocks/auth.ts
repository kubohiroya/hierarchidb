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

  setBuildSessionContext(_nodeId: string, _sessionId: string, _sessionStartedAt: number): void {
    // no-op for headless tests
  }

  clearBuildSessionContext(): void {
    // no-op for headless tests
  }
}

// Legacy alias
export class AuthRecoveryService extends AuthService {}
