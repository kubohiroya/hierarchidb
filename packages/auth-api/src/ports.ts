export type AuthScope = 'shape' | 'location' | 'route' | 'spreadsheet' | 'styler' | 'generic';

export interface AuthContext {
  sessionId?: string;
  /** Epoch ms when the build session started. Used to distinguish build attempts for auth dedup. */
  sessionStartedAt?: number;
  scope?: AuthScope;
  maxRetries?: number;
}

export interface AuthHeadersProvider {
  getAuthHeaders(): Promise<Record<string, string>>;

  setToken(token: string, type?: 'Bearer' | 'Basic', expiresAt?: number): void;
}
