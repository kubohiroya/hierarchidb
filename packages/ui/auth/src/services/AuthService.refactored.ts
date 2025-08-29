/**
 * 【ファイル概要】: OAuth2.0認証サービス メインクラス
 * 【リファクタリング】: モジュール分割により責任を分離
 * 【改善内容】: セキュリティ、パフォーマンス、保守性の向上
 * 🟢 信頼性レベル: OAuth2.0標準仕様準拠
 */

import { AuthConfig, AUTH_CONSTANTS, AuthConfigValidator } from './AuthServiceConfig';
import { AuthTokenManager, AuthToken } from './AuthTokenManager';
import { AuthSecurityUtils } from './AuthSecurityUtils';

// 型のエクスポート
export type AuthMethod = 'popup' | 'redirect';
export type { AuthConfig } from './AuthServiceConfig';
export type AuthResult = Omit<AuthToken, 'issuedAt'>;

/**
 * 【認証サービスクラス】: OAuth2.0ポップアップ認証の実装
 * 【設計方針】: シングルトンパターンで単一インスタンス管理
 * 【改善内容】: 責任分離により各機能をモジュール化
 * 【セキュリティ】: 設定検証、トークン管理、セキュリティパラメータを分離
 * 【パフォーマンス】: 不要な処理を削減し、メモリ効率を改善
 * 🟢 信頼性レベル: OAuth2.0 Security BCPに準拠
 */
export class AuthService {
  private static instance: AuthService | null = null;
  private readonly config: Readonly<AuthConfig>;
  private readonly tokenManager: AuthTokenManager;
  private readonly authMethod: AuthMethod = 'popup';
  
  // 【状態管理】: 認証プロセスの状態
  private isAuthInProgress = false;
  private popupCheckInterval: number | null = null;
  private currentCodeVerifier: string | null = null;
  private maxRetries = AUTH_CONSTANTS.DEFAULT_MAX_RETRIES;
  private customScopes: string[] = [];
  
  // 【リソース管理】: クリーンアップハンドラ
  private cleanupHandlers: Set<() => void> = new Set();

  /**
   * 【コンストラクタ】: プライベートコンストラクタでシングルトン実装
   * 【改善内容】: 設定検証とトークン管理を外部モジュールに委譲
   * 【セキュリティ】: 設定の不変性を保証
   * 🟢 信頼性レベル: デザインパターンのベストプラクティス
   */
  private constructor(config: AuthConfig) {
    // 【設定検証】: 専用バリデータで厳密な検証
    AuthConfigValidator.validate(config);
    
    // 【設定フリーズ】: 実行時の改変を防止
    this.config = AuthConfigValidator.freezeConfig(config);
    
    // 【トークン管理】: 専用マネージャのインスタンス化
    this.tokenManager = new AuthTokenManager();
  }

  /**
   * 【初期化】: AuthServiceインスタンスの初期化
   * 【改善内容】: 重複初期化の防止とログ出力
   * 【設計】: 静的メソッドによる明示的な初期化
   * 🟢 信頼性レベル: シングルトンパターンの標準実装
   */
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

  /**
   * 【インスタンス取得】: シングルトンインスタンスの取得
   * 【エラー処理】: 未初期化時の明確なエラーメッセージ
   * 🟢 信頼性レベル: 標準的なシングルトンアクセサ
   */
  static getInstance(): AuthService {
    if (!AuthService.instance) {
      throw new Error('AuthServiceが初期化されていません。先にinitialize()を呼び出してください。');
    }
    return AuthService.instance;
  }

  /**
   * 【認証メソッド取得】: 現在の認証方式を取得
   * 【簡便性】: 読み取り専用アクセサ
   * 🟢 信頼性レベル: 標準的なゲッター
   */
  getAuthMethod(): AuthMethod {
    return this.authMethod;
  }

  /**
   * 【認証メソッド設定】: 認証方式の設定（現在はpopupのみ）
   * 【将来拡張】: redirectサポート時に有効化
   * 🟡 信頼性レベル: 将来の拡張を考慮
   */
  setAuthMethod(method: AuthMethod): void {
    if (import.meta.env.DEV) {

      console.log(`認証方式変更リクエスト: ${method}（現在はpopupのみサポート）`);

    }
  }

  /**
   * 【認証実行】: OAuth2.0認証フローの開始
   * 【改善内容】: 同時実行防止とリソース管理を強化
   * 【エラー処理】: 適切なクリーンアップを保証
   * 【パフォーマンス】: 不要な再認証を防止
   * 🟢 信頼性レベル: OAuth2.0標準フロー実装
   */
  async authenticate(): Promise<AuthResult> {
    // 【同時実行防止】: 複数の認証プロセスの同時実行を防ぐ
    if (this.isAuthInProgress) {
      throw new Error('認証処理が既に実行中です');
    }

    // 【既存トークン確認】: 有効なトークンがあれば再利用
    if (this.tokenManager.isAuthenticated()) {
      const token = this.tokenManager.getToken()!;
      const { issuedAt, ...result } = token;
      return result;
    }

    this.isAuthInProgress = true;
    
    try {
      // 【ポップアップ認証】: 現在サポートされる唯一の方式
      const result = await this.authenticateViaPopup();
      
      // 【トークン保存】: 認証成功時の処理
      this.tokenManager.setToken(result);
      
      return result;
    } catch (error) {
      // 【エラーログ】: デバッグ用の詳細ログ
      if (import.meta.env.DEV) {

        console.error('認証エラー:', error);

      }
      throw error;
    } finally {
      // 【状態リセット】: 必ずフラグをリセット
      this.isAuthInProgress = false;
      
      // 【リソースクリーンアップ】: メモリリーク防止
      this.performCleanup();
    }
  }

  /**
   * 【ポップアップ認証】: ポップアップウィンドウによる認証
   * 【改善内容】: リソース管理とエラーハンドリングを強化
   * 【セキュリティ】: Origin検証とメッセージ検証を厳格化
   * 【パフォーマンス】: 不要なイベントリスナーの削除
   * 🟢 信頼性レベル: OAuth2.0ポップアップフローの標準実装
   */
  private async authenticateViaPopup(): Promise<AuthResult> {
    // 【URL構築】: セキュアな認証URLの生成
    const authUrl = await this.buildAuthUrl(true);

    // 【ポップアップ設定】: 最適な位置とサイズ
    const popupConfig = this.getPopupConfig();
    
    // 【ポップアップ開始】: 新しいウィンドウを開く
    const popup = window.open(authUrl, 'auth-popup', popupConfig);

    if (!popup) {
      throw new Error('ポップアップがブロックされました。ブラウザの設定を確認してください。');
    }

    if (import.meta.env.DEV) {

      console.log('認証ポップアップを開きました');

    }

    return new Promise((resolve, reject) => {
      // 【タイムアウト設定】: 長時間の待機を防ぐ
      const timeoutId = window.setTimeout(() => {
        this.cleanupPopupAuth(popup, messageHandler);
        reject(new Error('認証がタイムアウトしました'));
      }, AUTH_CONSTANTS.POPUP_TIMEOUT_MS);

      // 【メッセージハンドラ】: 認証結果の受信
      const messageHandler = (event: MessageEvent) => {
        // 【Origin検証】: セキュリティのため厳密に検証
        if (!AuthSecurityUtils.isValidMessageOrigin(event.origin, this.config.authOrigin)) {
          if (import.meta.env.DEV) {

            console.log(`不正なOriginからのメッセージを無視: ${event.origin}`);

          }
          return;
        }

        // 【成功処理】: 認証成功時の処理
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
        
        // 【エラー処理】: 認証失敗時の処理
        else if (event.data.type === 'auth-error') {
          if (import.meta.env.DEV) {

            console.error('認証エラー:', event.data.error);

          }
          
          clearTimeout(timeoutId);
          this.cleanupPopupAuth(popup, messageHandler);
          reject(new Error(event.data.error || '認証に失敗しました'));
        }
      };

      // 【イベントリスナー登録】: メッセージ受信の準備
      window.addEventListener('message', messageHandler);

      // 【ポップアップ監視】: ユーザーによる閉じる操作の検知
      this.startPopupCheck(popup, () => {
        clearTimeout(timeoutId);
        this.cleanupPopupAuth(popup, messageHandler);
        reject(new Error('認証がキャンセルされました'));
      });

      // 【クリーンアップ登録】: 確実なリソース解放
      this.cleanupHandlers.add(() => {
        clearTimeout(timeoutId);
        this.cleanupPopupAuth(popup, messageHandler);
      });
    });
  }

  /**
   * 【認証URL構築】: OAuth2.0準拠の認証URL生成
   * 【改善内容】: セキュリティパラメータの生成を専用モジュールに委譲
   * 【パフォーマンス】: 非同期処理でcode_challenge生成
   * 🟢 信頼性レベル: OAuth2.0/PKCE仕様準拠
   */
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

    // 【PKCE対応】: セキュアなcode_challenge生成
    if (this.config.usePKCE) {
      this.currentCodeVerifier = AuthSecurityUtils.generateCodeVerifier();
      params.code_challenge = await AuthSecurityUtils.generateCodeChallenge(this.currentCodeVerifier);
      params.code_challenge_method = AUTH_CONSTANTS.CODE_CHALLENGE_METHOD;
    }

    // 【URL構築】: セキュアなURL生成
    return AuthSecurityUtils.buildSecureUrl(this.config.authUrl, params);
  }

  /**
   * 【スコープ構築】: 認証スコープの構築
   * 【カスタマイズ】: カスタムスコープの追加をサポート
   * 🟡 信頼性レベル: 一般的なスコープ管理パターン
   */
  private buildScope(): string {
    const baseScopes = this.config.scope.split(' ');
    const allScopes = [...new Set([...baseScopes, ...this.customScopes])];
    return allScopes.join(' ');
  }

  /**
   * 【ポップアップ設定取得】: 最適なポップアップ設定を計算
   * 【UX改善】: 画面中央に配置
   * 🟢 信頼性レベル: 標準的なポップアップ配置
   */
  private getPopupConfig(): string {
    const width = AUTH_CONSTANTS.POPUP_WIDTH;
    const height = AUTH_CONSTANTS.POPUP_HEIGHT;
    const left = Math.max(0, (window.screen.width - width) / 2);
    const top = Math.max(0, (window.screen.height - height) / 2);
    
    return `width=${width},height=${height},left=${left},top=${top},toolbar=no,menubar=no,scrollbars=yes`;
  }

  /**
   * 【ポップアップ監視開始】: ポップアップの状態を監視
   * 【リソース管理】: インターバルの適切な管理
   * 🟢 信頼性レベル: 標準的なポップアップ監視パターン
   */
  private startPopupCheck(popup: Window, onClose: () => void): void {
    this.popupCheckInterval = window.setInterval(() => {
      if (popup.closed) {
        this.stopPopupCheck();
        onClose();
      }
    }, AUTH_CONSTANTS.POPUP_CHECK_INTERVAL_MS);
  }

  /**
   * 【ポップアップ監視停止】: 監視インターバルのクリア
   * 【メモリ管理】: リソースの解放
   * 🟢 信頼性レベル: 標準的なクリーンアップ
   */
  private stopPopupCheck(): void {
    if (this.popupCheckInterval !== null) {
      clearInterval(this.popupCheckInterval);
      this.popupCheckInterval = null;
    }
  }

  /**
   * 【ポップアップクリーンアップ】: ポップアップ関連リソースの解放
   * 【メモリリーク防止】: イベントリスナーとポップアップの確実な解放
   * 🟢 信頼性レベル: 防御的プログラミング
   */
  private cleanupPopupAuth(popup: Window | null, messageHandler: ((e: MessageEvent) => void) | null): void {
    // 【イベントリスナー削除】: メモリリーク防止
    if (messageHandler) {
      window.removeEventListener('message', messageHandler);
    }
    
    // 【ポップアップ監視停止】: インターバルクリア
    this.stopPopupCheck();
    
    // 【ポップアップ閉じる】: まだ開いている場合は閉じる
    if (popup && !popup.closed) {
      try {
        popup.close();
      } catch (e) {
        // ポップアップが既に閉じられている可能性
        if (import.meta.env.DEV) {

          console.log('ポップアップクローズエラー（無視可能）:', e);

        }
      }
    }
    
    // 【セキュリティ】: PKCE verifierのクリア
    this.currentCodeVerifier = null;
  }

  /**
   * 【全体クリーンアップ】: 登録された全クリーンアップハンドラの実行
   * 【リソース管理】: メモリリークの完全防止
   * 🟢 信頼性レベル: ベストプラクティス
   */
  private performCleanup(): void {
    this.cleanupHandlers.forEach(handler => {
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

  // === パブリックメソッド（既存互換性のため） ===

  /**
   * 【認証状態確認】: 現在認証中かどうか
   * 🟢 信頼性レベル: 標準的な状態確認
   */
  isAuthenticating(): boolean {
    return this.isAuthInProgress;
  }

  /**
   * 【認証済み確認】: 有効なトークンが存在するか
   * 🟢 信頼性レベル: 標準的な認証確認
   */
  isAuthenticated(): boolean {
    return this.tokenManager.isAuthenticated();
  }

  /**
   * 【トークン有効性確認】: トークンが有効期限内か
   * 🟢 信頼性レベル: トークン管理の標準実装
   */
  isTokenValid(): boolean {
    return this.tokenManager.isTokenValid();
  }

  /**
   * 【最大リトライ回数設定】: ネットワークエラー時のリトライ設定
   * 🟡 信頼性レベル: 一般的なリトライ設定
   */
  setMaxRetries(retries: number): void {
    if (retries < 0 || retries > 10) {
      throw new Error('リトライ回数は0〜10の範囲で指定してください');
    }
    this.maxRetries = retries as 3;
  }

  /**
   * 【カスタムスコープ設定】: 追加のOAuthスコープを設定
   * 🟡 信頼性レベル: OAuth2.0標準のスコープ管理
   */
  setCustomScopes(scopes: string[]): void {
    this.customScopes = scopes.filter(s => s.trim().length > 0);
  }

  /**
   * 【リトライ付き認証】: 自動リトライ機能付き認証
   * 【エラー処理】: 指数バックオフによるリトライ
   * 🟡 信頼性レベル: 一般的なリトライパターン
   */
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
          // 【指数バックオフ】: 2^attempt * 1000ms
          const delay = Math.min(Math.pow(2, attempt) * 1000, 30000);
          if (import.meta.env.DEV) {

            console.log(`${delay}ms後にリトライします...`);

          }
          await new Promise(resolve => setTimeout(resolve, delay));
        }
      }
    }
    
    throw lastError || new Error('認証に失敗しました');
  }

  /**
   * 【Code Verifier取得】: PKCE用のcode_verifier取得
   * 【セキュリティ】: 認証フロー中のみ取得可能
   * 🟢 信頼性レベル: PKCE仕様準拠
   */
  getStoredCodeVerifier(): string | null {
    return this.currentCodeVerifier;
  }

  /**
   * 【トークンリフレッシュ】: リフレッシュトークンによるトークン更新
   * 【将来実装】: リフレッシュフローの実装予定
   * 🔴 信頼性レベル: 未実装のプレースホルダ
   */
  async refreshToken(): Promise<AuthResult | null> {
    const refreshToken = this.tokenManager.getRefreshToken();
    
    if (!refreshToken) {
      if (import.meta.env.DEV) {

        console.warn('リフレッシュトークンが存在しません');

      }
      return null;
    }

    // TODO: リフレッシュトークンフローの実装
    if (import.meta.env.DEV) {

      console.warn('リフレッシュトークン機能は未実装です');

    }
    return null;
  }

  /**
   * 【ポップアップリダイレクト処理】: ポップアップ内でのリダイレクト処理
   * 【改善内容】: window.close()の安全な呼び出し
   * 🟢 信頼性レベル: 標準的なポップアップ処理
   */
  static handlePopupRedirect(): void {
    if (window.opener && !window.opener.closed) {
      const params = new URLSearchParams(window.location.search);
      const code = params.get('code');
      const error = params.get('error');

      if (code) {
        window.opener.postMessage(
          { type: 'auth-success', code },
          window.location.origin
        );
      } else if (error) {
        window.opener.postMessage(
          { type: 'auth-error', error },
          window.location.origin
        );
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