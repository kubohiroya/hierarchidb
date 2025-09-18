/**
  * :
 * :
 * : PKCEstatenonce
 * : OAuth2.0 Security BCP (RFC 8252)
  */

import { AUTH_CONSTANTS } from './AuthServiceConfig.js';

/**
  * :
 * :
 * : Web Crypto API
 * : IETF RFC
  */
export class AuthSecurityUtils {
  /**
      * State: CSRFstate
   * :
   * : OAuth2.0 Security BCP
   * : RFC 6749 Section 10.12
      */
  static generateState(): string {
    const array = new Uint8Array(32);
    crypto.getRandomValues(array);
    return this.base64UrlEncode(array);
  }

  /**
      * Nonce: nonce
   * : OpenID Connect
   * :
   * : OpenID Connect Core 1.0
      */
  static generateNonce(): string {
    const array = new Uint8Array(32);
    crypto.getRandomValues(array);
    return this.base64UrlEncode(array);
  }

  /**
      * Code Verifier: PKCEcode_verifier
   * : RFC 7636
   * :
   * : RFC 7636 Section 4.1
      */
  static generateCodeVerifier(): string {
    const array = new Uint8Array(AUTH_CONSTANTS.CODE_VERIFIER_LENGTH / 2);
    crypto.getRandomValues(array);
    return this.base64UrlEncode(array);
  }

  /**
      * Code Challenge: code_verifiercode_challenge
   * : SHA-256
   * : Web Crypto API
   * : RFC 7636 Section 4.2
      */
  static async generateCodeChallenge(verifier: string): Promise<string> {
    //  : verifier
    if (!verifier) {
      throw new Error('Code verifierが必要です');
    }

    //  SHA-256: Web Crypto API
    const encoder = new TextEncoder();
    const data = encoder.encode(verifier);
    const hashBuffer = await crypto.subtle.digest('SHA-256', data);

    //  Base64URL: Base64URL
    const hashArray = new Uint8Array(hashBuffer);
    return this.base64UrlEncode(hashArray);
  }

  /**
      * Base64URL: URLBase64
   * : RFC 4648 Section 5
   * :
   * : RFC 4648
      */
  private static base64UrlEncode(buffer: Uint8Array): string {
    //  Base64:
    const base64 = btoa(String.fromCharCode(...buffer));

    //  URL: +-/_
    return base64
      .replace(/\+/g, '-')
      .replace(/\//g, '_')
      .replace(/=/g, '');
  }

  /**
      * Origin: Origin
   * :
   * :
   * :
      */
  static isValidMessageOrigin(eventOrigin: string, expectedOrigin: string): boolean {
    //  null/undefined:
    if (!eventOrigin || !expectedOrigin) {
      return false;
    }

    //  :
    return eventOrigin === expectedOrigin;
  }

  /**
      * :
   * :
   * : ID
   * :
      */
  static generateSecureRandomString(length: number = 32): string {
    const array = new Uint8Array(length);
    crypto.getRandomValues(array);
    return Array.from(array, byte => byte.toString(16).padStart(2, '0')).join('');
  }

  /**
      * :
   * :
   * : 5
   * :
      */
  static isValidTimestamp(timestamp: number, toleranceSeconds: number = 300): boolean {
    const now = Date.now();
    const diff = Math.abs(now - timestamp);
    return diff <= toleranceSeconds * 1000;
  }

  /**
      * : OAuth2.0
   * :
   * :
   * : OAuth2.0
      */
  static validateScopes(requestedScopes: string, allowedScopes: string[]): boolean {
    const requested = requestedScopes.split(' ').filter(s => s.length > 0);
    return requested.every(scope => allowedScopes.includes(scope));
  }

  /**
      * URL: URL
   * XSS:
   * : URLSearchParams
   * :
      */
  static buildSecureUrl(baseUrl: string, params: Record<string, string>): string {
    const url = new URL(baseUrl);
    const searchParams = new URLSearchParams();

    //  :
    Object.entries(params).forEach(([key, value]) => {
      if (value !== undefined && value !== null) {
        searchParams.append(key, value);
      }
    });

    //  URL: URL
    url.search = searchParams.toString();
    return url.toString();
  }
}