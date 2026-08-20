import { validateYamlCanonicalPayload } from '@hierarchidb/yaml-api/validation';
import type {
  CanonicalYamlZipCodecError,
  DecodeCanonicalYamlZipResult,
  DecodedCanonicalYamlZipEntry,
} from './canonicalYamlZipCodecTypes.js';
import { CANONICAL_YAML_ZIP_LIMITS } from './constants.js';
import { decodeCanonicalYamlZipBase64 } from './decodeCanonicalYamlZipBase64.internalUtils.js';
import { inspectCanonicalYamlZipCentralDirectory } from './inspectCanonicalYamlZipCentralDirectory.internal.js';

function failure(
  code: CanonicalYamlZipCodecError['code'],
  entryIndex?: number,
  validationCode?: CanonicalYamlZipCodecError['validationCode']
): DecodeCanonicalYamlZipResult {
  const error: CanonicalYamlZipCodecError = {
    code,
    ...(entryIndex === undefined ? {} : { entryIndex }),
    ...(validationCode === undefined ? {} : { validationCode }),
  };
  return { ok: false, error };
}

function bytesEqual(left: Uint8Array, right: Uint8Array): boolean {
  if (left.length !== right.length) return false;
  for (let index = 0; index < left.length; index += 1) {
    if (left[index] !== right[index]) return false;
  }
  return true;
}

function decodeFatalUtf8(bytes: Uint8Array): string | undefined {
  try {
    const value = new TextDecoder('utf-8', { fatal: true }).decode(bytes);
    return bytesEqual(new TextEncoder().encode(value), bytes) ? value : undefined;
  } catch {
    return undefined;
  }
}

function resolveArchiveBytes(
  input: string | Uint8Array
):
  | Readonly<{ readonly ok: true; readonly bytes: Uint8Array }>
  | Readonly<{ readonly ok: false; readonly error: CanonicalYamlZipCodecError }> {
  if (typeof input === 'string') return decodeCanonicalYamlZipBase64(input);
  if (!(input instanceof Uint8Array)) {
    return { ok: false, error: { code: 'INVALID_INPUT' } };
  }
  if (input.length > CANONICAL_YAML_ZIP_LIMITS.archiveBytes) {
    return { ok: false, error: { code: 'ARCHIVE_TOO_LARGE' } };
  }
  return { ok: true, bytes: new Uint8Array(input) };
}

/** Decodes and validates the strict canonical YAML ZIP profile without storage access. */
export function decodeCanonicalYamlZip(input: string | Uint8Array): DecodeCanonicalYamlZipResult {
  try {
    const archiveBytes = resolveArchiveBytes(input);
    if (!archiveBytes.ok) return { ok: false, error: archiveBytes.error };

    const inspection = inspectCanonicalYamlZipCentralDirectory(archiveBytes.bytes);
    if (!inspection.ok) return { ok: false, error: inspection.error };

    const entries: DecodedCanonicalYamlZipEntry[] = [];
    for (const inspectedEntry of inspection.entries) {
      const content = decodeFatalUtf8(inspectedEntry.contentBytes);
      if (content === undefined) {
        return failure('INVALID_UTF8_CONTENT', inspectedEntry.occurrenceIndex);
      }

      const validation = validateYamlCanonicalPayload(inspectedEntry.filename, {
        subtype: inspectedEntry.registryEntry.subtype,
        schemaId: inspectedEntry.registryEntry.schemaId,
        content,
      });
      if (!validation.ok) {
        return failure(
          'CANONICAL_VALIDATION_FAILED',
          inspectedEntry.occurrenceIndex,
          validation.error.code
        );
      }

      const payload = Object.freeze({
        subtype: validation.value.subtype,
        schemaId: validation.value.schemaId,
        content: validation.value.content,
      });
      entries.push(
        Object.freeze({
          occurrenceIndex: inspectedEntry.occurrenceIndex,
          filename: inspectedEntry.filename,
          payload,
        })
      );
    }

    return {
      ok: true,
      value: Object.freeze({ entries: Object.freeze(entries) }),
    };
  } catch {
    return failure('INVALID_INPUT');
  }
}
