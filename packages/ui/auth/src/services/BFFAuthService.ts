/**
 * @file BFFAuthService.ts
 * @description BFF authentication service implementation
 * Handles OAuth2 authentication flow with Cloudflare Worker BFF
 */

import type { AuthProviderType } from '~/types/AuthProviderType';
import { AuthSessionStorage, type BFFUser } from './AuthSessionStorage.js';
import { maybeEmitBffWarning, readWarningFromResponse } from './BffWarning.js';

export type { BFFUser } from './AuthSessionStorage.js';

export interface BFFSignInOptions {
  returnUrl?: string;
  method?: 'popup' | 'redirect';
  provider?: AuthProviderType;
}

export interface BFFAuthResponse {
  success: boolean;
  user?: BFFUser;
  error?: string;
  redirect_url?: string;
}

const base64UrlEncode = (array: Uint8Array): string =>
  btoa(String.fromCharCode(...array))
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=/g, '');

const generateCodeVerifier = (): string => {
  const array = new Uint8Array(64);
  crypto.getRandomValues(array);
  return base64UrlEncode(array);
};

const generateCodeChallenge = async (verifier: string): Promise<string> => {
  const encoder = new TextEncoder();
  const data = encoder.encode(verifier);
  const hash = await crypto.subtle.digest('SHA-256', data);
  return base64UrlEncode(new Uint8Array(hash));
};

/**
 * BFF Authentication Service
 * Implements OAuth2 flow with PKCE for secure authentication
 */
export class BFFAuthService {
  private static instance: BFFAuthService | null = null;
  private static codeExchangePromises = new Map<string, Promise<BFFUser>>();
  private baseUrl: string;
  private popupWindow: Window | null = null;
  private refreshDisabled = false;

  private static readonly DEFAULT_BFF_BASE_URL = 'https://hierarchidb-bff.kubohiroya.workers.dev';

  private constructor() {
    // Always respect explicit URL (use prod BFF even in dev)
    const envUrl = import.meta.env.VITE_BFF_BASE_URL || BFFAuthService.DEFAULT_BFF_BASE_URL;
    this.baseUrl = envUrl || '/auth';
  }

  static getInstance(): BFFAuthService {
    if (!BFFAuthService.instance) {
      BFFAuthService.instance = new BFFAuthService();
    }
    return BFFAuthService.instance;
  }

  /**
   * Sign in via OAuth2
   * Initiates OAuth2 flow with the selected provider
   */
  async signIn(options: BFFSignInOptions): Promise<BFFUser> {
    const { method = 'redirect', provider = 'google', returnUrl } = options;

    if (method === 'popup') {
      return this.signInWithPopup(provider, returnUrl);
    } else {
      return this.signInWithRedirect(provider, returnUrl);
    }
  }

  /**
   * Sign in using popup window (if supported)
   */
  private async signInWithPopup(provider: AuthProviderType, returnUrl?: string): Promise<BFFUser> {
    // Generate PKCE parameters
    const codeVerifier = generateCodeVerifier();
    const codeChallenge = await generateCodeChallenge(codeVerifier);

    // Store for later use
    localStorage.setItem('pkce_code_verifier', codeVerifier);
    localStorage.setItem('auth_provider', provider);
    if (returnUrl) {
      localStorage.setItem('auth_return_url', returnUrl);
    }

    // Build OAuth2 authorization URL
    const authUrl = this.buildAuthorizationUrl(provider, codeChallenge, 'popup');

    // Open popup
    const popup = this.openPopup(authUrl.toString());
    if (!popup) {
      throw new Error('Popup blocked. Please allow popups for this site.');
    }

    // Wait for authentication to complete
    return this.waitForPopupAuth(popup);
  }

  /**
   * Sign in using redirect flow (most reliable)
   */
  private async signInWithRedirect(
    provider: AuthProviderType,
    returnUrl?: string
  ): Promise<BFFUser> {
    // Generate PKCE parameters
    const codeVerifier = generateCodeVerifier();
    const codeChallenge = await generateCodeChallenge(codeVerifier);

    // Store for later use (use localStorage for redirect flow)
    localStorage.setItem('pkce_code_verifier', codeVerifier);
    localStorage.setItem('auth_provider', provider);

    // Store return URL
    const currentUrl = window.location.href;
    const finalReturnUrl = returnUrl || currentUrl;
    localStorage.setItem('auth_return_url', finalReturnUrl);

    // Debug logging for return URL handling
    console.debug('[BFF] Return URL saved for redirect flow:', {
      provided: returnUrl,
      current: currentUrl,
      final: finalReturnUrl,
      provider,
    });

    // Build OAuth2 authorization URL
    const authUrl = this.buildAuthorizationUrl(provider, codeChallenge, 'redirect');

    // Redirect to OAuth2 provider
    window.location.href = authUrl.toString();

    // This will never resolve as the page redirects
    return new Promise(() => {});
  }

  /**
   * Build OAuth2 authorization URL
   */
  private buildAuthorizationUrl(
    provider: AuthProviderType,
    codeChallenge: string,
    method: 'popup' | 'redirect'
  ): URL {
    const { isAbsolute, authBase } = this.resolveAuthBase();

    const authUrl = isAbsolute
      ? new URL(`${authBase}/authorize/${provider}`)
      : new URL(`${authBase}/authorize/${provider}`, window.location.origin);

    // Add PKCE parameters
    authUrl.searchParams.set('code_challenge', codeChallenge);
    authUrl.searchParams.set('code_challenge_method', 'S256');
    authUrl.searchParams.set(
      'return_origin',
      `${window.location.origin}${this.getAppBasePrefix()}`
    );

    // Add redirect URI (BFF will handle the actual OAuth redirect)
    if (method === 'redirect') {
      const baseClean = this.getAppBasePrefix();
      authUrl.searchParams.set(
        'redirect_uri',
        `${window.location.origin}${baseClean}/auth/callback`
      );
    }

    return authUrl;
  }

  /**
   * Compute app base prefix from Vite `BASE_URL` (derived from `VITE_APP_NAME`).
   * Returns a string like '' or '/hierarchidb'. No trailing slash.
   */
  private getAppBasePrefix(): string {
    const base = import.meta.env.BASE_URL || '/';
    const norm = String(base).startsWith('/') ? String(base) : `/${String(base)}`;
    return norm.endsWith('/') ? norm.slice(0, -1) : norm;
  }

  /**
   * Resolve the effective auth base path for BFF endpoints.
   * - Absolute `VITE_BFF_BASE_URL`: `<abs>/auth`
   * - Relative or empty: `${BASE_URL}/auth` (or `${BASE_URL}${base}/auth` if `baseUrl` provided)
   */
  private resolveAuthBase(): { isAbsolute: boolean; authBase: string } {
    const isAbsolute = this.baseUrl.startsWith('http://') || this.baseUrl.startsWith('https://');
    if (isAbsolute) {
      const abs = this.baseUrl.replace(/\/$/, '');
      const withAuth = abs.endsWith('/auth') ? abs : `${abs}/auth`;
      return { isAbsolute: true, authBase: withAuth };
    }

    const appBase = this.getAppBasePrefix(); // '' or '/hierarchidb'
    const base = this.baseUrl?.trim() || '/auth';
    const rel = base.endsWith('/auth') ? base : `${base.replace(/\/$/, '')}/auth`;

    // Join like `${appBase}${rel}` but avoid double slashes
    const joined = `${appBase}${rel.startsWith('/') ? '' : '/'}${rel}`;
    return { isAbsolute: false, authBase: joined };
  }

  /**
   * Wait for popup authentication to complete
   */
  private waitForPopupAuth(popup: Window): Promise<BFFUser> {
    return new Promise((resolve, reject) => {
      const checkInterval = setInterval(() => {
        try {
          // Check if popup is closed
          if (popup.closed) {
            clearInterval(checkInterval);

            // Check if authentication was successful
            const user = AuthSessionStorage.load();
            if (user) {
              resolve(user);
            } else {
              reject(new Error('Authentication cancelled'));
            }
          }
        } catch (error) {
          clearInterval(checkInterval);
          reject(error);
        }
      }, 500);

      // Timeout after 5 minutes
      setTimeout(
        () => {
          clearInterval(checkInterval);
          popup.close();
          reject(new Error('Authentication timeout'));
        },
        5 * 60 * 1000
      );
    });
  }

  /**
   * Handle OAuth2 callback (for redirect flow)
   * Exchanges authorization code for tokens
   */
  async handleCallback(params: URLSearchParams): Promise<BFFUser> {
    const code = params.get('code');
    const state = params.get('state');
    const error = params.get('error');

    if (error) {
      throw new Error(`Authentication error: ${error}`);
    }

    if (!code) {
      throw new Error('No authorization code received');
    }

    // Deduplicate concurrent/double-invoked exchanges (e.g., React Strict Mode)
    const existingPromise = BFFAuthService.codeExchangePromises.get(code);
    if (existingPromise) {
      return existingPromise;
    }

    const codeVerifier = localStorage.getItem('pkce_code_verifier');
    if (!codeVerifier) {
      // A completed callback can be rendered again after its PKCE state is removed.
      // Reuse only a fully valid persisted session; contract violations remain visible.
      const existingUser = AuthSessionStorage.load();
      if (existingUser) {
        return existingUser;
      }
      throw new Error('No PKCE code verifier found');
    }

    // Verify atoms for CSRF protection
    const savedState = localStorage.getItem('oauth_state');
    if (state && savedState && state !== savedState) {
      console.warn('State mismatch detected; proceeding (BFF validates atoms)');
    }

    const exchangePromise = (async () => {
      // Get provider
      const provider = AuthSessionStorage.parseProvider(
        localStorage.getItem('auth_provider'),
        'auth_provider'
      );

      // Exchange code for tokens via BFF
      const { isAbsolute, authBase } = this.resolveAuthBase();
      const tokenUrl = isAbsolute ? `${authBase}/token` : `${authBase}/token`;
      const response = await fetch(tokenUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          code,
          state,
          code_verifier: codeVerifier,
          provider,
          redirect_uri: `${window.location.origin}${this.getAppBasePrefix()}/auth/callback`,
        }),
        credentials: 'include',
      });

      // Enhanced error handling with detailed logging
      if (!response.ok) {
        console.error('[BFF] Token exchange failed:', {
          status: response.status,
          statusText: response.statusText,
          url: tokenUrl,
          headers: Object.fromEntries(response.headers.entries()),
          responseOk: response.ok,
        });

        const errorData = await response.json().catch(() => ({}));
        throw new Error(
          errorData.error_description ||
            `Token exchange failed: ${response.status} ${response.statusText}`
        );
      }

      // Log successful response for debugging
      console.debug('[BFF] Token exchange success:', {
        status: response.status,
        statusText: response.statusText,
        url: tokenUrl,
        responseOk: response.ok,
      });

      const data: unknown = await response.json();
      maybeEmitBffWarning((data as { warning?: unknown } | null)?.warning);

      const user = AuthSessionStorage.persistTokenResponse(data, provider);

      // Clean up OAuth flow state (keep return URL until caller consumes it)
      this.clearAuthFlowState({ preserveReturnUrl: true });

      this.refreshDisabled = user.session_mode === 'stateless';
      return user;
    })();

    BFFAuthService.codeExchangePromises.set(code, exchangePromise);
    try {
      return await exchangePromise;
    } finally {
      // Keep successful promise for reuse; drop on failure
      exchangePromise.catch(() => {
        BFFAuthService.codeExchangePromises.delete(code);
      });
    }
  }

  /**
   * Sign out
   */
  async signOut(): Promise<void> {
    const token = localStorage.getItem('access_token');

    // Call revoke endpoint if available
    if (token) {
      try {
        const { authBase } = this.resolveAuthBase();
        const response = await fetch(`${authBase}/revoke`, {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${token}`,
          },
          credentials: 'include',
        });
        await readWarningFromResponse(response);
      } catch {
        // Ignore revoke errors
      }
    }

    // Clear local storage
    this.clearAuthData();
  }

  /**
   * Refresh access token
   */
  async refreshToken(): Promise<BFFUser | null> {
    try {
      const token = localStorage.getItem('access_token');
      const refreshTokenId = localStorage.getItem('refresh_token_id');

      if (!token) {
        return null;
      }
      const currentUser = AuthSessionStorage.load();
      if (!currentUser) {
        throw new Error('Invalid persisted auth session: userinfo is required for token refresh');
      }
      if (currentUser.session_mode === 'stateless') {
        this.refreshDisabled = true;
        if (currentUser.expires_at <= Date.now()) {
          AuthSessionStorage.clear();
        }
        return null;
      }
      if (this.refreshDisabled) {
        return null;
      }

      const { authBase } = this.resolveAuthBase();
      const response = await fetch(`${authBase}/refresh`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          refresh_token_id: refreshTokenId,
        }),
        credentials: 'include',
      });

      const data = await response.json().catch(() => ({}));
      const warning = maybeEmitBffWarning((data as { warning?: unknown })?.warning);
      if (warning?.operation === 'refresh') {
        this.refreshDisabled = true;
      }

      if (!response.ok) {
        if (warning?.operation === 'refresh') {
          return null;
        }
        // Clear auth data on refresh failure
        this.clearAuthData();
        return null;
      }

      const user = AuthSessionStorage.persistTokenResponse(data, currentUser.provider);
      this.refreshDisabled = false;
      return user;
    } catch (error) {
      if (AuthSessionStorage.isContractError(error)) {
        throw error;
      }
      return null;
    }
  }

  /**
   * Get current user info
   */
  async getCurrentUser(): Promise<BFFUser | null> {
    const user = AuthSessionStorage.load();
    if (user?.session_mode === 'stateless' && user.expires_at <= Date.now()) {
      AuthSessionStorage.clear();
      return null;
    }
    return user;
  }

  /**
   * Open popup window for authentication
   */
  private openPopup(url: string): Window | null {
    // Calculate center position
    const width = 500;
    const height = 600;
    const left = window.screenX + (window.outerWidth - width) / 2;
    const top = window.screenY + (window.outerHeight - height) / 2;

    // Close existing popup if any
    if (this.popupWindow && !this.popupWindow.closed) {
      this.popupWindow.close();
    }

    // Open new popup
    this.popupWindow = window.open(
      url,
      'oauth-popup',
      `width=${width},height=${height},left=${left},top=${top},` +
        'toolbar=no,menubar=no,location=no,status=no'
    );

    return this.popupWindow;
  }

  /**
   * Clear OAuth flow state without touching tokens.
   */
  private clearAuthFlowState(options: { preserveReturnUrl?: boolean } = {}): void {
    // Clear PKCE data
    localStorage.removeItem('pkce_code_verifier');

    // Clear OAuth atoms
    localStorage.removeItem('oauth_state');

    // Clear provider and return URL
    localStorage.removeItem('auth_provider');
    if (!options.preserveReturnUrl) {
      localStorage.removeItem('auth_return_url');
    }
  }

  /**
   * Clear authentication data from storage (tokens + flow state).
   */
  private clearAuthData(options: { preserveReturnUrl?: boolean } = {}): void {
    this.clearAuthFlowState(options);
    AuthSessionStorage.clear();
  }
}
