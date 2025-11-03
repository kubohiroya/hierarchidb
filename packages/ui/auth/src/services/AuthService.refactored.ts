import { AuthSecurityUtils } from './AuthSecurityUtils.js';
import { AUTH_CONSTANTS, type AuthConfig, AuthConfigValidator } from './AuthServiceConfig.js';
import { type AuthToken, AuthTokenManager } from './AuthTokenManager.js';

export type AuthMethod = 'popup' | 'redirect';
export type { AuthConfig } from './AuthServiceConfig.js';
export type AuthResult = Omit<AuthToken, 'issuedAt'>;

export class AuthService {
  private static instance: AuthService | null = null;
  private readonly config: Readonly<AuthConfig>;
  private readonly tokenManager: AuthTokenManager;
  private readonly authMethod: AuthMethod = 'popup';

  //  :
  private isAuthInProgress = false;
  private popupCheckInterval: number | null = null;
  private currentCodeVerifier: string | null = null;
  private maxRetries = AUTH_CONSTANTS.DEFAULT_MAX_RETRIES;
  private customScopes: string[] = [];

  //  :
  private cleanupHandlers: Set<() => void> = new Set();

  private constructor(config: AuthConfig) {
    //  :
    AuthConfigValidator.validate(config);

    //  :
    this.config = AuthConfigValidator.freezeConfig(config);

    //  :
    this.tokenManager = new AuthTokenManager();
  }

  static initialize(config: AuthConfig): void {
    if (!AuthService.instance) {
      AuthService.instance = new AuthService(config);
      if (import.meta.env.DEV) {
        console.log('AuthService初期化完了');
      }
    } else {
      if (import.meta.env.DEV) {
        console.warn('AuthServiceは既に初期化済みです。再初期化は無視されました。');
      }
    }
  }

  static getInstance(): AuthService {
    if (!AuthService.instance) {
      throw new Error('AuthServiceが初期化されていません。先にinitialize()を呼び出してください。');
    }
    return AuthService.instance;
  }

  getAuthMethod(): AuthMethod {
    return this.authMethod;
  }

  setAuthMethod(method: AuthMethod): void {
    if (import.meta.env.DEV) {
      console.log(`認証方式変更リクエスト: ${method}（現在はpopupのみサポート）`);
    }
  }

  async authenticate(): Promise<AuthResult> {
    //  :
    if (this.isAuthInProgress) {
      throw new Error('認証処理が既に実行中です');
    }

    //  :
    if (this.tokenManager.isAuthenticated()) {
      const token = this.tokenManager.getToken();
      if (token) {
        const { issuedAt: _issuedAt, ...result } = token;
        return result;
      }
    }

    this.isAuthInProgress = true;

    try {
      //  :
      const result = await this.authenticateViaPopup();

      //  :
      this.tokenManager.setToken(result);

      return result;
    } catch (error) {
      //  :
      if (import.meta.env.DEV) {
        console.error('認証エラー:', error);
      }
      throw error;
    } finally {
      //  :
      this.isAuthInProgress = false;

      //  :
      this.performCleanup();
    }
  }

  private async authenticateViaPopup(): Promise<AuthResult> {
    const authUrl = await this.buildAuthUrl(true);

    const popupConfig = this.getPopupConfig();

    const popup = window.open(authUrl, 'auth-popup', popupConfig);

    if (!popup) {
      throw new Error('ポップアップがブロックされました。ブラウザの設定を確認してください。');
    }

    if (import.meta.env.DEV) {
      console.log('認証ポップアップを開きました');
    }

    return new Promise((resolve, reject) => {
      const timeoutId = window.setTimeout(() => {
        this.cleanupPopupAuth(popup, messageHandler);
        reject(new Error('認証がタイムアウトしました'));
      }, AUTH_CONSTANTS.POPUP_TIMEOUT_MS);

      const messageHandler = (event: MessageEvent) => {
        if (!AuthSecurityUtils.isValidMessageOrigin(event.origin, this.config.authOrigin)) {
          if (import.meta.env.DEV) {
            console.log(`不正なOriginからのメッセージを無視: ${event.origin}`);
          }
          return;
        }

        if (event.data.type === 'auth-success') {
          if (import.meta.env.DEV) {
            console.log('認証成功');
          }

          const result: AuthResult = {
            accessToken: event.data.accessToken,
            refreshToken: event.data.refreshToken,
            expiresIn: event.data.expiresIn || 3600,
            tokenType: event.data.tokenType || 'Bearer',
          };

          clearTimeout(timeoutId);
          this.cleanupPopupAuth(popup, messageHandler);
          resolve(result);
        }

        //  :
        else if (event.data.type === 'auth-error') {
          if (import.meta.env.DEV) {
            console.error('認証エラー:', event.data.error);
          }

          clearTimeout(timeoutId);
          this.cleanupPopupAuth(popup, messageHandler);
          reject(new Error(event.data.error || '認証に失敗しました'));
        }
      };

      //  :
      window.addEventListener('message', messageHandler);

      //  :
      this.startPopupCheck(popup, () => {
        clearTimeout(timeoutId);
        this.cleanupPopupAuth(popup, messageHandler);
        reject(new Error('認証がキャンセルされました'));
      });

      //  :
      this.cleanupHandlers.add(() => {
        clearTimeout(timeoutId);
        this.cleanupPopupAuth(popup, messageHandler);
      });
    });
  }

  private async buildAuthUrl(isPopup: boolean): Promise<string> {
    const params: Record<string, string> = {
      client_id: this.config.clientId,
      redirect_uri: isPopup ? this.config.popupRedirectUri : this.config.redirectUri,
      response_type: this.config.responseType,
      scope: this.buildScope(),
      state: AuthSecurityUtils.generateState(),
      prompt: 'select_account',
      nonce: AuthSecurityUtils.generateNonce(),
    };

    //  PKCE: code_challenge
    if (this.config.usePKCE) {
      this.currentCodeVerifier = AuthSecurityUtils.generateCodeVerifier();
      params.code_challenge = await AuthSecurityUtils.generateCodeChallenge(
        this.currentCodeVerifier
      );
      params.code_challenge_method = AUTH_CONSTANTS.CODE_CHALLENGE_METHOD;
    }

    //  URL: URL
    return AuthSecurityUtils.buildSecureUrl(this.config.authUrl, params);
  }

  private buildScope(): string {
    const baseScopes = this.config.scope.split(' ');
    const allScopes = [...new Set([...baseScopes, ...this.customScopes])];
    return allScopes.join(' ');
  }

  private getPopupConfig(): string {
    const width = AUTH_CONSTANTS.POPUP_WIDTH;
    const height = AUTH_CONSTANTS.POPUP_HEIGHT;
    const left = Math.max(0, (window.screen.width - width) / 2);
    const top = Math.max(0, (window.screen.height - height) / 2);

    return `width=${width},height=${height},left=${left},top=${top},toolbar=no,menubar=no,scrollbars=yes`;
  }

  private startPopupCheck(popup: Window, onClose: () => void): void {
    this.popupCheckInterval = window.setInterval(() => {
      if (popup.closed) {
        this.stopPopupCheck();
        onClose();
      }
    }, AUTH_CONSTANTS.POPUP_CHECK_INTERVAL_MS);
  }

  private stopPopupCheck(): void {
    if (this.popupCheckInterval !== null) {
      clearInterval(this.popupCheckInterval);
      this.popupCheckInterval = null;
    }
  }

  private cleanupPopupAuth(
    popup: Window | null,
    messageHandler: ((e: MessageEvent) => void) | null
  ): void {
    if (messageHandler) {
      window.removeEventListener('message', messageHandler);
    }

    this.stopPopupCheck();

    if (popup && !popup.closed) {
      try {
        popup.close();
      } catch (e) {
        if (import.meta.env.DEV) {
          console.log('ポップアップクローズエラー（無視可能）:', e);
        }
      }
    }

    //  : PKCE verifier
    this.currentCodeVerifier = null;
  }

  private performCleanup(): void {
    this.cleanupHandlers.forEach((handler) => {
      try {
        handler();
      } catch (e) {
        if (import.meta.env.DEV) {
          console.error('クリーンアップエラー:', e);
        }
      }
    });
    this.cleanupHandlers.clear();
  }

  isAuthenticating(): boolean {
    return this.isAuthInProgress;
  }

  isAuthenticated(): boolean {
    return this.tokenManager.isAuthenticated();
  }

  isTokenValid(): boolean {
    return this.tokenManager.isTokenValid();
  }

  setMaxRetries(retries: number): void {
    if (retries < 0 || retries > 10) {
      throw new Error('リトライ回数は0〜10の範囲で指定してください');
    }
    this.maxRetries = retries as 3;
  }

  setCustomScopes(scopes: string[]): void {
    this.customScopes = scopes.filter((s) => s.trim().length > 0);
  }

  async authenticateWithRetry(): Promise<AuthResult> {
    let lastError: Error | null = null;

    for (let attempt = 1; attempt <= this.maxRetries; attempt++) {
      try {
        if (import.meta.env.DEV) {
          console.log(`認証試行 ${attempt}/${this.maxRetries}`);
        }
        return await this.authenticate();
      } catch (error) {
        lastError = error as Error;

        if (attempt < this.maxRetries) {
          //  : 2^attempt * 1000ms
          const delay = Math.min(2 ** attempt * 1000, 30000);
          if (import.meta.env.DEV) {
            console.log(`${delay}ms後にリトライします...`);
          }
          await new Promise((resolve) => setTimeout(resolve, delay));
        }
      }
    }

    throw lastError || new Error('認証に失敗しました');
  }

  getStoredCodeVerifier(): string | null {
    return this.currentCodeVerifier;
  }

  async refreshToken(): Promise<AuthResult | null> {
    const refreshToken = this.tokenManager.getRefreshToken();

    if (!refreshToken) {
      if (import.meta.env.DEV) {
        console.warn('リフレッシュトークンが存在しません');
      }
      return null;
    }

    if (import.meta.env.DEV) {
      console.warn('リフレッシュトークン機能は未実装です');
    }
    return null;
  }

  static handlePopupRedirect(): void {
    if (window.opener && !window.opener.closed) {
      const params = new URLSearchParams(window.location.search);
      const code = params.get('code');
      const error = params.get('error');

      if (code) {
        window.opener.postMessage({ type: 'auth-success', code }, window.location.origin);
      } else if (error) {
        window.opener.postMessage({ type: 'auth-error', error }, window.location.origin);
      }

      document.body.innerHTML = '<p>認証完了。このウィンドウは自動的に閉じられます...</p>';

      setTimeout(() => {
        if (typeof window.close === 'function') {
          try {
            window.close();
          } catch (e) {
            if (import.meta.env.DEV) {
              console.log('ウィンドウを閉じることができませんでした:', e);
            }
          }
        }
      }, 1000);
    } else {
      document.body.innerHTML = '<p>認証完了。このウィンドウを閉じてください。</p>';
    }
  }
}
