/**
 * @file AuthService.ts
 * @description Authentication service with popup-based flow as default
 */

// Logging functions removed - using console directly

export type AuthMethod = 'popup' | 'redirect';

interface AuthConfig {
  authUrl: string;
  authOrigin: string;
  clientId: string;
  redirectUri: string;
  popupRedirectUri: string;
  scope: string;
  responseType: string;
  usePKCE?: boolean; //  PKCE: OAuth2.0 PKCE
}

interface AuthResult {
  accessToken: string;
  refreshToken?: string;
  expiresIn: number;
  tokenType: string;
}

export class AuthService {
  private static instance: AuthService | null = null;
  private readonly config: AuthConfig; //  Security: readonly for immutability
  private popupCheckInterval: number | null = null;
  private readonly authMethod: AuthMethod = 'popup'; //  Security: readonly as it's fixed

  //  :
  private isAuthInProgress = false; //  :
  private currentToken: AuthResult | null = null; //  :
  private tokenIssuedAt: number | null = null; //  :
  private codeVerifier: string | null = null; //  PKCE: code_verifier
  private maxRetries = 3; //  :
  private customScopes: string[] = []; //  :

  private constructor(config: AuthConfig) {
    //  Security: Validate config before storing
    this.validateConfig(config);
    this.config = Object.freeze({ ...config }); //  Security: Freeze config to prevent mutation
  }

  private validateConfig(config: AuthConfig): void {
    if (!config.authUrl || !this.isValidUrl(config.authUrl)) {
      throw new Error('Invalid authUrl in configuration');
    }
    if (!config.authOrigin || !this.isValidOrigin(config.authOrigin)) {
      throw new Error('Invalid authOrigin in configuration');
    }
    if (!config.clientId || config.clientId.trim().length === 0) {
      throw new Error('Invalid clientId in configuration');
    }
    if (!config.redirectUri || !this.isValidUrl(config.redirectUri)) {
      throw new Error('Invalid redirectUri in configuration');
    }
    if (!config.popupRedirectUri || !this.isValidUrl(config.popupRedirectUri)) {
      throw new Error('Invalid popupRedirectUri in configuration');
    }
  }

  private isValidUrl(url: string): boolean {
    try {
      const parsed = new URL(url);
      return parsed.protocol === 'https:' || parsed.protocol === 'http:';
    } catch {
      return false;
    }
  }

  private isValidOrigin(origin: string): boolean {
    try {
      const url = new URL(origin);
      return url.origin === origin;
    } catch {
      return false;
    }
  }

  static initialize(config: AuthConfig): void {
    if (!AuthService.instance) {
      AuthService.instance = new AuthService(config);
    } else {
      if ((import.meta as any)?.env?.DEV) {
        console.warn('AuthService already initialized. Ignoring re-initialization attempt.');
      }
    }
  }

  static getInstance(): AuthService {
    if (!AuthService.instance) {
      throw new Error('AuthService must be initialized before use');
    }
    return AuthService.instance;
  }

  /**
   * Get current authentication method
   */
  getAuthMethod(): AuthMethod {
    return this.authMethod;
  }

  /**
   * Set authentication method (currently always popup)
   */
  setAuthMethod(method: AuthMethod): void {
    // This method is intentionally left as a no-op for now
    // UI will show the option as disabled
    if ((import.meta as any)?.env?.DEV) {
      console.log(`Auth method change requested to ${method}, but currently locked to popup`);
    }
  }

  /**
   * Initiate authentication flow
   */
  async authenticate(): Promise<AuthResult> {
    //  :
    if (this.isAuthInProgress) {
      throw new Error('Authentication already in progress');
    }

    this.isAuthInProgress = true;

    try {
      // Always use popup method for now
      const result = await this.authenticateViaPopup();

      this.currentToken = result;
      this.tokenIssuedAt = Date.now(); //  :

      return result;
    } finally {
      this.isAuthInProgress = false;
    }
  }

  /**
      * Authenticate using popup window
   * Performance & Security: Improved cleanup and error handling
      */
  private async authenticateViaPopup(): Promise<AuthResult> {
    const authUrl = this.buildAuthUrl(true);

    //  Performance: Pre-calculate popup dimensions
    const popupConfig = this.getPopupConfig();

    // Open popup
    const popup = window.open(authUrl, 'auth-popup', popupConfig);

    if (!popup) {
      throw new Error('Popup blocked. Please allow popups for this site.');
    }

    if ((import.meta as any)?.env?.DEV) {
      console.log('Auth popup opened');
    }

    return new Promise((resolve, reject) => {
      let timeoutId: number | null = null;
      let messageHandler: ((event: MessageEvent) => void) | null = null;

      //  Security: Centralized cleanup function
      const cleanup = () => {
        if (messageHandler) {
          window.removeEventListener('message', messageHandler);
          messageHandler = null;
        }
        this.stopPopupCheck();
        if (timeoutId !== null) {
          clearTimeout(timeoutId);
          timeoutId = null;
        }
        if (!popup.closed) {
          popup.close();
        }
        //  Security: Clear sensitive data on cleanup
        this.codeVerifier = null;
      };

      // Set up message listener
      messageHandler = (event: MessageEvent) => {
        //  Security: Strict origin validation
        if (event.origin !== this.config.authOrigin) {
          if ((import.meta as any)?.env?.DEV) {
            console.log(`Ignoring message from untrusted origin: ${event.origin}`);
          }
          return;
        }

        if (event.data.type === 'auth-success') {
          if ((import.meta as any)?.env?.DEV) {
            console.log('Auth success received');
          }

          const result: AuthResult = {
            accessToken: event.data.accessToken,
            refreshToken: event.data.refreshToken,
            expiresIn: event.data.expiresIn || 3600,
            tokenType: event.data.tokenType || 'Bearer',
          };

          //  :
          this.currentToken = result;
          this.tokenIssuedAt = Date.now();

          cleanup();
          resolve(result);
        } else if (event.data.type === 'auth-error') {
          if ((import.meta as any)?.env?.DEV) {
            console.error('Auth error received', event.data.error);
          }
          cleanup();
          reject(new Error(event.data.error || 'Authentication failed'));
        }
      };

      window.addEventListener('message', messageHandler);

      // Monitor popup status
      this.startPopupCheck(popup, () => {
        cleanup();
        reject(new Error('Authentication cancelled by user'));
      });

      //  Performance: Configurable timeout
      const timeout = this.getAuthTimeout();
      timeoutId = window.setTimeout(() => {
        cleanup();
        reject(new Error('Authentication timeout'));
      }, timeout);
    });
  }

  /**
      * Performance: Get optimized popup configuration
      */
  private getPopupConfig(): string {
    const width = 500;
    const height = 600;
    const left = Math.max(0, (window.screen.width - width) / 2);
    const top = Math.max(0, (window.screen.height - height) / 2);

    return `width=${width},height=${height},left=${left},top=${top},toolbar=no,menubar=no,scrollbars=yes`;
  }

  /**
      * Performance: Get configurable authentication timeout
      */
  private getAuthTimeout(): number {
    return 5 * 60 * 1000; // 5 minutes default
  }

  /**
      * Build authentication URL
   * Performance: Optimized URL building with proper encoding
      */
  private buildAuthUrl(isPopup: boolean): string {
    const params = new URLSearchParams({
      client_id: this.config.clientId,
      redirect_uri: isPopup ? this.config.popupRedirectUri : this.config.redirectUri,
      response_type: this.config.responseType,
      scope: this.buildScope(), //  :
      state: this.generateState(),
      prompt: 'select_account',
    });

    //  PKCE: PKCEcode_challenge
    if (this.config.usePKCE) {
      this.codeVerifier = this.generateCodeVerifier();
      const codeChallenge = this.generateCodeChallenge(this.codeVerifier);
      params.append('code_challenge', codeChallenge);
      params.append('code_challenge_method', 'S256');
    }

    //  nonce: OpenID Connectnonce
    const nonce = this.generateNonce();
    params.append('nonce', nonce);

    //  Fix: Ensure consistent URL encoding (replace + with %20 for spaces)
    const queryString = params.toString().replace(/\+/g, '%20');
    return `${this.config.authUrl}?${queryString}`;
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
   * Start monitoring popup window status
   */
  private startPopupCheck(popup: Window, onClose: () => void): void {
    this.popupCheckInterval = window.setInterval(() => {
      if (popup.closed) {
        this.stopPopupCheck();
        onClose();
      }
    }, 500);
  }

  /**
   * Stop monitoring popup window
   */
  private stopPopupCheck(): void {
    if (this.popupCheckInterval !== null) {
      clearInterval(this.popupCheckInterval);
      this.popupCheckInterval = null;
    }
  }

  /**
   * Handle OAuth callback (for popup mode)
   */
  static handleAuthCallback(): void {
    const params = new URLSearchParams(window.location.search);
    const code = params.get('code');
    const error = params.get('error');
    // const state = params.get('state'); // RemovedProperties: unused variable

    if (window.opener && !window.opener.closed) {
      if (error) {
        window.opener.postMessage(
          {
            type: 'auth-error',
            error: error,
            errorDescription: params.get('error_description'),
          },
          window.location.origin,
        );
      } else if (code) {
        // In a real implementation, exchange code for tokens here
        // For now, sending mock tokens
        window.opener.postMessage(
          {
            type: 'auth-success',
            accessToken: 'mock-access-token',
            refreshToken: 'mock-refresh-token',
            expiresIn: 3600,
            tokenType: 'Bearer',
          },
          window.location.origin,
        );
      }

      // Show closing message
      document.body.innerHTML =
        '<p>Authentication complete. This window will close automatically...</p>';

      // Close after a short delay
      setTimeout(() => {
        //  Security: Check if window.close is available before calling
        if (typeof window.close === 'function') {
          window.close();
        }
      }, 1000);
    } else {
      // Not in popup mode or opener was closed
      document.body.innerHTML = '<p>Authentication complete. You can close this window.</p>';
    }
  }

  isAuthenticating(): boolean {
    //  :
    return this.isAuthInProgress;
  }

  isAuthenticated(): boolean {
    //  : true
    return this.currentToken !== null && this.isTokenValid();
  }

  isTokenValid(): boolean {
    //  : false
    if (!this.currentToken || this.tokenIssuedAt === null) {
      return false;
    }

    //  Security: Add buffer time for token expiration
    const now = Date.now();
    const tokenAge = (now - this.tokenIssuedAt) / 1000;
    const bufferSeconds = 30; //  30

    //  :
    const effectiveExpiresIn = Math.max(0, this.currentToken.expiresIn - bufferSeconds);
    return tokenAge < effectiveExpiresIn;
  }

  setMaxRetries(retries: number): void {
    //  :
    this.maxRetries = retries;
  }

  async authenticateWithRetry(): Promise<AuthResult> {
    //  :
    let lastError: Error | null = null;

    for (let attempt = 1; attempt <= this.maxRetries; attempt++) {
      try {
        //  : authenticate()
        return await this.authenticate();
      } catch (error) {
        //  :
        lastError = error as Error;

        //  :
        if (attempt < this.maxRetries) {
          //  :
          await new Promise((resolve) => setTimeout(resolve, 100));

          //  :
          this.isAuthInProgress = false;
        }
      }
    }

    //  :
    throw lastError || new Error('Authentication failed after retries');
  }

  /**
      * : code_verifier
   * :
   * : PKCE
   * : OAuth2.0 PKCE
      */
  getStoredCodeVerifier(): string | null {
    //  : code_verifier
    return this.codeVerifier;
  }

  /**
      * :
   * :
   * :
   * : OAuth2
      */
  setCustomScopes(scopes: string[]): void {
    //  :
    this.customScopes = scopes;
  }

  /**
      * :
   * :
   * :
   * : OAuth2
      */
  async refreshToken(): Promise<AuthResult> {
    //  :
    //  TODO: Refactor
    const newToken: AuthResult = {
      accessToken: 'refreshed-access-token',
      refreshToken: this.currentToken?.refreshToken || 'refresh-token',
      expiresIn: 3600,
      tokenType: 'Bearer',
    };

    //  :
    this.currentToken = newToken;

    return newToken;
  }

  /**
      * :
   * :
   * :
   * : OAuth2
      */
  private buildScope(): string {
    //  :
    const defaultScopes = this.config.scope.split(' ');
    const allScopes = [...defaultScopes, ...this.customScopes];

    //  :
    const uniqueScopes = Array.from(new Set(allScopes));

    return uniqueScopes.join(' ');
  }

  /**
      * : PKCEcode_verifier
   * :
   * : PKCE
   * : OAuth2.0 PKCE
      */
  private generateCodeVerifier(): string {
    //  : 43-128
    const array = new Uint8Array(32);
    crypto.getRandomValues(array);

    //  Base64URL: PKCE
    return btoa(String.fromCharCode(...array))
      .replace(/\+/g, '-')
      .replace(/\//g, '_')
      .replace(/=/g, '');
  }

  /**
      * : code_challenge
   * : code_verifierSHA256
   * : PKCE
   * : OAuth2.0 PKCE
      */
  private generateCodeChallenge(verifier: string): string {
    //  :
    //  SHA256WebCrypto API
    //  Base64
    //  TODO: RefactorSHA256

    return btoa(verifier).replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '');
  }

  /**
      * : OpenID Connectnonce
   * :
   * : nonce
   * : OIDC
      */
  private generateNonce(): string {
    //  : 16
    const array = new Uint8Array(16);
    crypto.getRandomValues(array);

    //  16: nonce
    return Array.from(array, (byte) => byte.toString(16).padStart(2, '0')).join('');
  }
}
