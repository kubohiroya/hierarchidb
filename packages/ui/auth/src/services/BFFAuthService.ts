/**
 * @file BFFAuthService.ts
 * @description BFF authentication service implementation
 * Handles OAuth2 authentication flow with Cloudflare Worker BFF
 */

import type { AuthProviderType } from '../types/AuthProviderType.js';

export interface BFFUser {
  id: string;
  email: string;
  name: string;
  picture?: string;
  access_token: string;
  refresh_token?: string;
  expires_at: number;
  provider?: AuthProviderType;
}

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

type TokenResponseUserInfo = Partial<Record<'sub' | 'email' | 'name' | 'picture', string>>;

interface TokenResponsePayload {
  access_token?: string;
  refresh_token?: string;
  refresh_token_id?: string;
  id_token?: string;
  expires_in?: number;
  provider?: AuthProviderType;
  sub?: string;
  email?: string;
  name?: string;
  picture?: string;
  userinfo?: TokenResponseUserInfo;
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
  private readonly USERINFO_STORAGE_KEYS = {
    userinfo: 'userinfo',
  } as const;
  private baseUrl: string;
  private popupWindow: Window | null = null;

  private static readonly DEFAULT_BFF_BASE_URL =
    'https://hierarchidb-bff.kubohiroya.workers.dev';

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

  private persistUser(user: BFFUser): void {
    try {
      const payload = {
        id: user.id,
        email: user.email,
        name: user.name,
        picture: user.picture,
        provider: user.provider,
        expires_at: user.expires_at,
      };
      localStorage.setItem(this.USERINFO_STORAGE_KEYS.userinfo, JSON.stringify(payload));
    } catch {
      // Ignore storage errors (e.g., quota)
    }
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
    localStorage.setItem('auth_return_url', returnUrl || currentUrl);

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

    // Add state for CSRF protection
    const state = this.generateState();
    authUrl.searchParams.set('state', state);
    localStorage.setItem('oauth_state', state);

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
            const token = localStorage.getItem('access_token');
            if (token) {
              // Parse and return user data
              const user = this.parseTokenToUser(token);
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

    // If we already have a token (e.g., callback executed once and re-rendered),
    // short-circuit to avoid double-exchanging the same code.
    const existingToken = localStorage.getItem('access_token');
    if (existingToken) {
      try {
        return this.parseTokenToUser(existingToken);
      } catch {
        // fall through and retry exchange
      }
    }

    // Deduplicate concurrent/double-invoked exchanges (e.g., React Strict Mode)
    const existingPromise = BFFAuthService.codeExchangePromises.get(code);
    if (existingPromise) {
      return existingPromise;
    }

    // Verify state for CSRF protection
    const savedState = localStorage.getItem('oauth_state');
    if (state && savedState && state !== savedState) {
      console.warn('State mismatch detected; proceeding (BFF validates state)');
    }

    const exchangePromise = (async () => {
      // Get stored PKCE verifier
      const codeVerifier = localStorage.getItem('pkce_code_verifier');
      if (!codeVerifier) {
        throw new Error('No PKCE code verifier found');
      }

      // Get provider
      const provider = localStorage.getItem('auth_provider') || 'google';

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

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(
          errorData.error_description || `Token exchange failed: ${response.statusText}`
        );
      }

      const data = await response.json();

      // Store tokens
      if (data.access_token) {
        localStorage.setItem('access_token', data.access_token);
      }
      if (data.refresh_token_id) {
        localStorage.setItem('refresh_token_id', data.refresh_token_id);
      }

      // Clean up (keep return URL until caller consumes it)
      this.clearAuthData({ preserveReturnUrl: true });
      localStorage.removeItem('oauth_state');

      // Parse user from token response
      const user = this.parseTokenResponse(data);
      this.persistUser(user);
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
        await fetch(`${authBase}/revoke`, {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${token}`,
          },
          credentials: 'include',
        });
      } catch {
        // Ignore revoke errors
      }
    }

    // Clear local storage
    this.clearAuthData();
    localStorage.removeItem(this.USERINFO_STORAGE_KEYS.userinfo);
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

      if (!response.ok) {
        // Clear tokens on refresh failure
        this.clearAuthData();
        return null;
      }

      const data = await response.json();

      // Update tokens
      if (data.access_token) {
        localStorage.setItem('access_token', data.access_token);
      }
      if (data.refresh_token_id) {
        localStorage.setItem('refresh_token_id', data.refresh_token_id);
      }

      const user = this.parseTokenResponse(data);
      this.persistUser(user);
      return user;
    } catch {
      return null;
    }
  }

  /**
   * Get current user info
   */
  async getCurrentUser(): Promise<BFFUser | null> {
    // Prefer persisted user info if available
    try {
      const persisted =
        localStorage.getItem(this.USERINFO_STORAGE_KEYS.userinfo);
      if (persisted) {
        const parsed = JSON.parse(persisted) as Partial<BFFUser> & { expires_at?: number };
        const token = localStorage.getItem('access_token') || '';
        if (token && parsed.id) {
          return {
            id: parsed.id,
            email: parsed.email || '',
            name: parsed.name || parsed.email || '',
            picture: parsed.picture,
            access_token: token,
            refresh_token: localStorage.getItem('refresh_token_id') || undefined,
            expires_at: parsed.expires_at || Date.now() + 3600 * 1000,
            provider: (parsed.provider as AuthProviderType | undefined) || 'google',
          };
        }
      }
    } catch {
      // ignore parse errors
    }

    const token = localStorage.getItem('access_token');
    if (!token) {
      return null;
    }

    try {
      // Parse JWT to get user info (without verification)
      return this.parseTokenToUser(token);
    } catch {
      return null;
    }
  }

  /**
   * Parse token response to user object
   */
  private parseTokenResponse(data: TokenResponsePayload): BFFUser {
    const userInfo = data.userinfo || {};

    return {
      id: userInfo.sub || data.sub || '',
      email: userInfo.email || data.email || '',
      name: userInfo.name || data.name || '',
      picture: userInfo.picture || data.picture,
      access_token: data.access_token || data.id_token || '',
      refresh_token: data.refresh_token,
      expires_at: Date.now() + (data.expires_in || 3600) * 1000,
      provider: data.provider || 'google',
    };
  }

  /**
   * Parse JWT token to extract user info
   */
  private parseTokenToUser(token: string): BFFUser {
    try {
      const data = token.split('.');
      if (data.length < 2 || !data[1]) {
        throw new Error('Invalid token format');
      }
      // Decode JWT payload (base64)
      const payload = JSON.parse(atob(data[1]));

      return {
        id: payload.sub || '',
        email: payload.email || '',
        name: payload.name || '',
        picture: payload.picture,
        access_token: token,
        expires_at: (payload.exp || 0) * 1000, // Convert to milliseconds
        provider: payload.provider || 'google',
      };
    } catch {
      throw new Error('Invalid token format');
    }
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
   * Generate random state for CSRF protection
   */
  private generateState(): string {
    const array = new Uint8Array(32);
    crypto.getRandomValues(array);
    return Array.from(array, (byte) => byte.toString(16).padStart(2, '0')).join('');
  }

  /**
   * Clear authentication data from storage
   */
  private clearAuthData(options: { preserveReturnUrl?: boolean } = {}): void {
    // Clear PKCE data
    localStorage.removeItem('pkce_code_verifier');

    // Clear OAuth state
    localStorage.removeItem('oauth_state');

    // Clear tokens (keep these for getCurrentUser)
    // localStorage.removeItem('access_token');
    // localStorage.removeItem('refresh_token_id');

    // Clear provider and return URL
    localStorage.removeItem('auth_provider');
    if (!options.preserveReturnUrl) {
      localStorage.removeItem('auth_return_url');
    }
  }
}
