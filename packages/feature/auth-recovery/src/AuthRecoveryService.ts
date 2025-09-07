import { SingletonMixin } from '@hierarchidb/util';
import type { AuthHeadersProvider, AuthContext, AuthPluginType } from './ports';
import { AuthNotificationRegistry, AuthNotificationFactory, AUTH_CONSTANTS } from '@hierarchidb/common-auth';
import type { PluginType } from '@hierarchidb/common-auth';

type Pending = {
  resolve: (r: Response) => void;
  reject: (e: Error) => void;
  timeout: any;
  context: { requestId: string; url: string; init: RequestInit; ctx: AuthContext };
};

export class AuthRecoveryService implements AuthHeadersProvider {
  private registry = AuthNotificationRegistry.getInstance();
  private pending = new Map<string, Pending>();
  private currentToken?: { token: string; type: 'Bearer' | 'Basic'; expiresAt?: number };

  static async getSingleton(): Promise<AuthRecoveryService> {
    return SingletonMixin.getSingleton(AuthRecoveryService.name, () => new AuthRecoveryService());
  }

  constructor() {
    // Listen for success/cancel notifications from UI
    this.registry.register('feature-auth-recovery', {
      onAuthRequired: async (_n: any) => {},
      onAuthSuccess: async (n: any) => this.onAuthSuccess(n.context.requestId, n.context.newToken, n.context.tokenType || 'Bearer', n.context.expiresAt),
      onAuthCancelled: async (n: any) => this.onAuthCancelled(n.context.requestId, n.context.reason),
    });
  }

  setToken(token: string, type: 'Bearer' | 'Basic' = 'Bearer', expiresAt?: number): void {
    this.currentToken = { token, type, expiresAt };
  }

  getAuthHeaders(): Record<string, string> {
    return this.currentToken?.token ? { Authorization: `${this.currentToken.type} ${this.currentToken.token}` } : {};
  }

  async fetchWithAuth(url: string, init: RequestInit = {}, ctx: AuthContext = {}): Promise<Response> {
    const maxRetries = ctx.maxRetries ?? AUTH_CONSTANTS.MAX_RETRY_COUNT;
    const pluginType: AuthPluginType = ctx.pluginType ?? 'shape';
    let attempt = 0;
    let lastErr: any;
    for (; attempt <= maxRetries; attempt++) {
      try {
        const headers = new Headers(init.headers as any);
        const auth = this.getAuthHeaders();
        Object.entries(auth).forEach(([k, v]) => headers.set(k, v));
        const res = await fetch(url, { ...init, headers });
        if (res.status !== 401) return res;
        // Trigger auth flow and await token
        const requestId = `auth-req-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
        await this.awaitAuth(requestId, url, init, { sessionId: ctx.sessionId, pluginType, maxRetries });
        // retry after success
        continue;
      } catch (e) {
        lastErr = e;
      }
    }
    throw lastErr ?? new Error('Authentication failed');
  }

  private async awaitAuth(requestId: string, url: string, init: RequestInit, ctx: AuthContext): Promise<Response> {
    // Narrow plugin type to common-auth.PluginType
    const pluginTypeNarrow: PluginType = ((): PluginType => {
      const p = ctx.pluginType ?? 'shape';
      return (p === 'shape' || p === 'spreadsheet' || p === 'styler') ? p : 'shape';
    })();
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
      this.registry.dispatch(notification).catch(() => {});
    });
  }

  private async onAuthSuccess(requestId: string, token: string, type: 'Bearer' | 'Basic', expiresAt?: number) {
    const p = this.pending.get(requestId);
    if (!p) return;
    clearTimeout(p.timeout);
    this.pending.delete(requestId);
    this.setToken(token, type, expiresAt);
    try {
      const headers = new Headers(p.context.init.headers as any);
      headers.set('Authorization', `${type} ${token}`);
      const res = await fetch(p.context.url, { ...p.context.init, headers });
      p.resolve(res);
    } catch (e: any) {
      p.reject(e instanceof Error ? e : new Error(String(e)));
    }
  }

  private onAuthCancelled(requestId: string, reason: string): void {
    const p = this.pending.get(requestId);
    if (!p) return;
    clearTimeout(p.timeout);
    this.pending.delete(requestId);
    p.reject(new Error(`Authentication cancelled: ${reason}`));
  }
}
