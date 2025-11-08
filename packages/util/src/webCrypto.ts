/**
 * Helpers for working with the Web Crypto API in both browser and Node runtimes.
 * These utilities avoid importing Node's `crypto` module so that browser builds
 * do not emit unresolved module warnings.
 */

type WebCryptoLike = Partial<Crypto>;

const getGlobalCrypto = (): WebCryptoLike | undefined => {
  if (typeof globalThis !== 'object' || !globalThis) return undefined;
  return (globalThis as typeof globalThis & { crypto?: WebCryptoLike }).crypto;
};

/**
 * Returns the global crypto object if available.
 */
export function getWebCrypto(): WebCryptoLike | undefined {
  return getGlobalCrypto();
}

/**
 * Ensures that the Web Crypto API exists and returns it, otherwise throws.
 */
export function requireWebCrypto(message?: string): WebCryptoLike {
  const cryptoObj = getGlobalCrypto();
  if (!cryptoObj) {
    throw new Error(message ?? '[webCrypto] globalThis.crypto is not available');
  }
  return cryptoObj;
}

/**
 * Generates a UUID using the Web Crypto API when available, falling back to a
 * timestamp + random suffix for legacy or test environments.
 */
export function safeRandomUUID(prefix = 'id'): string {
  const cryptoObj = getGlobalCrypto();
  if (cryptoObj?.randomUUID) {
    return cryptoObj.randomUUID();
  }
  const timestamp = Date.now().toString(36);
  const random = Math.random().toString(36).slice(2, 10);
  return `${prefix}-${timestamp}-${random}`;
}

/**
 * Computes a SHA-256 digest and returns the result as a lowercase hex string.
 */
export async function digestSha256Hex(input: ArrayBuffer | Uint8Array): Promise<string> {
  const cryptoObj = requireWebCrypto('[webCrypto] crypto.subtle is required for SHA-256 hashing');
  if (!cryptoObj.subtle || typeof cryptoObj.subtle.digest !== 'function') {
    throw new Error('[webCrypto] SubtleCrypto.digest is not available in this environment');
  }
  const data = input instanceof Uint8Array ? input : new Uint8Array(input);
  const hashBuffer = await cryptoObj.subtle.digest('SHA-256', data);
  const hashBytes = new Uint8Array(hashBuffer);
  return Array.from(hashBytes, (byte) => byte.toString(16).padStart(2, '0')).join('');
}
