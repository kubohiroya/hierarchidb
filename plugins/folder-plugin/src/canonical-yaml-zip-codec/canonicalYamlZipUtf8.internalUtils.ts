function bytesEqual(left: Uint8Array, right: Uint8Array): boolean {
  if (left.length !== right.length) return false;
  for (let index = 0; index < left.length; index += 1) {
    if (left[index] !== right[index]) return false;
  }
  return true;
}

export function decodeCanonicalYamlZipUtf8(bytes: Uint8Array): string | undefined {
  try {
    const value = new TextDecoder('utf-8', { fatal: true, ignoreBOM: true }).decode(bytes);
    return bytesEqual(new TextEncoder().encode(value), bytes) ? value : undefined;
  } catch {
    return undefined;
  }
}

export function encodeCanonicalYamlZipUtf8(value: string): Uint8Array | undefined {
  const bytes = new TextEncoder().encode(value);
  return decodeCanonicalYamlZipUtf8(bytes) === value ? bytes : undefined;
}
