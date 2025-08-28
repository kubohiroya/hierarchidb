/**
 * 【ファイル概要】: 認証トークン管理モジュール
 * 【分離理由】: トークンのライフサイクル管理を単一責任として分離
 * 【セキュリティ】: トークンの安全な保存と有効期限管理
 * 🟢 信頼性レベル: OAuth2.0/JWT標準仕様準拠
 */

import { AUTH_CONSTANTS } from './AuthServiceConfig';

/**
 * 【型定義】: 認証結果インターフェース
 * 【セキュリティ】: トークン情報の構造化
 * 🟢 信頼性レベル: OAuth2.0標準
 */
export interface AuthToken {
  accessToken: string;
  refreshToken?: string;
  expiresIn: number;
  tokenType: string;
  issuedAt: number;
}

/**
 * 【トークン管理クラス】: トークンの保存・検証・更新を管理
 * 【単一責任】: トークンのライフサイクル管理のみ担当
 * 【セキュリティ】: メモリ内保存でXSS攻撃を軽減
 * 🟢 信頼性レベル: セキュリティベストプラクティス準拠
 */
export class AuthTokenManager {
  private currentToken: AuthToken | null = null;
  
  /**
   * 【トークン保存】: 新しいトークンを安全に保存
   * 【セキュリティ】: トークン情報のサニタイズと検証
   * 【パフォーマンス】: 不要なコピーを避けて参照を保持
   * 🟢 信頼性レベル: 標準的なトークン管理パターン
   */
  setToken(token: Omit<AuthToken, 'issuedAt'>): void {
    // 【入力検証】: 必須フィールドの確認
    if (!token.accessToken || !token.tokenType) {
      throw new Error('無効なトークン: accessTokenとtokenTypeは必須です');
    }

    // 【有効期限検証】: 正の数値であることを確認
    if (token.expiresIn <= 0) {
      throw new Error('無効なトークン有効期限: expiresInは正の数値である必要があります');
    }

    // 【トークン保存】: 発行時刻を記録して保存
    this.currentToken = {
      ...token,
      issuedAt: Date.now()
    };
  }

  /**
   * 【トークン取得】: 現在のトークンを取得
   * 【セキュリティ】: 有効期限切れトークンは返さない
   * 【パフォーマンス】: 有効性チェックを含む高速な取得
   * 🟢 信頼性レベル: 防御的プログラミング
   */
  getToken(): AuthToken | null {
    if (!this.isTokenValid()) {
      this.clearToken();
      return null;
    }
    return this.currentToken;
  }

  /**
   * 【トークン有効性確認】: トークンの有効期限を確認
   * 【セキュリティ】: バッファ時間を考慮した安全な判定
   * 【パフォーマンス】: 単純な時刻比較で高速判定
   * 🟢 信頼性レベル: JWT標準の有効期限確認
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
   * 【トークンクリア】: トークン情報を安全に削除
   * 【セキュリティ】: メモリからの完全な削除
   * 【メモリ管理】: 参照を明示的にnullに設定
   * 🟢 信頼性レベル: 標準的なクリーンアップパターン
   */
  clearToken(): void {
    this.currentToken = null;
  }

  /**
   * 【残り有効時間取得】: トークンの残り有効時間を秒単位で取得
   * 【ユーティリティ】: リフレッシュタイミングの判定用
   * 【パフォーマンス】: 単純な計算で高速
   * 🟡 信頼性レベル: 一般的な実装パターン
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
   * 【リフレッシュ必要性判定】: トークンリフレッシュが必要か判定
   * 【最適化】: 適切なタイミングでのリフレッシュ判定
   * 【パフォーマンス】: 不要なリフレッシュを防止
   * 🟡 信頼性レベル: 一般的なリフレッシュ戦略
   */
  needsRefresh(): boolean {
    const remaining = this.getRemainingSeconds();
    // 残り時間が1分未満ならリフレッシュ推奨
    return remaining > 0 && remaining < 60;
  }

  /**
   * 【アクセストークン取得】: アクセストークンのみを取得
   * 【簡便性】: 頻繁に使用されるトークンへの簡易アクセス
   * 🟢 信頼性レベル: 標準的なゲッターパターン
   */
  getAccessToken(): string | null {
    const token = this.getToken();
    return token?.accessToken ?? null;
  }

  /**
   * 【リフレッシュトークン取得】: リフレッシュトークンを取得
   * 【セキュリティ】: リフレッシュトークンへの制限付きアクセス
   * 🟢 信頼性レベル: OAuth2.0標準
   */
  getRefreshToken(): string | null {
    return this.currentToken?.refreshToken ?? null;
  }

  /**
   * 【認証済み判定】: 有効なトークンが存在するか確認
   * 【簡便性】: 認証状態の簡易チェック
   * 🟢 信頼性レベル: 標準的な認証チェック
   */
  isAuthenticated(): boolean {
    return this.isTokenValid() && this.currentToken !== null;
  }
}