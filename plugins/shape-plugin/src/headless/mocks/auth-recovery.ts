export class AuthRecoveryService {
  static async getSingleton(): Promise<AuthRecoveryService> {
    return new AuthRecoveryService();
  }

  async fetchWithAuth(url: string, init: RequestInit = {}): Promise<Response> {
    return fetch(url, init);
  }
}
