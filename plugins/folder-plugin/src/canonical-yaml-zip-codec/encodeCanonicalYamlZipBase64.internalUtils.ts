const BINARY_STRING_CHUNK_BYTES = 0x8000;

export function encodeCanonicalYamlZipBase64(bytes: Uint8Array): string {
  let binary = '';
  for (let offset = 0; offset < bytes.length; offset += BINARY_STRING_CHUNK_BYTES) {
    const chunk = bytes.subarray(offset, offset + BINARY_STRING_CHUNK_BYTES);
    for (const byte of chunk) {
      binary += String.fromCharCode(byte);
    }
  }
  return btoa(binary);
}
