import { SingletonMixin } from '@hierarchidb/util';
import type { AuthContext, AuthHeadersProvider, AuthScope } from './ports.js';
import type {
  AuthCancelledNotification,
  AuthRequiredNotification,
  AuthSuccessNotification,
  PluginType,
} from '@hierarchidb/common-auth/AuthNotificationSystem';
import { AUTH_CONSTANTS, AuthNotificationFactory, AuthNotificationRegistry } from '@hierarchidb/common-auth/AuthNotificationSystem';

type Pending = {
  resolve: (r: Response) => void;
  reject: (e: Error) => void;
  timeout: ReturnType<typeof setTimeout>;
  context: { requestId: string; url: string; init: RequestInit; ctx: AuthContext };
};

/**
 * AuthService
 *
 * - 初回認証／トークン更新／401時の再認証を含めた「認証付きfetchの唯一の入口」
 * - 従来名(AuthRecoveryService)は互換のため別名クラスとして残す
 */
export class AuthService implements AuthHeadersProvider {
  private registry = AuthNotificationRegistry.getInstance();
  private pending = new Map<string, Pending>();
  private currentToken?: { token: string; type: 'Bearer' | 'Basic'; expiresAt?: number };

  // Prevent immediate re-prompt loops after user cancels.
  private cancelledUntilByScope = new Map<AuthScope, number>();

  // Coalesce concurrent auth prompts per scope.
  private inFlightAuthByScope = new Map<AuthScope, Promise<Response>>();

  static async getSingleton(): Promise<AuthService> {
    // Keep singleton key stable so existing instances are reused.
    return SingletonMixin.getSingleton('AuthRecoveryService', () => new AuthService());
  }

  constructor() {
    // Listen for success/cancel notifications from UI (bridged via common-auth).
    this.registry.register('features-auth-recovery', {
      onAuthRequired: async (_notification: AuthRequiredNotification) => {
        // No-op: the fetcher initiates auth flows directly via awaitAuth.
      },
      onAuthSuccess: async (notification: AuthSuccessNotification) => this.onAuthSuccess(
        notification.context.requestId,
        notification.context.newToken,
        notification.context.tokenType || 'Bearer',
        notification.context.expiresAt,
      ),
      onAuthCancelled: async (notification: AuthCancelledNotification) => this.onAuthCancelled(
        notification.context.requestId,
        notification.context.reason,
      ),
    });
  }

  setToken(token: string, type: 'Bearer' | 'Basic' = 'Bearer', expiresAt?: number): void {
    this.currentToken = { token, type, expiresAt };
  }

  getAuthHeaders(): Record<string, string> {
    // Fallback: if no in-memory token, reuse BFF access_token persisted by UI (sessionStorage/localStorage).
    if (!this.currentToken?.token) {
      const storedToken =
        (typeof sessionStorage !== 'undefined' && sessionStorage.getItem('access_token')) ||
        (typeof localStorage !== 'undefined' && localStorage.getItem('access_token'));
      if (storedToken) {
        this.setToken(storedToken, 'Bearer');
      }
    }
    return this.currentToken?.token ? { Authorization: `${this.currentToken.type} ${this.currentToken.token}` } : {};
  }

  private isAuthDebugEnabled(): boolean {
    try {
      return typeof localStorage !== 'undefined' && localStorage.getItem('hidb_auth_debug') === '1';
    } catch {
      return false;
    }
  }

  async fetchWithAuth(url: string, init: RequestInit = {}, ctx: AuthContext = {}): Promise<Response> {
    const maxRetries = ctx.maxRetries ?? AUTH_CONSTANTS.MAX_RETRY_COUNT;
    const scope: AuthScope = ctx.scope ?? 'shape';
    let attempt = 0;
    let lastErr: unknown;
    for (; attempt <= maxRetries; attempt++) {
      try {
        const headers = new Headers(init.headers);
        const auth = this.getAuthHeaders();
        Object.entries(auth).forEach(([k, v]) => headers.set(k, v));

        // If we're about to call a CORS proxy endpoint without a token, prompt auth first.
        // This avoids a guaranteed 401 round-trip and reduces the chance of "Loading..." stalls.
        if (!headers.has('Authorization') && isLikelyCorsProxyUrl(url)) {
          if (this.isCancelledCooldownActive(scope)) {
            throw new Error(`Authentication was cancelled for scope "${scope}"`);
          }

          const inFlight = this.inFlightAuthByScope.get(scope);
          if (inFlight) {
            return await inFlight;
          }

          if (this.isAuthDebugEnabled()) {
            console.debug('[auth][service] no token for cors-proxy url -> awaiting auth (preflight)', { scope, url });
          }
          const requestId = `auth-req-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
          const authPromise = this.awaitAuth(requestId, url, init, { sessionId: ctx.sessionId, scope, maxRetries })
            .finally(() => {
              this.inFlightAuthByScope.delete(scope);
            });
          this.inFlightAuthByScope.set(scope, authPromise);
          // Wait for auth (or cancellation), then retry loop will continue.
          await authPromise;
          continue;
        }

        if (this.isAuthDebugEnabled()) {
          let hasStoredToken = false;
          try {
            const s = typeof sessionStorage !== 'undefined' ? sessionStorage.getItem('access_token') : null;
            const l = typeof localStorage !== 'undefined' ? localStorage.getItem('access_token') : null;
            hasStoredToken = Boolean(s || l);
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

        const res = await fetch(url, { ...init, headers });
        if (res.status !== 401) return res;

        if (this.isAuthDebugEnabled()) {
          console.debug('[auth][service] 401 received -> awaiting auth', { scope, url });
        }
        const requestId = `auth-req-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
        await this.awaitAuth(requestId, url, init, { sessionId: ctx.sessionId, scope, maxRetries });
      } catch (error) {
        lastErr = error;
      }
    }
    if (lastErr instanceof Error) throw lastErr;
    throw new Error(lastErr === undefined ? 'Authentication failed' : String(lastErr));
  }

  private async awaitAuth(requestId: string, url: string, init: RequestInit, ctx: AuthContext): Promise<Response> {
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
      source: 'worker',
      requestId,
      url,
      method: init.method || 'GET',
      errorCode: 401,
      errorMessage: 'Unauthorized',
      sessionId: ctx.sessionId,
      pluginType: pluginTypeNarrow,
      retryCount: 0,
    });

    return new Promise<Response>((resolve, reject) => {
      const timeout = setTimeout(() => {
        this.pending.delete(requestId);
        reject(new Error('Authentication timeout'));
      }, AUTH_CONSTANTS.DEFAULT_TIMEOUT);
      this.pending.set(requestId, { resolve, reject, timeout, context: { requestId, url, init, ctx } });
      this.registry.dispatch(notification).catch(() => {
      });
    });
  }

  private async onAuthSuccess(requestId: string, token: string, type: 'Bearer' | 'Basic', expiresAt?: number) {
    const p = this.pending.get(requestId);
    if (!p) return;
    clearTimeout(p.timeout);
    this.pending.delete(requestId);
    this.setToken(token, type, expiresAt);
    try {
      const headers = new Headers(p.context.init.headers);
      headers.set('Authorization', `${type} ${token}`);
      const res = await fetch(p.context.url, { ...p.context.init, headers });
      p.resolve(res);
    } catch (error) {
      p.reject(error instanceof Error ? error : new Error(String(error)));
    }
  }

  private onAuthCancelled(requestId: string, reason: string): void {
    const p = this.pending.get(requestId);
    if (!p) return;
    clearTimeout(p.timeout);
    this.pending.delete(requestId);

    // Apply short cooldown to avoid immediately re-opening auth dialog.
    const scope = (p.context.ctx.scope ?? 'shape') as AuthScope;
    this.cancelledUntilByScope.set(scope, Date.now() + 60_000); // 60s

    p.reject(new Error(`Authentication cancelled: ${reason}`));
  }

  private isCancelledCooldownActive(scope: AuthScope): boolean {
    const until = this.cancelledUntilByScope.get(scope);
    if (!until) return false;
    return Date.now() < until;
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
