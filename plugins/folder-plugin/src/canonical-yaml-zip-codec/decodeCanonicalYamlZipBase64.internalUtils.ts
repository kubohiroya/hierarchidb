import type { CanonicalYamlZipCodecError } from './canonicalYamlZipCodecTypes.js';
import { CANONICAL_YAML_ZIP_LIMITS } from './constants.js';
import { encodeCanonicalYamlZipBase64 } from './encodeCanonicalYamlZipBase64.internalUtils.js';

type DecodeCanonicalYamlZipBase64Result =
  | Readonly<{ readonly ok: true; readonly bytes: Uint8Array }>
  | Readonly<{ readonly ok: false; readonly error: CanonicalYamlZipCodecError }>;

const MAX_BASE64_LENGTH = Math.ceil(CANONICAL_YAML_ZIP_LIMITS.archiveBytes / 3) * 4;
const STANDARD_PADDED_BASE64 = /^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/;

export function decodeCanonicalYamlZipBase64(value: string): DecodeCanonicalYamlZipBase64Result {
  if (
    value.length === 0 ||
    value.length > MAX_BASE64_LENGTH ||
    value.length % 4 !== 0 ||
    !STANDARD_PADDED_BASE64.test(value)
  ) {
    return { ok: false, error: { code: 'INVALID_BASE64' } };
  }

  try {
    const binary = atob(value);
    if (binary.length > CANONICAL_YAML_ZIP_LIMITS.archiveBytes) {
      return { ok: false, error: { code: 'ARCHIVE_TOO_LARGE' } };
    }
    const bytes = new Uint8Array(binary.length);
    for (let index = 0; index < binary.length; index += 1) {
      bytes[index] = binary.charCodeAt(index);
    }
    if (encodeCanonicalYamlZipBase64(bytes) !== value) {
      return { ok: false, error: { code: 'INVALID_BASE64' } };
    }
    return { ok: true, bytes };
  } catch {
    return { ok: false, error: { code: 'INVALID_BASE64' } };
  }
}
