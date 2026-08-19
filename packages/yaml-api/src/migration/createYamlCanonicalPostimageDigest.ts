import type { YamlCanonicalMigrationPayload } from './yamlCoreDbMigrationTypes.js';

export type YamlCanonicalPostimageDigestErrorCode = 'DIGEST_PORT_FAILED' | 'INVALID_DIGEST_OUTPUT';

export class YamlCanonicalPostimageDigestError extends Error {
  constructor(readonly code: YamlCanonicalPostimageDigestErrorCode) {
    super('Failed to create a canonical YAML postimage digest');
    this.name = 'YamlCanonicalPostimageDigestError';
  }
}

function encodeLengthPrefixedUtf8(value: string): Uint8Array {
  const encoded = new TextEncoder().encode(value);
  const output = new Uint8Array(8 + encoded.byteLength);
  new DataView(output.buffer, output.byteOffset, 8).setBigUint64(
    0,
    BigInt(encoded.byteLength),
    false
  );
  output.set(encoded, 8);
  return output;
}

function concatenate(parts: readonly Uint8Array[]): Uint8Array {
  const totalLength = parts.reduce((length, part) => length + part.byteLength, 0);
  const output = new Uint8Array(totalLength);
  let offset = 0;
  for (const part of parts) {
    output.set(part, offset);
    offset += part.byteLength;
  }
  return output;
}

/** Creates the pinned SHA-256 digest for one canonical YAML postimage. */
export async function createYamlCanonicalPostimageDigest(
  filename: string,
  payload: YamlCanonicalMigrationPayload,
  digestSha256Hex: (bytes: Uint8Array) => Promise<string>
): Promise<string> {
  const bytes = concatenate(
    [filename, payload.subtype, payload.schemaId, payload.content].map(encodeLengthPrefixedUtf8)
  );

  let digest: string;
  try {
    digest = await digestSha256Hex(bytes);
  } catch {
    throw new YamlCanonicalPostimageDigestError('DIGEST_PORT_FAILED');
  }

  if (!/^[0-9a-f]{64}$/.test(digest)) {
    throw new YamlCanonicalPostimageDigestError('INVALID_DIGEST_OUTPUT');
  }
  return digest;
}
