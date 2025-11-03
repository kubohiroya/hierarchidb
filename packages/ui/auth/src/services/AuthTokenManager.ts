/**
 * :
 * :
 * :
 * : OAuth2.0/JWT
 */

import { AUTH_CONSTANTS } from './AuthServiceConfig.js';

/**
 * :
 * :
 * : OAuth2.0
 */
export interface AuthToken {
  accessToken: string;
  refreshToken?: string;
  expiresIn: number;
  tokenType: string;
  issuedAt: number;
}

/**
 * :
 * :
 * : XSS
 * :
 */
export class AuthTokenManager {
  private currentToken: AuthToken | null = null;

  /**
   * :
   * :
   * :
   * :
   */
  setToken(token: Omit<AuthToken, 'issuedAt'>): void {
    //  :
    if (!token.accessToken || !token.tokenType) {
      throw new Error('無効なトークン: accessTokenとtokenTypeは必須です');
    }

    //  :
    if (token.expiresIn <= 0) {
      throw new Error('無効なトークン有効期限: expiresInは正の数値である必要があります');
    }

    //  :
    this.currentToken = {
      ...token,
      issuedAt: Date.now(),
    };
  }

  /**
   * :
   * :
   * :
   * :
   */
  getToken(): AuthToken | null {
    if (!this.isTokenValid()) {
      this.clearToken();
      return null;
    }
    return this.currentToken;
  }

  /**
   * :
   * :
   * :
   * : JWT
   */
  isTokenValid(): boolean {
    if (!this.currentToken) {
      return false;
    }

    const now = Date.now();
    const tokenAgeSeconds = (now - this.currentToken.issuedAt) / 1000;
    const effectiveExpiresIn = Math.max(
      0,
      this.currentToken.expiresIn - AUTH_CONSTANTS.TOKEN_EXPIRY_BUFFER_SECONDS
    );

    return tokenAgeSeconds < effectiveExpiresIn;
  }

  /**
   * :
   * :
   * : null
   * :
   */
  clearToken(): void {
    this.currentToken = null;
  }

  /**
   * :
   * :
   * :
   * :
   */
  getRemainingSeconds(): number {
    if (!this.currentToken) {
      return 0;
    }

    const now = Date.now();
    const tokenAgeSeconds = (now - this.currentToken.issuedAt) / 1000;
    const remaining = this.currentToken.expiresIn - tokenAgeSeconds;

    return Math.max(0, remaining);
  }

  /**
   * :
   * :
   * :
   * :
   */
  needsRefresh(): boolean {
    const remaining = this.getRemainingSeconds();
    //  1
    return remaining > 0 && remaining < 60;
  }

  /**
   * :
   * :
   * :
   */
  getAccessToken(): string | null {
    const token = this.getToken();
    return token?.accessToken ?? null;
  }

  /**
   * :
   * :
   * : OAuth2.0
   */
  getRefreshToken(): string | null {
    return this.currentToken?.refreshToken ?? null;
  }

  /**
   * :
   * :
   * :
   */
  isAuthenticated(): boolean {
    return this.isTokenValid() && this.currentToken !== null;
  }
}
