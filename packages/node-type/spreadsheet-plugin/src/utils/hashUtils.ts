/**
  * @file utils/hashUtils.ts
 * @description
 * SHA-256
  */

/**
  * : SHA-256
 * : Web Crypto API
 * : SpreadsheetCSVApiDriver
 * : WebAPI
  */
export async function calculateFileHash(file: File): Promise<string> {
  //  ArrayBuffer
  const buffer = await file.arrayBuffer();
  return calculateBufferHash(buffer);
}

/**
  * : SHA-256
 * : TextEncoderUTF-8
 * :
 * :
  */
export async function calculateTextHash(text: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(text);
  return calculateBufferHash(data.buffer);
}

/**
  * : ArrayBufferSHA-256
 * : Web Crypto API16
 * :
 * : Web Crypto API
  */
export async function calculateBufferHash(buffer: ArrayBuffer): Promise<string> {
  //  Web Crypto APISHA-256
  const hashBuffer = await crypto.subtle.digest('SHA-256', buffer);

  //  16
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  const hashHex = hashArray.map((b) => b.toString(16).padStart(2, '0')).join('');

  return hashHex;
}

/**
  * :
 * :
 * :
 * :
  */
export async function calculateCombinedHash(buffers: Uint8Array[]): Promise<string> {
  const totalLength = buffers.reduce((sum, buf) => sum + buf.byteLength, 0);
  const combined = new Uint8Array(totalLength);

  let offset = 0;
  for (const buffer of buffers) {
    combined.set(new Uint8Array(buffer), offset);
    offset += buffer.byteLength;
  }

  return calculateBufferHash(combined.buffer);
}

/**
  * :
 * :
 * :
 * :
  */
export function compareHashes(hash1: string, hash2: string): boolean {
  return hash1.toLowerCase() === hash2.toLowerCase();
}

/**
  * :
 * :
 * : UI
 * :
  */
export function getShortHash(hash: string, length: number = 8): string {
  if (hash.length <= length) {
    return hash;
  }

  const halfLength = Math.floor(length / 2);
  const start = hash.substring(0, halfLength);
  const end = hash.substring(hash.length - halfLength);

  return `${start}...${end}`;
}
