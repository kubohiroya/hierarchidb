/**
 * 【ファイル概要】: 認証セキュリティユーティリティ
 * 【分離理由】: セキュリティ関連の処理を集約管理
 * 【セキュリティ】: PKCE、state、nonceなどのセキュリティパラメータ生成
 * 🟢 信頼性レベル: OAuth2.0 Security BCP (RFC 8252)準拠
 */

import { AUTH_CONSTANTS } from './AuthServiceConfig';

/**
 * 【セキュリティユーティリティクラス】: 暗号学的に安全なパラメータ生成
 * 【単一責任】: セキュリティパラメータの生成のみ担当
 * 【パフォーマンス】: Web Crypto APIを使用した高速な乱数生成
 * 🟢 信頼性レベル: IETF RFC標準準拠
 */
export class AuthSecurityUtils {
  /**
   * 【State生成】: CSRF攻撃防止用のstateパラメータ生成
   * 【セキュリティ】: 暗号学的に安全な乱数を使用
   * 【仕様準拠】: OAuth2.0 Security BCPに準拠した実装
   * 🟢 信頼性レベル: RFC 6749 Section 10.12準拠
   */
  static generateState(): string {
    const array = new Uint8Array(32);
    crypto.getRandomValues(array);
    return this.base64UrlEncode(array);
  }

  /**
   * 【Nonce生成】: リプレイ攻撃防止用のnonceパラメータ生成
   * 【セキュリティ】: OpenID Connect仕様に準拠
   * 【一意性保証】: 暗号学的に安全な乱数で衝突確率を最小化
   * 🟢 信頼性レベル: OpenID Connect Core 1.0準拠
   */
  static generateNonce(): string {
    const array = new Uint8Array(32);
    crypto.getRandomValues(array);
    return this.base64UrlEncode(array);
  }

  /**
   * 【Code Verifier生成】: PKCE用のcode_verifier生成
   * 【セキュリティ】: RFC 7636仕様に準拠した長さと文字セット
   * 【パフォーマンス】: 必要最小限の演算で生成
   * 🟢 信頼性レベル: RFC 7636 Section 4.1準拠
   */
  static generateCodeVerifier(): string {
    const array = new Uint8Array(AUTH_CONSTANTS.CODE_VERIFIER_LENGTH / 2);
    crypto.getRandomValues(array);
    return this.base64UrlEncode(array);
  }

  /**
   * 【Code Challenge生成】: code_verifierからcode_challenge生成
   * 【セキュリティ】: SHA-256ハッシュを使用
   * 【非同期処理】: Web Crypto APIの非同期ハッシュ計算
   * 🟢 信頼性レベル: RFC 7636 Section 4.2準拠
   */
  static async generateCodeChallenge(verifier: string): Promise<string> {
    // 【入力検証】: 空のverifierは拒否
    if (!verifier) {
      throw new Error('Code verifierが必要です');
    }

    // 【SHA-256ハッシュ計算】: Web Crypto APIを使用
    const encoder = new TextEncoder();
    const data = encoder.encode(verifier);
    const hashBuffer = await crypto.subtle.digest('SHA-256', data);
    
    // 【Base64URL変換】: ハッシュ値をBase64URL形式に変換
    const hashArray = new Uint8Array(hashBuffer);
    return this.base64UrlEncode(hashArray);
  }

  /**
   * 【Base64URLエンコード】: URLセーフなBase64エンコーディング
   * 【仕様準拠】: RFC 4648 Section 5準拠
   * 【パフォーマンス】: 効率的な文字列変換
   * 🟢 信頼性レベル: RFC 4648準拠
   */
  private static base64UrlEncode(buffer: Uint8Array): string {
    // 【Base64変換】: バイト配列を文字列に変換
    const base64 = btoa(String.fromCharCode(...buffer));
    
    // 【URLセーフ変換】: +を-に、/を_に変換し、パディングを除去
    return base64
      .replace(/\+/g, '-')
      .replace(/\//g, '_')
      .replace(/=/g, '');
  }

  /**
   * 【Origin検証】: メッセージイベントのOrigin検証
   * 【セキュリティ】: クロスオリジン攻撃の防止
   * 【厳密性】: 完全一致による安全な検証
   * 🟢 信頼性レベル: セキュリティベストプラクティス
   */
  static isValidMessageOrigin(eventOrigin: string, expectedOrigin: string): boolean {
    // 【null/undefined対策】: 両方の値が存在することを確認
    if (!eventOrigin || !expectedOrigin) {
      return false;
    }

    // 【完全一致検証】: 部分一致を許可しない
    return eventOrigin === expectedOrigin;
  }

  /**
   * 【セキュアランダム文字列生成】: 汎用的なランダム文字列生成
   * 【カスタマイズ可能】: 長さを指定可能
   * 【用途】: セッションID、一時的な識別子など
   * 🟡 信頼性レベル: 一般的なセキュリティパターン
   */
  static generateSecureRandomString(length: number = 32): string {
    const array = new Uint8Array(length);
    crypto.getRandomValues(array);
    return Array.from(array, byte => byte.toString(16).padStart(2, '0')).join('');
  }

  /**
   * 【タイムスタンプ検証】: タイムスタンプの妥当性確認
   * 【セキュリティ】: タイムスタンプ攻撃の防止
   * 【許容範囲】: 前後5分の誤差を許容
   * 🟡 信頼性レベル: 一般的なタイムスタンプ検証
   */
  static isValidTimestamp(timestamp: number, toleranceSeconds: number = 300): boolean {
    const now = Date.now();
    const diff = Math.abs(now - timestamp);
    return diff <= toleranceSeconds * 1000;
  }

  /**
   * 【スコープ検証】: OAuth2.0スコープの妥当性確認
   * 【セキュリティ】: 過剰な権限要求の防止
   * 【ホワイトリスト】: 許可されたスコープのみ承認
   * 🟢 信頼性レベル: OAuth2.0ベストプラクティス
   */
  static validateScopes(requestedScopes: string, allowedScopes: string[]): boolean {
    const requested = requestedScopes.split(' ').filter(s => s.length > 0);
    return requested.every(scope => allowedScopes.includes(scope));
  }

  /**
   * 【URLパラメータサニタイズ】: URLパラメータの安全な構築
   * 【XSS防止】: 特殊文字の適切なエスケープ
   * 【パフォーマンス】: URLSearchParamsを使用した効率的な処理
   * 🟢 信頼性レベル: セキュリティベストプラクティス
   */
  static buildSecureUrl(baseUrl: string, params: Record<string, string>): string {
    const url = new URL(baseUrl);
    const searchParams = new URLSearchParams();

    // 【パラメータ追加】: 各パラメータを安全に追加
    Object.entries(params).forEach(([key, value]) => {
      if (value !== undefined && value !== null) {
        searchParams.append(key, value);
      }
    });

    // 【URL構築】: エンコーディング済みのURLを返す
    url.search = searchParams.toString();
    return url.toString();
  }
}