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
import { SingletonMixin } from '@hierarchidb/util';
import { AuthNotificationFactory, AuthNotificationRegistry } from './AuthNotificationSystem.js';

type UiStorageBridge = {
  getItem(key: string): Promise<string | null>;
  removeItem(key: string): Promise<void>;
};

type WorkerGlobalCandidate = typeof globalThis & {
  importScripts?: unknown;
};

const isWorkerEnvironmentGlobal = (): boolean => {
  try {
    return typeof (globalThis as WorkerGlobalCandidate).importScripts !== 'undefined';
  } catch {
    return false;
  }
};

export class AuthRequiredError extends Error {
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
  private uiStorageRegistrationVersion = 0;

  /**
   * Active build-session context set by the build pipeline before tasks start.
   * Used to populate AUTH_REQUIRED notifications with session identity so the
   * UI can deduplicate / suppress repeated auth dialogs per build attempt.
   */
  private buildSessionContext: { sessionId: string; sessionStartedAt: number } | null = null;

  static async getSingleton(): Promise<AuthService> {
    // Keep singleton key stable so existing instances are reused.
    return SingletonMixin.getSingleton('AuthRecoveryService', () => new AuthService());
  }

  constructor() {
    this.registry.register('features-auth', {
      onAuthRequired: async (_notification: AuthRequiredNotification) => {
        // No-op: the fetcher initiates auth flows directly via awaitAuth.
      },
      onAuthSuccess: async (_notification: AuthSuccessNotification) => {
        // The UI persists the complete canonical session before broadcasting success.
        // Workers read that session through the registered read-only bridge.
      },
      onAuthCancelled: async (_notification: AuthCancelledNotification) => {
        // No-op: parallel task suppression is handled by useAuthRequiredDialogHost
        // (activeRequestIdRef + pendingCountBySessionRef).
      },
    });
  }

  /**
   * Set the active build-session context. Called by the build pipeline at
   * session start so that all subsequent AUTH_REQUIRED notifications carry
   * the session identity (nodeId + startedAt epoch).
   */
  setBuildSessionContext(sessionId: string, sessionStartedAt: number): void {
    this.buildSessionContext = { sessionId, sessionStartedAt };
  }

  /**
   * Clear the active build-session context. Called when the build session
   * completes or is cancelled.
   */
  clearBuildSessionContext(): void {
    this.buildSessionContext = null;
  }

  async setUiStorageBridge(bridge: UiStorageBridge): Promise<void> {
    console.debug('[auth][service] setUiStorageBridge called - setting up storage bridge');
    const registrationVersion = this.uiStorageRegistrationVersion + 1;
    this.uiStorageRegistrationVersion = registrationVersion;
    console.debug('[auth][service] validating token from candidate storage bridge');
    await this.validateUiStorageBridge(bridge);
    if (registrationVersion !== this.uiStorageRegistrationVersion) return;
    this.uiStorage = bridge;
    console.debug('[auth][service] setUiStorageBridge completed');
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
      const isWorkerEnvironment = isWorkerEnvironmentGlobal();

      if (isWorkerEnvironment) {
        // Always enable debug in worker environment to help diagnose token access issues
        console.debug(
          '[auth][service] Debug force-enabled in worker environment for Issue #822 debugging'
        );
        return true;
      }

      // Always log debug check status to help diagnose issues
      console.debug('[auth][service] Debug check status:', {
        hasLocalStorage: typeof localStorage !== 'undefined',
        hasUiStorage: Boolean(this.uiStorage),
        isWorkerEnvironment,
      });

      return false;
    } catch (error) {
      // Always log debug check failures to help diagnose issues
      console.debug('[auth][service] isAuthDebugEnabled failed:', {
        error: error instanceof Error ? error.message : String(error),
        hasLocalStorage: typeof localStorage !== 'undefined',
        hasUiStorage: Boolean(this.uiStorage),
        isWorkerEnvironment: isWorkerEnvironmentGlobal(),
      });
      return false;
    }
  }

  async fetchWithAuth(
    url: string,
    init: RequestInit = {},
    ctx: AuthContext = {}
  ): Promise<Response> {
    // Resolve session identity: explicit ctx wins, then buildSessionContext.
    const sessionId = ctx.sessionId ?? this.buildSessionContext?.sessionId;
    const sessionStartedAt = ctx.sessionStartedAt ?? this.buildSessionContext?.sessionStartedAt;
    const maxRetries = ctx.maxRetries ?? 3;
    const scope: AuthScope = ctx.scope ?? 'shape';
    let attempt = 0;
    let lastErr: unknown;

    // Issue #823: Enhanced debug logging for worker token request flow
    const isWorkerEnvironment = isWorkerEnvironmentGlobal();

    if (this.isAuthDebugEnabled()) {
      console.debug('[auth][service] fetchWithAuth starting - Issue #823 debug:', {
        scope,
        url,
        method: init.method || 'GET',
        maxRetries,
        isWorkerEnvironment,
        hasUiStorage: Boolean(this.uiStorage),
        timestamp: new Date().toISOString(),
      });
    }

    for (; attempt <= maxRetries; attempt++) {
      try {
        const headers = new Headers(init.headers);

        // Issue #823: Detailed token resolution logging
        const tokenResolutionStart = performance.now();
        const auth = await this.getAuthHeaders();
        const tokenResolutionEnd = performance.now();

        Object.entries(auth).map(([k, v]) => headers.set(k, v));

        if (this.isAuthDebugEnabled()) {
          let hasStoredToken = false;
          let tokenSource = 'none';
          try {
            const storedToken = await this.resolveStoredToken();
            hasStoredToken = Boolean(storedToken);
            if (storedToken) {
              if (this.uiStorage) {
                tokenSource = 'uiStorage';
              } else if (typeof localStorage !== 'undefined') {
                tokenSource = 'localStorage';
              }
            }
          } catch {
            // ignore
          }
          console.debug('[auth][service] fetchWithAuth attempt - Issue #823 debug:', {
            scope,
            attempt,
            url,
            hasAuthorization: headers.has('Authorization'),
            hasStoredToken,
            tokenSource,
            tokenResolutionTimeMs: Math.round(tokenResolutionEnd - tokenResolutionStart),
            method: init.method || 'GET',
            isRetry: attempt > 0,
            isWorkerEnvironment,
            timestamp: new Date().toISOString(),
          });
        }

        const fetchStart = performance.now();
        const fetchRes = await fetch(url, { ...init, headers });
        const fetchEnd = performance.now();

        if (this.isAuthDebugEnabled()) {
          console.debug('[auth][service] fetch response received - Issue #823 debug:', {
            scope,
            attempt,
            url,
            status: fetchRes.status,
            statusText: fetchRes.statusText,
            ok: fetchRes.ok,
            method: init.method || 'GET',
            fetchTimeMs: Math.round(fetchEnd - fetchStart),
            isWorkerEnvironment,
            timestamp: new Date().toISOString(),
          });
        }

        if (fetchRes.status !== 401) return fetchRes;
        await this.clearStoredToken();

        if (this.isAuthDebugEnabled()) {
          console.debug('[auth][service] 401 received -> awaiting auth - Issue #823 debug:', {
            scope,
            url,
            attempt,
            isWorkerEnvironment,
            timestamp: new Date().toISOString(),
          });
        }
        const requestId = `auth-req-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
        const authRes = await this.awaitAuth(
          requestId,
          url,
          init,
          { sessionId, sessionStartedAt, scope, maxRetries },
          {
            errorCode: 401,
            errorMessage: 'Unauthorized',
            source: isLikelyCorsProxyUrl(url) ? 'cors-proxy' : 'external-api',
          }
        );
        if (authRes.status !== 401) return authRes;
        lastErr = new Error(`HTTP ${authRes.status}`);
      } catch (error) {
        if (this.isAuthDebugEnabled()) {
          console.debug('[auth][service] fetchWithAuth error - Issue #823 debug:', {
            scope,
            attempt,
            url,
            error: error instanceof Error ? error.message : String(error),
            errorName: error instanceof Error ? error.name : 'unknown',
            isAuthRequiredError: error instanceof AuthRequiredError,
            isWorkerEnvironment,
            timestamp: new Date().toISOString(),
          });
        }
        if (error instanceof AuthRequiredError) {
          throw error;
        }
        lastErr = error;
      }
    }

    if (this.isAuthDebugEnabled()) {
      console.debug('[auth][service] fetchWithAuth exhausted retries - Issue #823 debug:', {
        scope,
        url,
        maxRetries,
        finalAttempt: attempt,
        lastError: lastErr instanceof Error ? lastErr.message : String(lastErr),
        isWorkerEnvironment,
        timestamp: new Date().toISOString(),
      });
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
    }
  ): Promise<Response> {
    const pluginTypeNarrow: PluginType = ((): PluginType => {
      const p = ctx.scope ?? 'shape';
      return p === 'shape' ||
        p === 'location' ||
        p === 'route' ||
        p === 'spreadsheet' ||
        p === 'styler'
        ? p
        : 'shape';
    })();

    if (this.isAuthDebugEnabled()) {
      console.debug('[auth][service] awaitAuth called - authentication required', {
        requestId,
        scope: ctx.scope,
        pluginType: pluginTypeNarrow,
        url,
        method: init.method || 'GET',
        hasUiStorage: Boolean(this.uiStorage),
        isWorkerEnvironment: isWorkerEnvironmentGlobal(),
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
      sessionStartedAt: ctx.sessionStartedAt,
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

  private async validateUiStorageBridge(bridge: UiStorageBridge): Promise<void> {
    const token = await bridge.getItem('access_token');
    await this.validateTokenExpiration(token ?? '', 'uiStorage', bridge);
  }

  private async clearStoredToken(
    storageBridge: UiStorageBridge | null = this.uiStorage ?? null
  ): Promise<void> {
    if (storageBridge) {
      await storageBridge.removeItem('access_token');
      return;
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

  private async validateTokenExpiration(
    token: string,
    source: string,
    storageBridge: UiStorageBridge | null
  ): Promise<string | null> {
    if (!token) return null;

    let storedExpiresAt: string | null = null;
    if (storageBridge) {
      storedExpiresAt = await storageBridge.getItem('token_expires_at');
    } else if (typeof localStorage !== 'undefined') {
      storedExpiresAt = localStorage.getItem('token_expires_at');
    }

    if (storageBridge) {
      if (storedExpiresAt === null) {
        throw new Error('Invalid auth session bridge contract: token_expires_at is required');
      }
      const expiresAt = Number(storedExpiresAt);
      if (!Number.isInteger(expiresAt) || expiresAt <= 0) {
        throw new Error(
          'Invalid auth session bridge contract: token_expires_at must be a positive integer'
        );
      }
    }

    const expired = isTokenExpired(token, storedExpiresAt || undefined);
    const now = Math.floor(Date.now() / 1000);

    console.debug('[auth][service] Token expiration check - Issue #827:', {
      source,
      hasToken: Boolean(token),
      tokenLength: token.length,
      tokenPreview: `${token.substring(0, 10)}...`,
      storedExpiresAt,
      expired,
      currentTimestamp: now,
      timestamp: new Date().toISOString(),
    });

    if (expired === true) {
      console.debug(
        '[auth][service] Token expired, clearing storage and returning null - Issue #827:',
        {
          source,
          storedExpiresAt,
          currentTimestamp: now,
        }
      );

      await this.clearStoredToken(storageBridge);
      return null;
    }

    if (expired === null) {
      console.debug(
        '[auth][service] Cannot determine token expiration, proceeding with token - Issue #827:',
        {
          source,
          hasStoredExpiration: Boolean(storedExpiresAt),
          isJwtFormat: token.split('.').length === 3,
        }
      );
    }

    return token;
  }

  private async resolveStoredToken(): Promise<string | null> {
    const isWorkerEnvironment = isWorkerEnvironmentGlobal();

    // Issue #823: Enhanced debug logging for token resolution flow
    const resolutionStart = performance.now();
    console.debug('[auth][service] resolveStoredToken called - Issue #823 debug:', {
      hasUiStorage: Boolean(this.uiStorage),
      hasLocalStorage: typeof localStorage !== 'undefined',
      isWorkerEnvironment,
      isMainThread: typeof window !== 'undefined',
      debugEnabled: this.isAuthDebugEnabled(),
      timestamp: new Date().toISOString(),
      resolutionStartTime: resolutionStart,
    });

    // First try uiStorage if available
    const storageBridge = this.uiStorage;
    if (storageBridge) {
      console.debug(
        '[auth][service] Attempting uiStorage.getItem("access_token") - Issue #823 debug'
      );
      const uiStorageStart = performance.now();
      const token = await storageBridge.getItem('access_token');
      const uiStorageEnd = performance.now();
      console.debug('[auth][service] resolveStoredToken from uiStorage - Issue #823 debug:', {
        hasToken: Boolean(token),
        tokenLength: token?.length || 0,
        tokenPreview: token ? `${token.substring(0, 10)}...` : null,
        uiStorageTimeMs: Math.round(uiStorageEnd - uiStorageStart),
        totalTimeMs: Math.round(uiStorageEnd - resolutionStart),
        timestamp: new Date().toISOString(),
      });

      return this.validateTokenExpiration(token || '', 'uiStorage', storageBridge);
    } else {
      console.debug(
        '[auth][service] uiStorage not available, skipping to next method - Issue #823 debug'
      );
    }

    // Fallback to localStorage if available (main thread only)
    if (typeof localStorage !== 'undefined') {
      console.debug(
        '[auth][service] Attempting localStorage.getItem("access_token") - Issue #823 debug'
      );
      const localStorageStart = performance.now();
      const token = localStorage.getItem('access_token');
      const localStorageEnd = performance.now();
      console.debug('[auth][service] resolveStoredToken from localStorage - Issue #823 debug:', {
        hasToken: Boolean(token),
        tokenLength: token?.length || 0,
        tokenPreview: token ? `${token.substring(0, 10)}...` : null,
        localStorageTimeMs: Math.round(localStorageEnd - localStorageStart),
        totalTimeMs: Math.round(localStorageEnd - resolutionStart),
        timestamp: new Date().toISOString(),
      });

      return this.validateTokenExpiration(token || '', 'localStorage', null);
    } else {
      console.debug('[auth][service] localStorage not available - Issue #823 debug');
    }

    const resolutionEnd = performance.now();
    console.debug(
      '[auth][service] resolveStoredToken: no storage available or no token found - Issue #823 debug:',
      {
        hasUiStorage: Boolean(this.uiStorage),
        hasLocalStorage: typeof localStorage !== 'undefined',
        isWorkerEnvironment,
        totalTimeMs: Math.round(resolutionEnd - resolutionStart),
        timestamp: new Date().toISOString(),
      }
    );
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

/**
 * Decode JWT token payload without verification (for expiration check only)
 * Returns null if token is not a valid JWT format
 */
function decodeJwtPayload(token: string): { exp?: number } | null {
  try {
    const parts = token.split('.');
    if (parts.length !== 3) {
      return null; // Not a JWT format
    }

    // Decode base64url payload
    const payload = parts[1];
    if (!payload) {
      return null; // Empty payload
    }

    const base64 = payload.replace(/-/g, '+').replace(/_/g, '/');
    const padded = base64.padEnd(base64.length + ((4 - (base64.length % 4)) % 4), '=');
    const decoded = atob(padded);

    return JSON.parse(decoded);
  } catch {
    return null; // Invalid JWT format or JSON
  }
}

/**
 * Check if a token is expired based on stored expiration or JWT exp field
 * Returns true if expired, false if valid, null if expiration cannot be determined
 */
function isTokenExpired(token: string, storedExpiresAt?: string): boolean | null {
  const now = Math.floor(Date.now() / 1000); // Unix timestamp in seconds

  // First check stored expiration timestamp
  if (storedExpiresAt) {
    const expiresAt = parseInt(storedExpiresAt, 10);
    if (!isNaN(expiresAt)) {
      return now >= expiresAt;
    }
  }

  // Fallback to JWT exp field if token looks like JWT
  const jwtPayload = decodeJwtPayload(token);
  if (jwtPayload && typeof jwtPayload.exp === 'number') {
    return now >= jwtPayload.exp;
  }

  // Cannot determine expiration
  return null;
}
