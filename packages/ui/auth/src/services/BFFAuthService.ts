/**
 * @file BFFAuthService.ts
 * @description BFF authentication service implementation
 * Handles OAuth2 authentication flow with Cloudflare Worker BFF
 */

import { AuthProviderType } from '../types/AuthProviderType';

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

/**
 * PKCE (Proof Key for Code Exchange) utilities
 */
class PKCEUtils {
  static generateCodeVerifier(): string {
    const array = new Uint8Array(64);
    crypto.getRandomValues(array);
    return this.base64UrlEncode(array);
  }

  static async generateCodeChallenge(verifier: string): Promise<string> {
    const encoder = new TextEncoder();
    const data = encoder.encode(verifier);
    const hash = await crypto.subtle.digest('SHA-256', data);
    return this.base64UrlEncode(new Uint8Array(hash));
  }

  private static base64UrlEncode(array: Uint8Array): string {
    return btoa(String.fromCharCode(...array))
      .replace(/\+/g, '-')
      .replace(/\//g, '_')
      .replace(/=/g, '');
  }
}

/**
 * BFF Authentication Service
 * Implements OAuth2 flow with PKCE for secure authentication
 */
export class BFFAuthService {
  private static instance: BFFAuthService | null = null;
  private baseUrl: string;
  private popupWindow: Window | null = null;

  private constructor() {
    // Use proxy path for local development, direct URL for production
    const envUrl = import.meta.env.VITE_BFF_BASE_URL;
    const isDevelopment = import.meta.env.VITE_ENV_MODE === 'development';
    
    // In development, use relative URL for proxy; in production, use full URL
    if (isDevelopment && (!envUrl || envUrl.startsWith('http'))) {
      // Use proxy path in development
      this.baseUrl = '';  // Empty string to use relative paths with proxy
    } else {
      this.baseUrl = envUrl || '/api/auth';
    }
    
    console.log('[BFFAuthService] Initialized with baseUrl:', this.baseUrl);
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
    const codeVerifier = PKCEUtils.generateCodeVerifier();
    const codeChallenge = await PKCEUtils.generateCodeChallenge(codeVerifier);

    // Store for later use
    sessionStorage.setItem('pkce_code_verifier', codeVerifier);
    if (returnUrl) {
      sessionStorage.setItem('auth_return_url', returnUrl);
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
    const codeVerifier = PKCEUtils.generateCodeVerifier();
    const codeChallenge = await PKCEUtils.generateCodeChallenge(codeVerifier);

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
    // Fix: Check if baseUrl is absolute or relative
    const isAbsoluteUrl = this.baseUrl.startsWith('http://') || this.baseUrl.startsWith('https://');
    
    let authUrl: URL;
    if (isAbsoluteUrl) {
      // For absolute URLs, construct the auth endpoint correctly
      // baseUrl should be like: https://eria-cartograph-bff.kubohiroya.workers.dev
      authUrl = new URL(`${this.baseUrl}/auth/${provider}/authorize`);
    } else {
      // For relative URLs (like /api/auth), use window.location.origin
      authUrl = new URL(`${this.baseUrl}/${provider}/authorize`, window.location.origin);
    }

    // Add PKCE parameters
    authUrl.searchParams.set('code_challenge', codeChallenge);
    authUrl.searchParams.set('code_challenge_method', 'S256');

    // Add state for CSRF protection
    const state = this.generateState();
    authUrl.searchParams.set('state', state);
    sessionStorage.setItem('oauth_state', state);

    // Add redirect URI (BFF will handle the actual OAuth redirect)
    if (method === 'redirect') {
      authUrl.searchParams.set('redirect_uri', `${window.location.origin}/auth/callback`);
    }

    return authUrl;
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
            const token = sessionStorage.getItem('access_token');
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

    // Verify state for CSRF protection
    const savedState = sessionStorage.getItem('oauth_state');
    if (state !== savedState) {
      throw new Error('Invalid state parameter - possible CSRF attack');
    }

    // Get stored PKCE verifier
    const codeVerifier =
      localStorage.getItem('pkce_code_verifier') || sessionStorage.getItem('pkce_code_verifier');
    if (!codeVerifier) {
      throw new Error('No PKCE code verifier found');
    }

    // Get provider
    const provider = localStorage.getItem('auth_provider') || 'google';

    // Exchange code for tokens via BFF
    const response = await fetch(`${this.baseUrl}/token`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        code,
        state,
        code_verifier: codeVerifier,
        provider,
        redirect_uri: `${window.location.origin}/auth/callback`,
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
      sessionStorage.setItem('access_token', data.access_token);
      localStorage.setItem('access_token', data.access_token);
    }
    if (data.refresh_token_id) {
      localStorage.setItem('refresh_token_id', data.refresh_token_id);
    }

    // Clean up
    this.clearAuthData();

    // Parse user from token response
    return this.parseTokenResponse(data);
  }

  /**
   * Sign out
   */
  async signOut(): Promise<void> {
    const token = localStorage.getItem('access_token');

    // Call revoke endpoint if available
    if (token) {
      try {
        await fetch(`${this.baseUrl}/revoke`, {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${token}`,
          },
          credentials: 'include',
        });
      } catch (error) {
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

      const response = await fetch(`${this.baseUrl}/refresh`, {
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
        sessionStorage.setItem('access_token', data.access_token);
      }
      if (data.refresh_token_id) {
        localStorage.setItem('refresh_token_id', data.refresh_token_id);
      }

      return this.parseTokenResponse(data);
    } catch (error) {
      return null;
    }
  }

  /**
   * Get current user info
   */
  async getCurrentUser(): Promise<BFFUser | null> {
    const token = localStorage.getItem('access_token');
    if (!token) {
      return null;
    }

    try {
      // Parse JWT to get user info (without verification)
      return this.parseTokenToUser(token);
    } catch (error) {
      return null;
    }
  }

  /**
   * Parse token response to user object
   */
  private parseTokenResponse(data: any): BFFUser {
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
    } catch (error) {
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
  private clearAuthData(): void {
    // Clear PKCE data
    localStorage.removeItem('pkce_code_verifier');
    sessionStorage.removeItem('pkce_code_verifier');

    // Clear OAuth state
    localStorage.removeItem('oauth_state');
    sessionStorage.removeItem('oauth_state');

    // Clear tokens (keep these for getCurrentUser)
    // localStorage.removeItem('access_token');
    // localStorage.removeItem('refresh_token_id');

    // Clear provider and return URL
    localStorage.removeItem('auth_provider');
    localStorage.removeItem('auth_return_url');
    sessionStorage.removeItem('auth_return_url');
  }
}
