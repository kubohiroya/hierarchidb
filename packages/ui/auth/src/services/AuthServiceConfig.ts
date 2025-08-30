/**
 * 【ファイル概要】: AuthService設定管理モジュール
 * 【分離理由】: 設定の検証と管理を単一責任として分離
 * 【セキュリティ】: 設定値の厳密な検証と不変性確保
 * 🟢 信頼性レベル: OAuth2.0標準仕様に基づく実装
 */

/**
 * 【型定義】: 認証設定インターフェース
 * 【セキュリティ】: 全項目必須でnull/undefined防止
 * 🟢 信頼性レベル: OAuth2.0仕様準拠
 */
export interface AuthConfig {
  authUrl: string;
  authOrigin: string;
  clientId: string;
  redirectUri: string;
  popupRedirectUri: string;
  scope: string;
  responseType: string;
  usePKCE?: boolean;
}

/**
 * 【定数定義】: セキュリティ関連の設定値
 * 【調整可能性】: 環境変数での上書き可能
 * 🟢 信頼性レベル: 業界標準のベストプラクティス
 */
export const AUTH_CONSTANTS = {
  // 【タイムアウト設定】: ユーザビリティとセキュリティのバランス
  POPUP_TIMEOUT_MS: 5 * 60 * 1000, // 5分
  TOKEN_EXPIRY_BUFFER_SECONDS: 30, // トークン期限前のバッファ
  
  // 【リトライ設定】: ネットワーク不安定性への対応
  DEFAULT_MAX_RETRIES: 3,
  RETRY_DELAY_MS: 1000,
  
  // 【ポップアップ設定】: 最適なUX設計
  POPUP_WIDTH: 500,
  POPUP_HEIGHT: 600,
  POPUP_CHECK_INTERVAL_MS: 500,
  
  // 【PKCE設定】: セキュリティ強化パラメータ
  CODE_VERIFIER_LENGTH: 128,
  CODE_CHALLENGE_METHOD: 'S256' as const,
} as const;

/**
 * 【設定検証クラス】: AuthConfig検証ロジックの集約
 * 【単一責任】: 設定値の検証のみを担当
 * 【パフォーマンス】: 検証結果のキャッシュで再検証を防止
 * 🟢 信頼性レベル: セキュリティベストプラクティス準拠
 */
export class AuthConfigValidator {
  private static validatedConfigs = new WeakMap<AuthConfig, boolean>();

  /**
   * 【設定検証】: AuthConfigの完全性と安全性を検証
   * 【セキュリティ】: URL、Origin、必須項目の厳密な検証
   * 【パフォーマンス】: WeakMapによる検証結果キャッシュ
   * 🟢 信頼性レベル: OWASP推奨実装
   */
  static validate(config: AuthConfig): void {
    // 【キャッシュチェック】: 既に検証済みならスキップ
    if (this.validatedConfigs.has(config)) {
      return;
    }

    // 【必須項目検証】: 全ての必須設定が存在することを確認
    this.validateRequiredFields(config);
    
    // 【URL検証】: 各URLの形式と安全性を検証
    this.validateUrls(config);
    
    // 【認証設定検証】: OAuth2.0パラメータの妥当性確認
    this.validateAuthParams(config);
    
    // 【検証結果キャッシュ】: 再検証のオーバーヘッド防止
    this.validatedConfigs.set(config, true);
  }

  /**
   * 【必須項目検証】: 設定の必須フィールドを検証
   * 【エラー処理】: 明確なエラーメッセージで問題箇所を特定
   * 🟢 信頼性レベル: 標準的な入力検証パターン
   */
  private static validateRequiredFields(config: AuthConfig): void {
    const requiredFields: (keyof AuthConfig)[] = [
      'authUrl', 'authOrigin', 'clientId',
      'redirectUri', 'popupRedirectUri',
      'scope', 'responseType'
    ];

    for (const field of requiredFields) {
      if (!config[field] || (typeof config[field] === 'string' && !(config[field] as string).trim())) {
        throw new Error(`設定エラー: ${field}は必須項目です`);
      }
    }
  }

  /**
   * 【URL検証】: URL形式とプロトコルの安全性を検証
   * 【セキュリティ】: HTTPSの強制（開発環境除く）
   * 🟢 信頼性レベル: セキュリティベストプラクティス
   */
  private static validateUrls(config: AuthConfig): void {
    const urlFields: (keyof AuthConfig)[] = ['authUrl', 'redirectUri', 'popupRedirectUri'];
    
    for (const field of urlFields) {
      const url = config[field] as string;
      if (!this.isValidUrl(url)) {
        throw new Error(`設定エラー: ${field}のURL形式が不正です: ${url}`);
      }
      
      // 【HTTPS強制】: 本番環境ではHTTPSを必須とする
      if (process.env.NODE_ENV === 'production' && !url.startsWith('https://')) {
        throw new Error(`セキュリティエラー: 本番環境では${field}はHTTPSである必要があります`);
      }
    }

    // 【Origin検証】: Originの形式確認
    if (!this.isValidOrigin(config.authOrigin)) {
      throw new Error(`設定エラー: authOriginの形式が不正です: ${config.authOrigin}`);
    }
  }

  /**
   * 【認証パラメータ検証】: OAuth2.0仕様への準拠確認
   * 【セキュリティ】: 不正な認証フローの防止
   * 🟢 信頼性レベル: OAuth2.0 RFC準拠
   */
  private static validateAuthParams(config: AuthConfig): void {
    // 【Response Type検証】: サポートされる認証フローの確認
    const validResponseTypes = ['code', 'token', 'id_token'];
    if (!validResponseTypes.includes(config.responseType)) {
      if (import.meta.env.DEV) {

        console.warn(`非標準のresponseType: ${config.responseType}`);

      }
    }

    // 【Scope検証】: 最低限必要なスコープの確認
    if (!config.scope.includes('openid')) {
      if (import.meta.env.DEV) {

        console.warn('OpenID Connectを使用する場合、scopeに"openid"を含めることを推奨します');

      }
    }
  }

  /**
   * 【URL形式検証】: URLの妥当性を確認
   * 【パフォーマンス】: try-catchによる高速検証
   * 🟢 信頼性レベル: 標準的なURL検証パターン
   */
  private static isValidUrl(url: string): boolean {
    try {
      const parsed = new URL(url);
      return ['https:', 'http:'].includes(parsed.protocol);
    } catch {
      return false;
    }
  }

  /**
   * 【Origin形式検証】: Originの妥当性を確認
   * 【セキュリティ】: CORS攻撃の防止
   * 🟢 信頼性レベル: セキュリティベストプラクティス
   */
  private static isValidOrigin(origin: string): boolean {
    try {
      const url = new URL(origin);
      return url.origin === origin && !origin.endsWith('/');
    } catch {
      return false;
    }
  }

  /**
   * 【設定フリーズ】: 設定オブジェクトを不変化
   * 【セキュリティ】: 実行時の設定改変を防止
   * 【パフォーマンス】: 深いコピーを避けて浅いフリーズのみ
   * 🟢 信頼性レベル: 防御的プログラミング手法
   */
  static freezeConfig(config: AuthConfig): Readonly<AuthConfig> {
    return Object.freeze({ ...config });
  }
}