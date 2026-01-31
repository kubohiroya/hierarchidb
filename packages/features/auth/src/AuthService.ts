import { SingletonMixin } from '@hierarchidb/util';
import type {
  AuthCancelledNotification,
  AuthContext,
  AuthHeadersProvider,
  AuthRequiredNotification,
  AuthScope,
  AuthSource,
  AuthSuccessNotification,
  PluginType,
} from '@hierarchidb/auth-api';
import { AuthNotificationFactory, AuthNotificationRegistry } from './AuthNotificationSystem.js';

type UiStorageBridge = {
  getItem(key: string): Promise<string | null>;
  setItem(key: string, value: string): Promise<void>;
  removeItem(key: string): Promise<void>;
};

class AuthRequiredError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'AuthRequiredError';
  }
}

/**
 * AuthService
 *
 * - Single entry point for authenticated fetches, including initial auth, refresh, and 401 recovery.
 * - Keeps the legacy AuthRecoveryService name available for compatibility.
 */
export class AuthService implements AuthHeadersProvider {
  private registry = AuthNotificationRegistry.getInstance();
  private uiStorage?: UiStorageBridge;

  // Prevent immediate re-prompt loops after user cancels.
  private cancelledUntilByScope = new Map<AuthScope, number>();


  static async getSingleton(): Promise<AuthService> {
    // Keep singleton key stable so existing instances are reused.
    return SingletonMixin.getSingleton('AuthRecoveryService', () => new AuthService());
  }

  constructor() {
    this.registry.register('features-auth', {
      onAuthRequired: async (_notification: AuthRequiredNotification) => {
        // No-op: the fetcher initiates auth flows directly via awaitAuth.
      },
      onAuthSuccess: async (_notification: AuthSuccessNotification) => {},
      onAuthCancelled: async (_notification: AuthCancelledNotification) => {},
    });
  }

  setToken(token: string, _type: 'Bearer' | 'Basic' = 'Bearer', expiresAt?: number): void {
    const write = async (): Promise<void> => {
      if (this.uiStorage) {
        await this.uiStorage.setItem('access_token', token);
        if (typeof expiresAt === 'number') {
          await this.uiStorage.setItem('token_expires_at', String(expiresAt));
        }
        return;
      }
      if (typeof localStorage !== 'undefined') {
        localStorage.setItem('access_token', token);
        if (typeof expiresAt === 'number') {
          localStorage.setItem('token_expires_at', String(expiresAt));
        }
      }
    };
    void write();
  }

  async setUiStorageBridge(bridge: UiStorageBridge): Promise<void> {
    this.uiStorage = bridge;
    await this.syncTokenFromStorage();
  }

  async getAuthHeaders(): Promise<Record<string, string>> {
    const storedToken = await this.resolveStoredToken();
    return storedToken ? { Authorization: `Bearer ${storedToken}` } : {};
  }

  private isAuthDebugEnabled(): boolean {
    try {
      return typeof localStorage !== 'undefined' && localStorage.getItem('hidb_auth_debug') === '1';
    } catch {
      return false;
    }
  }

  async fetchWithAuth(url: string, init: RequestInit = {}, ctx: AuthContext = {}): Promise<Response> {
    const maxRetries = ctx.maxRetries ?? 3;
    const scope: AuthScope = ctx.scope ?? 'shape';
    let attempt = 0;
    let lastErr: unknown;
    for (; attempt <= maxRetries; attempt++) {
      try {
        const headers = new Headers(init.headers);
        const auth = await this.getAuthHeaders();
        Object.entries(auth).map(([k, v]) => headers.set(k, v));

        if (this.isAuthDebugEnabled()) {
          let hasStoredToken = false;
          try {
            const storedToken = await this.resolveStoredToken();
            hasStoredToken = Boolean(storedToken);
          } catch {
            // ignore
          }
           console.debug('[auth][service] fetchWithAuth attempt', {
             scope,
             attempt,
             url,
             hasAuthorization: headers.has('Authorization'),
            hasStoredToken,
           });
         }

        const fetchRes = await fetch(url, { ...init, headers });
        if (fetchRes.status !== 401) return fetchRes;
        await this.clearStoredToken();

        if (this.isAuthDebugEnabled()) {
          console.debug('[auth][service] 401 received -> awaiting auth', { scope, url });
        }
        const requestId = `auth-req-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
        const authRes = await this.awaitAuth(requestId, url, init, { sessionId: ctx.sessionId, scope, maxRetries }, {
          errorCode: 401,
          errorMessage: 'Unauthorized',
          source: isLikelyCorsProxyUrl(url) ? 'cors-proxy' : 'external-api',
        });
        if (authRes.status !== 401) return authRes;
        lastErr = new Error(`HTTP ${authRes.status}`);
      } catch (error) {
        if (error instanceof AuthRequiredError) {
          throw error;
        }
        lastErr = error;
      }
    }
    if (lastErr instanceof Error) throw lastErr;
    throw new Error(lastErr === undefined ? 'Authentication failed' : String(lastErr));
  }

  private async awaitAuth(
    requestId: string,
    url: string,
    init: RequestInit,
    ctx: AuthContext,
    params?: {
      errorCode?: number;
      errorMessage?: string;
      source?: AuthSource;
      retryCount?: number;
    },
  ): Promise<Response> {
    const scope = (ctx.scope ?? 'shape') as AuthScope;
    if (this.isCancelledCooldownActive(scope)) {
      throw new Error(`Authentication was cancelled for scope "${scope}"`);
    }
    const pluginTypeNarrow: PluginType = ((): PluginType => {
      const p = ctx.scope ?? 'shape';
      return (p === 'shape' || p === 'location' || p === 'route' || p === 'spreadsheet' || p === 'styler') ? p : 'shape';
    })();

    if (this.isAuthDebugEnabled()) {
      console.debug('[auth][service] dispatching AUTH_REQUIRED', {
        requestId,
        scope: ctx.scope,
        pluginType: pluginTypeNarrow,
        url,
      });
    }

    const notification = AuthNotificationFactory.createAuthRequired({
      source: params?.source ?? 'worker',
      requestId,
      url,
      method: init.method || 'GET',
      errorCode: params?.errorCode ?? 401,
      errorMessage: params?.errorMessage ?? 'Unauthorized',
      sessionId: ctx.sessionId,
      pluginType: pluginTypeNarrow,
      retryCount: params?.retryCount ?? 0,
    });

    void requestId;
    void url;
    void init;
    void ctx;
    this.registry.dispatch(notification).catch(() => {});
    throw new AuthRequiredError('Authentication required');
  }

  private isCancelledCooldownActive(scope: AuthScope): boolean {
    const until = this.cancelledUntilByScope.get(scope);
    if (!until) return false;
    return Date.now() < until;
  }

  private async syncTokenFromStorage(): Promise<void> {
    // No-op: token is always read from storage on demand.
  }

  private async clearStoredToken(): Promise<void> {
    if (this.uiStorage) {
      try {
        await this.uiStorage.removeItem('access_token');
        await this.uiStorage.removeItem('token_expires_at');
        await this.uiStorage.removeItem('refresh_token_id');
        return;
      } catch {
        // fall through
      }
    }
    if (typeof localStorage !== 'undefined') {
      try {
        localStorage.removeItem('access_token');
        localStorage.removeItem('token_expires_at');
        localStorage.removeItem('refresh_token_id');
      } catch {
        // ignore storage failures
      }
    }
  }

  private async resolveStoredToken(): Promise<string | null> {
    if (this.uiStorage) {
      try {
        return await this.uiStorage.getItem('access_token');
      } catch {
        return null;
      }
    }
    if (typeof localStorage !== 'undefined') {
      try {
        return localStorage.getItem('access_token');
      } catch {
        return null;
      }
    }
    return null;
  }
}

function isLikelyCorsProxyUrl(url: string): boolean {
  try {
    const parsed = new URL(url);
    // Query-based proxy pattern: https://<proxy>/?url=<target>
    if (!parsed.searchParams.has('url')) return false;
    const host = parsed.host.toLowerCase();
    return host.includes('cors-proxy') || host.includes('workers.dev');
  } catch {
    return false;
  }
}
