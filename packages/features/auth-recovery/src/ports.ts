export type AuthScope = 'shape' | 'location' | 'route' | 'spreadsheet' | 'styler' | 'generic';

export interface AuthContext {
  sessionId?: string;
  scope?: AuthScope;
  maxRetries?: number;
}

export interface AuthHeadersProvider {
  getAuthHeaders(): Record<string, string>;

  setToken(token: string, type?: 'Bearer' | 'Basic', expiresAt?: number): void;
}
