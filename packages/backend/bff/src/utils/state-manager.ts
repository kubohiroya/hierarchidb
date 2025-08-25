/**
 * OAuth State Parameter Management for CSRF Protection
 * ステートレスなHMAC署名方式の実装（KVS不要）
 */

import { Context } from 'hono';

interface StateData {
  origin?: string;
  timestamp: number;
  nonce: string;
}

interface SignedState extends StateData {
  signature: string;
}

/**
 * HMAC署名を使用したステートレスなState管理
 * KVSを使わずにCSRF攻撃を防御
 */
export class StateManager {
  private static readonly STATE_TTL = 600000; // 10分間有効（ミリ秒）
  private key: CryptoKey | null = null;
  
  constructor(private secret: string) {}

  /**
   * HMAC署名用の鍵を取得（初回のみ生成）
   */
  private async getKey(): Promise<CryptoKey> {
    if (!this.key) {
      const encoder = new TextEncoder();
      this.key = await crypto.subtle.importKey(
        'raw',
        encoder.encode(this.secret),
        { name: 'HMAC', hash: 'SHA-256' },
        false,
        ['sign', 'verify']
      );
    }
    return this.key;
  }

  /**
   * データのHMAC署名を生成
   */
  private async createSignature(data: StateData): Promise<string> {
    const key = await this.getKey();
    const encoder = new TextEncoder();
    const dataString = JSON.stringify({
      o: data.origin,
      t: data.timestamp,
      n: data.nonce
    });
    
    const signature = await crypto.subtle.sign(
      'HMAC',
      key,
      encoder.encode(dataString)
    );
    
    // Base64エンコード
    return btoa(String.fromCharCode(...new Uint8Array(signature)));
  }

  /**
   * 署名を検証
   */
  private async verifySignature(data: StateData, signature: string): Promise<boolean> {
    try {
      const key = await this.getKey();
      const encoder = new TextEncoder();
      const dataString = JSON.stringify({
        o: data.origin,
        t: data.timestamp,
        n: data.nonce
      });
      
      // Base64デコード
      const signatureBytes = Uint8Array.from(atob(signature), c => c.charCodeAt(0));
      
      return await crypto.subtle.verify(
        'HMAC',
        key,
        signatureBytes,
        encoder.encode(dataString)
      );
    } catch (error) {
      console.error('Signature verification error:', error);
      return false;
    }
  }

  /**
   * 新しいstateを生成（KVS不要、HMAC署名付き）
   */
  async createState(c: Context, origin?: string): Promise<string> {
    const stateData: StateData = {
      origin: origin || c.req.header('Origin'),
      timestamp: Date.now(),
      nonce: crypto.randomUUID().substring(0, 8), // 短縮版
    };
    
    // HMAC署名を生成
    const signature = await this.createSignature(stateData);
    
    const signedState: SignedState = {
      ...stateData,
      signature
    };
    
    // Base64エンコードして返す
    return btoa(JSON.stringify(signedState));
  }

  /**
   * stateを検証（KVS不要、署名と有効期限をチェック）
   */
  async validateState(state: string): Promise<StateData | null> {
    try {
      // Base64デコード
      const signedState: SignedState = JSON.parse(atob(state));
      
      // タイムスタンプチェック（10分以内）
      const now = Date.now();
      if (now - signedState.timestamp > StateManager.STATE_TTL) {
        console.warn('State expired:', signedState.nonce);
        return null;
      }
      
      // 署名検証
      const stateData: StateData = {
        origin: signedState.origin,
        timestamp: signedState.timestamp,
        nonce: signedState.nonce
      };
      
      const isValid = await this.verifySignature(stateData, signedState.signature);
      
      if (!isValid) {
        console.warn('Invalid state signature:', signedState.nonce);
        return null;
      }
      
      return stateData;
    } catch (error) {
      console.error('State validation error:', error);
      return null;
    }
  }

  /**
   * stateからoriginを安全に取得（署名検証なし、表示用）
   */
  static extractOriginFromState(state: string): string | undefined {
    try {
      const signedState: SignedState = JSON.parse(atob(state));
      return signedState.origin;
    } catch {
      return undefined;
    }
  }
}