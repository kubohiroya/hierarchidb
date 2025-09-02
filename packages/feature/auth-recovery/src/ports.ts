export type AuthPluginType = 'shape' | 'spreadsheet' | 'styler' | 'generic';

export interface AuthContext {
  sessionId?: string;
  pluginType?: AuthPluginType;
  maxRetries?: number;
}

export interface AuthHeadersProvider {
  getAuthHeaders(): Record<string, string>;
  setToken(token: string, type?: 'Bearer' | 'Basic', expiresAt?: number): void;
}

