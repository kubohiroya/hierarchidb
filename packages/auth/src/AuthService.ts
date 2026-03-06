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

type WorkerTokenRequestAPI = {
  requestAuthToken(): Promise<string | null>;
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
  private workerAPI?: WorkerTokenRequestAPI;

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
      onAuthSuccess: async (_notification: AuthSuccessNotification) => { },
      onAuthCancelled: async (_notification: AuthCancelledNotification) => { },
    });
  }

  setToken(token: string, _type: 'Bearer' | 'Basic' = 'Bearer', expiresAt?: number): void {
    const write = async (): Promise<void> => {
      let uiStorageSuccess = false;
      let localStorageSuccess = false;

      // First try uiStorage if available
      if (this.uiStorage) {
        try {
          await this.uiStorage.setItem('access_token', token);
          if (typeof expiresAt === 'number') {
            await this.uiStorage.setItem('token_expires_at', String(expiresAt));
          }
          uiStorageSuccess = true;
          if (this.isAuthDebugEnabled()) {
            console.debug('[auth][service] Token saved to uiStorage successfully');
          }
          return;
        } catch (error) {
          if (this.isAuthDebugEnabled()) {
            console.debug('[auth][service] uiStorage setItem failed, falling back to localStorage:', {
              error: error instanceof Error ? error.message : String(error),
            });
          }
          // Fall through to localStorage if uiStorage fails
        }
      }

      // Fallback to localStorage if available (main thread only)
      if (typeof localStorage !== 'undefined') {
        try {
          localStorage.setItem('access_token', token);
          if (typeof expiresAt === 'number') {
            localStorage.setItem('token_expires_at', String(expiresAt));
          }
          localStorageSuccess = true;
          if (this.isAuthDebugEnabled()) {
            console.debug('[auth][service] Token saved to localStorage successfully');
          }
        } catch (error) {
          if (this.isAuthDebugEnabled()) {
            console.debug('[auth][service] localStorage setItem failed:', {
              error: error instanceof Error ? error.message : String(error),
            });
          }
        }
      }

      // Verify token was actually saved by attempting to read it back
      if (uiStorageSuccess || localStorageSuccess) {
        try {
          const verifyToken = await this.resolveStoredToken();
          if (verifyToken !== token) {
            if (this.isAuthDebugEnabled()) {
              console.warn('[auth][service] Token verification failed - saved token does not match');
            }
            this.dispatchStorageWarning('Token verification failed after save');
          }
        } catch (error) {
          if (this.isAuthDebugEnabled()) {
            console.warn('[auth][service] Token verification failed with error:', {
              error: error instanceof Error ? error.message : String(error),
            });
          }
          this.dispatchStorageWarning('Token verification failed with error');
        }
      } else {
        if (this.isAuthDebugEnabled()) {
          console.warn('[auth][service] Token could not be saved to any storage');
        }
        this.dispatchStorageWarning('No storage available for token persistence');
      }
    };
    void write();
  }

  async setUiStorageBridge(bridge: UiStorageBridge): Promise<void> {
    console.debug('[auth][service] setUiStorageBridge called - setting up storage bridge');
    this.uiStorage = bridge;
    console.debug('[auth][service] uiStorage bridge set, syncing token from storage');
    await this.syncTokenFromStorage();
    console.debug('[auth][service] setUiStorageBridge completed');
  }

  setWorkerAPI(workerAPI: WorkerTokenRequestAPI): void {
    console.debug('[auth][service] setWorkerAPI called - setting up worker API');
    this.workerAPI = workerAPI;
    console.debug('[auth][service] workerAPI set successfully');
  }

  async getAuthHeaders(): Promise<Record<string, string>> {
    const storedToken = await this.resolveStoredToken();
    if (this.isAuthDebugEnabled()) {
      console.debug('[auth][service] getAuthHeaders:', {
        hasToken: Boolean(storedToken),
        hasUiStorage: Boolean(this.uiStorage),
        hasLocalStorage: typeof localStorage !== 'undefined',
      });
    }
    return storedToken ? { Authorization: `Bearer ${storedToken}` } : {};
  }

  private isAuthDebugEnabled(): boolean {
    try {
      // First try localStorage if available (main thread)
      if (typeof localStorage !== 'undefined') {
        const debugEnabled = localStorage.getItem('hidb_auth_debug') === '1';
        if (debugEnabled) {
          console.debug('[auth][service] Debug enabled via localStorage');
        }
        return debugEnabled;
      }

      // In worker environment, enable debug logging if uiStorage is available
      // This helps with debugging worker-side authentication issues
      const isWorkerEnvironment = (() => {
        try {
          return typeof (globalThis as any).importScripts !== 'undefined';
        } catch {
          return false;
        }
      })();

      if (isWorkerEnvironment) {
        // Always enable debug in worker environment to help diagnose token access issues
        console.debug('[auth][service] Debug force-enabled in worker environment for Issue #822 debugging');
        return true;
      }

      // Always log debug check status to help diagnose issues
      console.debug('[auth][service] Debug check status:', {
        hasLocalStorage: typeof localStorage !== 'undefined',
        hasUiStorage: Boolean(this.uiStorage),
        hasWorkerAPI: Boolean(this.workerAPI),
        isWorkerEnvironment,
      });

      return false;
    } catch (error) {
      // Always log debug check failures to help diagnose issues
      console.debug('[auth][service] isAuthDebugEnabled failed:', {
        error: error instanceof Error ? error.message : String(error),
        hasLocalStorage: typeof localStorage !== 'undefined',
        hasUiStorage: Boolean(this.uiStorage),
        isWorkerEnvironment: (() => {
          try {
            return typeof (globalThis as any).importScripts !== 'undefined';
          } catch {
            return false;
          }
        })(),
      });
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
            method: init.method || 'GET',
            isRetry: attempt > 0,
          });
        }

        const fetchRes = await fetch(url, { ...init, headers });

        if (this.isAuthDebugEnabled()) {
          console.debug('[auth][service] fetch response received', {
            scope,
            attempt,
            url,
            status: fetchRes.status,
            statusText: fetchRes.statusText,
            ok: fetchRes.ok,
            method: init.method || 'GET',
          });
        }

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
      console.debug('[auth][service] awaitAuth called - authentication required', {
        requestId,
        scope: ctx.scope,
        pluginType: pluginTypeNarrow,
        url,
        method: init.method || 'GET',
        hasUiStorage: Boolean(this.uiStorage),
        isWorkerEnvironment: (() => {
          try {
            return typeof (globalThis as any).importScripts !== 'undefined';
          } catch {
            return false;
          }
        })(),
        isMainThread: typeof window !== 'undefined',
        errorCode: params?.errorCode,
        errorMessage: params?.errorMessage,
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
    this.registry.dispatch(notification).catch(() => { });
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
    // First try uiStorage if available
    if (this.uiStorage) {
      try {
        await this.uiStorage.removeItem('access_token');
        await this.uiStorage.removeItem('token_expires_at');
        await this.uiStorage.removeItem('refresh_token_id');
        return;
      } catch {
        // Fall through to localStorage if uiStorage fails
      }
    }

    // Fallback to localStorage if available (main thread only)
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

  private dispatchStorageWarning(message: string): void {
    try {
      const notification = AuthNotificationFactory.createStorageWarning({
        message,
        timestamp: Date.now(),
      });
      this.registry.dispatch(notification).catch(() => {
        // ignore dispatch failures
      });
    } catch (error) {
      if (this.isAuthDebugEnabled()) {
        console.debug('[auth][service] Failed to dispatch storage warning:', {
          error: error instanceof Error ? error.message : String(error),
        });
      }
    }
  }

  private async resolveStoredToken(): Promise<string | null> {
    const isWorkerEnvironment = (() => {
      try {
        return typeof (globalThis as any).importScripts !== 'undefined';
      } catch {
        return false;
      }
    })();

    // Always log the token resolution attempt for debugging Issue #822
    console.debug('[auth][service] resolveStoredToken called:', {
      hasUiStorage: Boolean(this.uiStorage),
      hasLocalStorage: typeof localStorage !== 'undefined',
      hasWorkerAPI: Boolean(this.workerAPI),
      isWorkerEnvironment,
      isMainThread: typeof window !== 'undefined',
      debugEnabled: this.isAuthDebugEnabled(),
      timestamp: new Date().toISOString(),
    });

    // First try uiStorage if available
    if (this.uiStorage) {
      try {
        console.debug('[auth][service] Attempting uiStorage.getItem("access_token")');
        const token = await this.uiStorage.getItem('access_token');
        console.debug('[auth][service] resolveStoredToken from uiStorage:', {
          hasToken: Boolean(token),
          tokenLength: token?.length || 0,
          tokenPreview: token ? `${token.substring(0, 10)}...` : null,
          timestamp: new Date().toISOString(),
        });
        return token;
      } catch (error) {
        console.debug('[auth][service] uiStorage getItem failed, falling back to next method:', {
          error: error instanceof Error ? error.message : String(error),
          errorStack: error instanceof Error ? error.stack : undefined,
          timestamp: new Date().toISOString(),
        });
        // Fall through to next method
      }
    } else {
      console.debug('[auth][service] uiStorage not available, skipping to next method');
    }

    // Try worker API token request if available (shared-worker environment)
    if (this.workerAPI && isWorkerEnvironment) {
      try {
        console.debug('[auth][service] Attempting workerAPI.requestAuthToken() - Issue #822 debug');
        const token = await this.workerAPI.requestAuthToken();
        console.debug('[auth][service] resolveStoredToken from workerAPI:', {
          hasToken: Boolean(token),
          tokenLength: token?.length || 0,
          tokenPreview: token ? `${token.substring(0, 10)}...` : null,
          timestamp: new Date().toISOString(),
        });
        return token;
      } catch (error) {
        console.warn('[auth][service] workerAPI requestAuthToken failed - Issue #822 debug:', {
          error: error instanceof Error ? error.message : String(error),
          errorStack: error instanceof Error ? error.stack : undefined,
          timestamp: new Date().toISOString(),
        });
        // Fall through to localStorage
      }
    } else {
      if (isWorkerEnvironment && !this.uiStorage && !this.workerAPI) {
        console.warn('[auth][service] Worker environment detected but no uiStorage or workerAPI available - this will cause authentication failures - Issue #822');
      } else if (!isWorkerEnvironment) {
        console.debug('[auth][service] Not in worker environment, skipping workerAPI');
      } else if (!this.workerAPI) {
        console.debug('[auth][service] workerAPI not available, skipping to localStorage');
      }
    }

    // Fallback to localStorage if available (main thread only)
    if (typeof localStorage !== 'undefined') {
      try {
        console.debug('[auth][service] Attempting localStorage.getItem("access_token")');
        const token = localStorage.getItem('access_token');
        console.debug('[auth][service] resolveStoredToken from localStorage:', {
          hasToken: Boolean(token),
          tokenLength: token?.length || 0,
          tokenPreview: token ? `${token.substring(0, 10)}...` : null,
          timestamp: new Date().toISOString(),
        });
        return token;
      } catch (error) {
        console.debug('[auth][service] localStorage getItem failed:', {
          error: error instanceof Error ? error.message : String(error),
          timestamp: new Date().toISOString(),
        });
        // ignore storage failures
      }
    } else {
      console.debug('[auth][service] localStorage not available');
    }

    console.debug('[auth][service] resolveStoredToken: no storage available or no token found - Issue #822 debug:', {
      hasUiStorage: Boolean(this.uiStorage),
      hasWorkerAPI: Boolean(this.workerAPI),
      hasLocalStorage: typeof localStorage !== 'undefined',
      isWorkerEnvironment,
      timestamp: new Date().toISOString(),
    });
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
