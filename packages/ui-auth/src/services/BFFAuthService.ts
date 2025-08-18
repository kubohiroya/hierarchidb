/**
 * @file BFFAuthService.ts
 * @description BFF authentication service implementation
 * Handles communication with Cloudflare Worker BFF
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
 * BFF Authentication Service
 * Communicates with Cloudflare Worker for secure authentication
 */
export class BFFAuthService {
  private static instance: BFFAuthService | null = null;
  private baseUrl: string;
  private popupWindow: Window | null = null;

  private constructor() {
    this.baseUrl = import.meta.env.VITE_BFF_URL || '/api/auth';
  }

  static getInstance(): BFFAuthService {
    if (!BFFAuthService.instance) {
      BFFAuthService.instance = new BFFAuthService();
    }
    return BFFAuthService.instance;
  }

  /**
   * Sign in via BFF
   */
  async signIn(options: BFFSignInOptions): Promise<BFFUser> {
    const { method = 'popup', provider = 'google', returnUrl } = options;

    if (method === 'popup') {
      return this.signInWithPopup(provider, returnUrl);
    } else {
      return this.signInWithRedirect(provider, returnUrl);
    }
  }

  /**
   * Sign in using popup window
   */
  private async signInWithPopup(provider: AuthProviderType, returnUrl?: string): Promise<BFFUser> {
    // Generate state for CSRF protection
    const state = this.generateState();
    sessionStorage.setItem('bff-auth-state', state);

    // Store return URL if provided
    if (returnUrl) {
      sessionStorage.setItem('bff-auth-return-url', returnUrl);
    }

    // Build auth URL
    const authUrl = new URL(`${this.baseUrl}/signin`, window.location.origin);
    authUrl.searchParams.set('provider', provider);
    authUrl.searchParams.set('method', 'popup');
    authUrl.searchParams.set('state', state);

    // Open popup
    const popup = this.openPopup(authUrl.toString());
    if (!popup) {
      throw new Error('Popup blocked');
    }

    // Wait for authentication to complete
    return new Promise((resolve, reject) => {
      const checkInterval = setInterval(() => {
        try {
          // Check if popup is closed
          if (popup.closed) {
            clearInterval(checkInterval);

            // Check if we got a result
            const result = sessionStorage.getItem('bff-auth-result');
            if (result) {
              sessionStorage.removeItem('bff-auth-result');
              const data = JSON.parse(result) as BFFAuthResponse;

              if (data.success && data.user) {
                resolve(data.user);
              } else {
                reject(new Error(data.error || 'Authentication failed'));
              }
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
   * Sign in using redirect
   */
  private async signInWithRedirect(
    provider: AuthProviderType,
    returnUrl?: string
  ): Promise<BFFUser> {
    // Generate state for CSRF protection
    const state = this.generateState();
    localStorage.setItem('bff-auth-state', state);

    // Store return URL
    const currentUrl = window.location.href;
    localStorage.setItem('bff-auth-src-return-url', returnUrl || currentUrl);

    // Build auth URL
    const authUrl = new URL(`${this.baseUrl}/signin`, window.location.origin);
    authUrl.searchParams.set('provider', provider);
    authUrl.searchParams.set('method', 'redirect');
    authUrl.searchParams.set('state', state);
    authUrl.searchParams.set('redirect_uri', window.location.origin + '/auth/callback');

    // Redirect to auth endpoint
    window.location.href = authUrl.toString();

    // This will never resolve as the page redirects
    return new Promise(() => {});
  }

  /**
   * Handle authentication callback (for redirect flow)
   */
  async handleCallback(params: URLSearchParams): Promise<BFFUser> {
    const code = params.get('code');
    const state = params.get('state');
    const error = params.get('error');

    if (error) {
      throw new Error(`Authentication error: ${error}`);
    }

    // Verify state
    const savedState = localStorage.getItem('bff-auth-state');
    if (state !== savedState) {
      throw new Error('Invalid state parameter');
    }

    // Exchange code for tokens via BFF
    const response = await fetch(`${this.baseUrl}/callback`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ code, state }),
      credentials: 'include',
    });

    if (!response.ok) {
      throw new Error(`Authentication failed: ${response.statusText}`);
    }

    const data = (await response.json()) as BFFAuthResponse;

    if (!data.success || !data.user) {
      throw new Error(data.error || 'Authentication failed');
    }

    // Clean up state
    localStorage.removeItem('bff-auth-state');

    return data.user;
  }

  /**
   * Sign out
   */
  async signOut(): Promise<void> {
    try {
      await fetch(`${this.baseUrl}/signout`, {
        method: 'POST',
        credentials: 'include',
      });
    } catch (error) {
      console.error('Sign out error:', error);
    }

    // Clear local storage
    this.clearAuthData();
  }

  /**
   * Refresh access token
   */
  async refreshToken(): Promise<BFFUser | null> {
    try {
      const response = await fetch(`${this.baseUrl}/refresh`, {
        method: 'POST',
        credentials: 'include',
      });

      if (!response.ok) {
        return null;
      }

      const data = (await response.json()) as BFFAuthResponse;

      if (data.success && data.user) {
        return data.user;
      }

      return null;
    } catch (error) {
      console.error('Token refresh error:', error);
      return null;
    }
  }

  /**
   * Get current user info from BFF
   */
  async getCurrentUser(): Promise<BFFUser | null> {
    try {
      const response = await fetch(`${this.baseUrl}/me`, {
        method: 'GET',
        credentials: 'include',
      });

      if (!response.ok) {
        return null;
      }

      const data = (await response.json()) as BFFAuthResponse;

      if (data.success && data.user) {
        return data.user;
      }

      return null;
    } catch (error) {
      console.error('Get user error:', error);
      return null;
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
      'bff-auth-popup',
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
    localStorage.removeItem('bff-auth-state');
    localStorage.removeItem('bff-auth-src-return-url');
    localStorage.removeItem('bff-auth-user');
    sessionStorage.removeItem('bff-auth-state');
    sessionStorage.removeItem('bff-auth-result');
    sessionStorage.removeItem('bff-auth-return-url');
  }
}
