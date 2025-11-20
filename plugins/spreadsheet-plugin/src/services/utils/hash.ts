const encoder = new TextEncoder();

function toHex(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer);
  return Array.from(bytes)
    .map((byte) => byte.toString(16).padStart(2, '0'))
    .join('');
}

async function digest(buffer: ArrayBuffer): Promise<string> {
  if (globalThis.crypto?.subtle) {
    const hash = await globalThis.crypto.subtle.digest('SHA-256', buffer);
    return toHex(hash);
  }
  throw new Error('Web Crypto API is not available');
}

export async function hashArrayBuffer(buffer: ArrayBuffer): Promise<string> {
  return await digest(buffer);
}

export async function hashFile(file: Blob): Promise<string> {
  if (typeof file.arrayBuffer === 'function') {
    const buffer = await file.arrayBuffer();
    return await digest(buffer);
  }
  if (typeof Response !== 'undefined') {
    const response = new Response(file);
    const buffer = await response.arrayBuffer();
    return await digest(buffer);
  }
  if (typeof file.text === 'function') {
    const text = await file.text();
    return await hashText(text);
  }
  throw new Error('Unable to hash file: Blob implementation lacks arrayBuffer/text helpers.');
}

export async function hashText(value: string): Promise<string> {
  return await digest(encoder.encode(value).buffer);
}
