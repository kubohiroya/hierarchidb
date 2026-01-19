/**
 * OAuth State Parameter Management for CSRF Protection
 * HMACKVS
 */

import type { Context } from 'hono';

interface StateData {
  origin?: string;
  timestamp: number;
  nonce: string;
}

interface SignedState extends StateData {
  signature: string;
}

/**
 * HMACState
 * KVSCSRF
 */
export class StateManager {
  private static readonly STATE_TTL = 600000; //  10
  private key: CryptoKey | null = null;

  constructor(private secret: string) {}

  /**
   * HMAC
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
   * HMAC
   */
  private async createSignature(data: StateData): Promise<string> {
    const key = await this.getKey();
    const encoder = new TextEncoder();
    const dataString = JSON.stringify({
      o: data.origin,
      t: data.timestamp,
      n: data.nonce,
    });

    const signature = await crypto.subtle.sign('HMAC', key, encoder.encode(dataString));

    //  Base64
    return btoa(String.fromCharCode(...new Uint8Array(signature)));
  }

  /**
   */
  private async verifySignature(data: StateData, signature: string): Promise<boolean> {
    try {
      const key = await this.getKey();
      const encoder = new TextEncoder();
      const dataString = JSON.stringify({
        o: data.origin,
        t: data.timestamp,
        n: data.nonce,
      });

      //  Base64
      const signatureBytes = Uint8Array.from(atob(signature), (c) => c.charCodeAt(0));

      return await crypto.subtle.verify('HMAC', key, signatureBytes, encoder.encode(dataString));
    } catch (error) {
      console.error('Signature verification error:', error);
      return false;
    }
  }

  /**
   * stateKVSHMAC
   */
  async createState(c: Context, origin?: string): Promise<string> {
    const stateData: StateData = {
      origin: origin || c.req.header('Origin'),
      timestamp: Date.now(),
      nonce: crypto.randomUUID().substring(0, 8),
    };

    //  HMAC
    const signature = await this.createSignature(stateData);

    const signedState: SignedState = {
      ...stateData,
      signature,
    };

    //  Base64
    return btoa(JSON.stringify(signedState));
  }

  private static decodeSignedState(state: string): SignedState | null {
    try {
      // Accept both base64 and base64url
      const normalized = state.replace(/-/g, '+').replace(/_/g, '/');
      const padded = normalized.padEnd(Math.ceil(normalized.length / 4) * 4, '=');
      return JSON.parse(atob(padded)) as SignedState;
    } catch (error) {
      console.warn(
        'State decode failed; skipping validation',
        error instanceof Error ? error.message : error
      );
      return null;
    }
  }

  /**
   * stateKVS
   */
  async validateState(state: string): Promise<StateData | null> {
    const signedState = StateManager.decodeSignedState(state);
    if (!signedState) {
      return null;
    }

    //  10
    const now = Date.now();
    if (now - signedState.timestamp > StateManager.STATE_TTL) {
      console.warn('State expired:', signedState.nonce);
      return null;
    }

    const stateData: StateData = {
      origin: signedState.origin,
      timestamp: signedState.timestamp,
      nonce: signedState.nonce,
    };

    const isValid = await this.verifySignature(stateData, signedState.signature);

    if (!isValid) {
      console.warn('Invalid atoms signature:', signedState.nonce);
      return null;
    }

    return stateData;
  }

  /**
   * stateorigin
   */
  static extractOriginFromState(state: string): string | undefined {
    const signedState = StateManager.decodeSignedState(state);
    return signedState?.origin;
  }
}
