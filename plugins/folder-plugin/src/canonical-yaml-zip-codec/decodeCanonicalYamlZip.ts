import {
  YAML_SUBTYPE_REGISTRY,
  type YamlCanonicalFilename,
  type YamlSubtypeRegistryEntry,
} from '@hierarchidb/yaml-api';
import { validateYamlCanonicalPayload } from '@hierarchidb/yaml-api/validation';
import type {
  CanonicalYamlZipCodecError,
  DecodeCanonicalYamlZipResult,
  DecodedCanonicalYamlZipEntry,
} from './canonicalYamlZipCodecTypes.js';
import { decodeCanonicalYamlZipUtf8 } from './canonicalYamlZipUtf8.internalUtils.js';
import { CANONICAL_YAML_ZIP_LIMITS } from './constants.js';
import { decodeCanonicalYamlZipBase64 } from './decodeCanonicalYamlZipBase64.internalUtils.js';
import {
  type InspectedCanonicalYamlZipEntry,
  inspectCanonicalYamlZipCentralDirectory,
} from './inspectCanonicalYamlZipCentralDirectory.internal.js';

interface Utf8DecodedCanonicalYamlZipEntry {
  readonly inspectedEntry: InspectedCanonicalYamlZipEntry;
  readonly content: string;
}

interface RegistryResolvedCanonicalYamlZipEntry {
  readonly occurrenceIndex: number;
  readonly filename: YamlCanonicalFilename;
  readonly registryEntry: YamlSubtypeRegistryEntry;
  readonly content: string;
}

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

function isUnsafeFilename(filename: string): boolean {
  return (
    filename.length === 0 ||
    filename.includes('\0') ||
    filename.includes('/') ||
    filename.includes('\\') ||
    filename === '.' ||
    filename === '..' ||
    filename.startsWith('/') ||
    /^[A-Za-z]:/.test(filename) ||
    filename.normalize('NFC') !== filename
  );
}

function findRegistryEntry(filename: string): YamlSubtypeRegistryEntry | undefined {
  return Object.values(YAML_SUBTYPE_REGISTRY).find((entry) => entry.fileName === filename);
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

    const utf8DecodedEntries: Utf8DecodedCanonicalYamlZipEntry[] = [];
    for (const inspectedEntry of inspection.entries) {
      const content = decodeCanonicalYamlZipUtf8(inspectedEntry.contentBytes);
      if (content === undefined) {
        return failure('INVALID_UTF8_CONTENT', inspectedEntry.occurrenceIndex);
      }
      utf8DecodedEntries.push({ inspectedEntry, content });
    }

    const registryResolvedEntries: RegistryResolvedCanonicalYamlZipEntry[] = [];
    for (const utf8DecodedEntry of utf8DecodedEntries) {
      const { inspectedEntry, content } = utf8DecodedEntry;
      const { decodedFilename } = inspectedEntry;
      if (decodedFilename.endsWith('/')) {
        return failure('DIRECTORY_ENTRY_UNSUPPORTED', inspectedEntry.occurrenceIndex);
      }
      if (isUnsafeFilename(decodedFilename)) {
        return failure('UNSAFE_FILENAME', inspectedEntry.occurrenceIndex);
      }
      const registryEntry = findRegistryEntry(decodedFilename);
      if (registryEntry === undefined) {
        return failure('UNKNOWN_FILENAME', inspectedEntry.occurrenceIndex);
      }
      registryResolvedEntries.push({
        occurrenceIndex: inspectedEntry.occurrenceIndex,
        filename: registryEntry.fileName,
        registryEntry,
        content,
      });
    }

    const entries: DecodedCanonicalYamlZipEntry[] = [];
    for (const registryResolvedEntry of registryResolvedEntries) {
      const validation = validateYamlCanonicalPayload(registryResolvedEntry.filename, {
        subtype: registryResolvedEntry.registryEntry.subtype,
        schemaId: registryResolvedEntry.registryEntry.schemaId,
        content: registryResolvedEntry.content,
      });
      if (!validation.ok) {
        return failure(
          'CANONICAL_VALIDATION_FAILED',
          registryResolvedEntry.occurrenceIndex,
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
          occurrenceIndex: registryResolvedEntry.occurrenceIndex,
          filename: registryResolvedEntry.filename,
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
