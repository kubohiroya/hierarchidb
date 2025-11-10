/**
 * Helpers for working with the Web Crypto API in both browser and Node runtimes.
 * These utilities avoid importing Node's `crypto` module so that browser builds
 * do not emit unresolved module warnings.
 */

const UUID_BYTE_LENGTH = 16;

const getGlobalCrypto = (): Crypto | undefined => {
  if (typeof globalThis !== 'object' || !globalThis) {
    return undefined;
  }
  const maybeCrypto = (globalThis as typeof globalThis & { crypto?: Crypto }).crypto;
  return typeof maybeCrypto === 'object' ? maybeCrypto : undefined;
};

/**
 * Returns the global crypto object if available.
 */
export function getWebCrypto(): Crypto | undefined {
  return getGlobalCrypto();
}

/**
 * Ensures that the Web Crypto API exists and returns it, otherwise throws.
 */
export function requireWebCrypto(message?: string): Crypto {
  const cryptoObj = getGlobalCrypto();
  if (!cryptoObj) {
    throw new Error(message ?? '[webCrypto] globalThis.crypto is not available');
  }
  return cryptoObj;
}

const formatUuidFromBytes = (bytes: Uint8Array): string => {
  const hex = Array.from(bytes, (byte) => byte.toString(16).padStart(2, '0')).join('');
  return [
    hex.slice(0, 8),
    hex.slice(8, 12),
    hex.slice(12, 16),
    hex.slice(16, 20),
    hex.slice(20),
  ].join('-');
};

/**
 * Generates a UUID using the Web Crypto API. If Web Crypto is unavailable,
 * an error is thrown instead of falling back to insecure randomness.
 */
export function generateUUID(): string {
  const cryptoObj = requireWebCrypto('[webCrypto] generateUUID() requires globalThis.crypto');
  if (typeof cryptoObj.randomUUID === 'function') {
    return cryptoObj.randomUUID();
  }
  if (typeof cryptoObj.getRandomValues !== 'function') {
    throw new Error('[webCrypto] crypto.getRandomValues is required for generateUUID()');
  }
  const bytes = new Uint8Array(UUID_BYTE_LENGTH);
  cryptoObj.getRandomValues(bytes);
  // RFC 4122 variant 1 (version 4)
  const byte6 = bytes[6]!;
  const byte8 = bytes[8]!;
  bytes[6] = (byte6 & 0x0f) | 0x40;
  bytes[8] = (byte8 & 0x3f) | 0x80;
  return formatUuidFromBytes(bytes);
}

const normalizeToArrayBuffer = (input: ArrayBuffer | Uint8Array): ArrayBuffer => {
  if (input instanceof ArrayBuffer) {
    return input;
  }
  // slice() clones into a new Uint8Array whose backing buffer is guaranteed to be an ArrayBuffer
  return input.slice().buffer;
};

/**
 * Computes a SHA-256 digest and returns the result as a lowercase hex string.
 */
export async function digestSha256Hex(input: ArrayBuffer | Uint8Array): Promise<string> {
  const cryptoObj = requireWebCrypto('[webCrypto] crypto.subtle is required for SHA-256 hashing');
  if (!cryptoObj.subtle || typeof cryptoObj.subtle.digest !== 'function') {
    throw new Error('[webCrypto] SubtleCrypto.digest is not available in this environment');
  }
  const normalizedInput = normalizeToArrayBuffer(input);
  const hashBuffer = await cryptoObj.subtle.digest('SHA-256', normalizedInput);
  const hashBytes = new Uint8Array(hashBuffer);
  return Array.from(hashBytes, (byte) => byte.toString(16).padStart(2, '0')).join('');
}
