/**
 * @file AuthService.ts
 * @description Authentication service with popup-based flow as default
 */

// import { devError, devLog } from "@/shared/utils/logger";
const devError = (msg: string, error?: any) => console.error(msg, error);
const devLog = (msg: string) => console.log(msg);

export type AuthMethod = 'popup' | 'redirect';

interface AuthConfig {
  authUrl: string;
  authOrigin: string;
  clientId: string;
  redirectUri: string;
  popupRedirectUri: string;
  scope: string;
  responseType: string;
}

interface AuthResult {
  accessToken: string;
  refreshToken?: string;
  expiresIn: number;
  tokenType: string;
}

export class AuthService {
  private static instance: AuthService;
  private config: AuthConfig;
  private authMethod: AuthMethod = 'popup'; // Default to popup
  private popupCheckInterval: number | null = null;

  private constructor(config: AuthConfig) {
    this.config = config;
  }

  static initialize(config: AuthConfig): void {
    if (!AuthService.instance) {
      AuthService.instance = new AuthService(config);
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
    devLog(`Auth method change requested to ${method}, but currently locked to popup`);
  }

  /**
   * Initiate authentication flow
   */
  async authenticate(): Promise<AuthResult> {
    // Always use popup method for now
    return this.authenticateViaPopup();
  }

  /**
   * Authenticate using popup window
   */
  private async authenticateViaPopup(): Promise<AuthResult> {
    const authUrl = this.buildAuthUrl(true);

    // Calculate popup position
    const width = 500;
    const height = 600;
    const left = (window.screen.width - width) / 2;
    const top = (window.screen.height - height) / 2;

    // Open popup
    const popup = window.open(
      authUrl,
      'auth-popup',
      `width=${width},height=${height},left=${left},top=${top},toolbar=no,menubar=no`
    );

    if (!popup) {
      throw new Error('Popup blocked. Please allow popups for this site.');
    }

    devLog('Auth popup opened');

    return new Promise((resolve, reject) => {
      // Set up message listener
      const handleMessage = (event: MessageEvent) => {
        if (event.origin !== this.config.authOrigin) {
          devLog(`Ignoring message from untrusted origin: ${event.origin}`);
          return;
        }

        if (event.data.type === 'auth-success') {
          devLog('Auth success received');
          window.removeEventListener('message', handleMessage);
          this.stopPopupCheck();

          const result: AuthResult = {
            accessToken: event.data.accessToken,
            refreshToken: event.data.refreshToken,
            expiresIn: event.data.expiresIn || 3600,
            tokenType: event.data.tokenType || 'Bearer',
          };

          // Close popup
          if (!popup.closed) {
            popup.close();
          }

          resolve(result);
        } else if (event.data.type === 'auth-error') {
          devError('Auth error received', event.data.error);
          window.removeEventListener('message', handleMessage);
          this.stopPopupCheck();

          if (!popup.closed) {
            popup.close();
          }

          reject(new Error(event.data.error || 'Authentication failed'));
        }
      };

      window.addEventListener('message', handleMessage);

      // Monitor popup status
      this.startPopupCheck(popup, () => {
        window.removeEventListener('message', handleMessage);
        reject(new Error('Authentication cancelled by user'));
      });

      // Timeout after 5 minutes
      setTimeout(
        () => {
          window.removeEventListener('message', handleMessage);
          this.stopPopupCheck();
          if (!popup.closed) {
            popup.close();
          }
          reject(new Error('Authentication timeout'));
        },
        5 * 60 * 1000
      );
    });
  }

  /**
   * Build authentication URL
   */
  private buildAuthUrl(isPopup: boolean): string {
    const params = new URLSearchParams({
      client_id: this.config.clientId,
      redirect_uri: isPopup ? this.config.popupRedirectUri : this.config.redirectUri,
      response_type: this.config.responseType,
      scope: this.config.scope,
      state: this.generateState(),
      prompt: 'select_account',
    });

    return `${this.config.authUrl}?${params.toString()}`;
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
          window.location.origin
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
          window.location.origin
        );
      }

      // Show closing message
      document.body.innerHTML =
        '<p>Authentication complete. This window will close automatically...</p>';

      // Close after a short delay
      setTimeout(() => window.close(), 1000);
    } else {
      // Not in popup mode or opener was closed
      document.body.innerHTML = '<p>Authentication complete. You can close this window.</p>';
    }
  }
}
