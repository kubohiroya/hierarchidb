import { YAML_SUBTYPE_REGISTRY, type YamlCanonicalFilename } from '@hierarchidb/yaml-api';
import { validateYamlCanonicalPayload } from '@hierarchidb/yaml-api/validation';
import { calculateCanonicalYamlZipCrc32 } from './calculateCanonicalYamlZipCrc32.internalUtils.js';
import type {
  CanonicalYamlZipCodecError,
  CanonicalYamlZipInputEntry,
  EncodeCanonicalYamlZipResult,
} from './canonicalYamlZipCodecTypes.js';
import {
  CANONICAL_YAML_ZIP_LIMITS,
  CANONICAL_YAML_ZIP_STORE_METHOD,
  CANONICAL_YAML_ZIP_UTF8_FLAG,
} from './constants.js';
import { encodeCanonicalYamlZipBase64 } from './encodeCanonicalYamlZipBase64.internalUtils.js';

const LOCAL_FILE_HEADER_SIGNATURE = 0x04034b50;
const CENTRAL_DIRECTORY_HEADER_SIGNATURE = 0x02014b50;
const END_OF_CENTRAL_DIRECTORY_SIGNATURE = 0x06054b50;
const LOCAL_FILE_HEADER_BYTES = 30;
const CENTRAL_DIRECTORY_HEADER_BYTES = 46;
const END_OF_CENTRAL_DIRECTORY_BYTES = 22;
const ZIP_VERSION_20 = 20;
const FIXED_DOS_TIME = 0;
const FIXED_DOS_DATE = 0x0021;

interface ValidatedEncodeEntry {
  readonly filename: YamlCanonicalFilename;
  readonly filenameBytes: Uint8Array;
  readonly contentBytes: Uint8Array;
  readonly crc32: number;
}

type ValidateEncodeEntriesResult =
  | Readonly<{ readonly ok: true; readonly entries: readonly ValidatedEncodeEntry[] }>
  | Readonly<{ readonly ok: false; readonly error: CanonicalYamlZipCodecError }>;

function failure(
  code: CanonicalYamlZipCodecError['code'],
  entryIndex?: number,
  validationCode?: CanonicalYamlZipCodecError['validationCode']
): Readonly<{ readonly ok: false; readonly error: CanonicalYamlZipCodecError }> {
  const error: CanonicalYamlZipCodecError = {
    code,
    ...(entryIndex === undefined ? {} : { entryIndex }),
    ...(validationCode === undefined ? {} : { validationCode }),
  };
  return { ok: false, error };
}

function writeUint16(bytes: Uint8Array, offset: number, value: number): void {
  bytes[offset] = value & 0xff;
  bytes[offset + 1] = (value >>> 8) & 0xff;
}

function writeUint32(bytes: Uint8Array, offset: number, value: number): void {
  bytes[offset] = value & 0xff;
  bytes[offset + 1] = (value >>> 8) & 0xff;
  bytes[offset + 2] = (value >>> 16) & 0xff;
  bytes[offset + 3] = (value >>> 24) & 0xff;
}

function compareBytes(left: Uint8Array, right: Uint8Array): number {
  const sharedLength = Math.min(left.length, right.length);
  for (let index = 0; index < sharedLength; index += 1) {
    const leftByte = left[index] ?? 0;
    const rightByte = right[index] ?? 0;
    if (leftByte !== rightByte) return leftByte - rightByte;
  }
  return left.length - right.length;
}

function encodeLosslessUtf8(value: string): Uint8Array | undefined {
  const bytes = new TextEncoder().encode(value);
  try {
    return new TextDecoder('utf-8', { fatal: true }).decode(bytes) === value ? bytes : undefined;
  } catch {
    return undefined;
  }
}

function isPlainEntry(value: unknown): value is Readonly<Record<PropertyKey, unknown>> {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) return false;
  const prototype = Object.getPrototypeOf(value);
  if (prototype !== Object.prototype && prototype !== null) return false;
  const ownKeys = Reflect.ownKeys(value);
  if (ownKeys.length !== 2 || !ownKeys.includes('filename') || !ownKeys.includes('payload')) {
    return false;
  }
  return ownKeys.every((key) => {
    const descriptor = Object.getOwnPropertyDescriptor(value, key);
    return descriptor !== undefined && Object.hasOwn(descriptor, 'value');
  });
}

function readDataProperty(
  value: Readonly<Record<PropertyKey, unknown>>,
  key: 'filename' | 'payload'
): unknown {
  const descriptor = Object.getOwnPropertyDescriptor(value, key);
  return descriptor !== undefined && Object.hasOwn(descriptor, 'value')
    ? descriptor.value
    : undefined;
}

function findRegistryEntry(
  filename: string
): (typeof YAML_SUBTYPE_REGISTRY)[keyof typeof YAML_SUBTYPE_REGISTRY] | undefined {
  return Object.values(YAML_SUBTYPE_REGISTRY).find((entry) => entry.fileName === filename);
}

function validateEncodeEntries(
  inputEntries: readonly CanonicalYamlZipInputEntry[]
): ValidateEncodeEntriesResult {
  if (inputEntries.length > CANONICAL_YAML_ZIP_LIMITS.entryCount) {
    return failure('ENTRY_LIMIT_EXCEEDED');
  }

  const validatedEntries: ValidatedEncodeEntry[] = [];
  let totalContentBytes = 0;

  for (let entryIndex = 0; entryIndex < inputEntries.length; entryIndex += 1) {
    const inputEntry: unknown = inputEntries[entryIndex];
    if (!isPlainEntry(inputEntry)) return failure('INVALID_INPUT', entryIndex);

    const filenameValue = readDataProperty(inputEntry, 'filename');
    const payloadValue = readDataProperty(inputEntry, 'payload');
    if (typeof filenameValue !== 'string') return failure('INVALID_INPUT', entryIndex);

    const registryEntry = findRegistryEntry(filenameValue);
    if (registryEntry === undefined) return failure('UNKNOWN_FILENAME', entryIndex);

    const duplicateIndex = validatedEntries.findIndex(
      (entry) => entry.filename === registryEntry.fileName
    );
    if (duplicateIndex !== -1) return failure('DUPLICATE_FILENAME', entryIndex);

    const validation = validateYamlCanonicalPayload(filenameValue, payloadValue);
    if (!validation.ok) {
      return failure('CANONICAL_VALIDATION_FAILED', entryIndex, validation.error.code);
    }

    const filenameBytes = encodeLosslessUtf8(registryEntry.fileName);
    const contentBytes = encodeLosslessUtf8(validation.value.content);
    if (filenameBytes === undefined) return failure('INVALID_UTF8_FILENAME', entryIndex);
    if (contentBytes === undefined) return failure('INVALID_UTF8_CONTENT', entryIndex);
    if (contentBytes.length > CANONICAL_YAML_ZIP_LIMITS.entryBytes) {
      return failure('ENTRY_TOO_LARGE', entryIndex);
    }
    totalContentBytes += contentBytes.length;
    if (totalContentBytes > CANONICAL_YAML_ZIP_LIMITS.totalContentBytes) {
      return failure('TOTAL_CONTENT_TOO_LARGE', entryIndex);
    }

    validatedEntries.push({
      filename: registryEntry.fileName,
      filenameBytes,
      contentBytes,
      crc32: calculateCanonicalYamlZipCrc32(contentBytes),
    });
  }

  return {
    ok: true,
    entries: validatedEntries.sort((left, right) =>
      compareBytes(left.filenameBytes, right.filenameBytes)
    ),
  };
}

function calculateArchiveLength(entries: readonly ValidatedEncodeEntry[]): number {
  let localBytes = 0;
  let centralBytes = 0;
  for (const entry of entries) {
    localBytes += LOCAL_FILE_HEADER_BYTES + entry.filenameBytes.length + entry.contentBytes.length;
    centralBytes += CENTRAL_DIRECTORY_HEADER_BYTES + entry.filenameBytes.length;
  }
  return localBytes + centralBytes + END_OF_CENTRAL_DIRECTORY_BYTES;
}

function writeLocalEntry(archive: Uint8Array, offset: number, entry: ValidatedEncodeEntry): number {
  writeUint32(archive, offset, LOCAL_FILE_HEADER_SIGNATURE);
  writeUint16(archive, offset + 4, ZIP_VERSION_20);
  writeUint16(archive, offset + 6, CANONICAL_YAML_ZIP_UTF8_FLAG);
  writeUint16(archive, offset + 8, CANONICAL_YAML_ZIP_STORE_METHOD);
  writeUint16(archive, offset + 10, FIXED_DOS_TIME);
  writeUint16(archive, offset + 12, FIXED_DOS_DATE);
  writeUint32(archive, offset + 14, entry.crc32);
  writeUint32(archive, offset + 18, entry.contentBytes.length);
  writeUint32(archive, offset + 22, entry.contentBytes.length);
  writeUint16(archive, offset + 26, entry.filenameBytes.length);
  writeUint16(archive, offset + 28, 0);
  archive.set(entry.filenameBytes, offset + LOCAL_FILE_HEADER_BYTES);
  archive.set(entry.contentBytes, offset + LOCAL_FILE_HEADER_BYTES + entry.filenameBytes.length);
  return offset + LOCAL_FILE_HEADER_BYTES + entry.filenameBytes.length + entry.contentBytes.length;
}

function writeCentralEntry(
  archive: Uint8Array,
  offset: number,
  localOffset: number,
  entry: ValidatedEncodeEntry
): number {
  writeUint32(archive, offset, CENTRAL_DIRECTORY_HEADER_SIGNATURE);
  writeUint16(archive, offset + 4, ZIP_VERSION_20);
  writeUint16(archive, offset + 6, ZIP_VERSION_20);
  writeUint16(archive, offset + 8, CANONICAL_YAML_ZIP_UTF8_FLAG);
  writeUint16(archive, offset + 10, CANONICAL_YAML_ZIP_STORE_METHOD);
  writeUint16(archive, offset + 12, FIXED_DOS_TIME);
  writeUint16(archive, offset + 14, FIXED_DOS_DATE);
  writeUint32(archive, offset + 16, entry.crc32);
  writeUint32(archive, offset + 20, entry.contentBytes.length);
  writeUint32(archive, offset + 24, entry.contentBytes.length);
  writeUint16(archive, offset + 28, entry.filenameBytes.length);
  writeUint16(archive, offset + 30, 0);
  writeUint16(archive, offset + 32, 0);
  writeUint16(archive, offset + 34, 0);
  writeUint16(archive, offset + 36, 0);
  writeUint32(archive, offset + 38, 0);
  writeUint32(archive, offset + 42, localOffset);
  archive.set(entry.filenameBytes, offset + CENTRAL_DIRECTORY_HEADER_BYTES);
  return offset + CENTRAL_DIRECTORY_HEADER_BYTES + entry.filenameBytes.length;
}

/** Encodes validated canonical YAML entries into the strict deterministic ZIP profile. */
export function encodeCanonicalYamlZip(
  inputEntries: readonly CanonicalYamlZipInputEntry[]
): EncodeCanonicalYamlZipResult {
  try {
    if (!Array.isArray(inputEntries)) return failure('INVALID_INPUT');
    const validated = validateEncodeEntries(inputEntries);
    if (!validated.ok) return validated;
    const entries = validated.entries;

    const archiveLength = calculateArchiveLength(entries);
    if (archiveLength > CANONICAL_YAML_ZIP_LIMITS.archiveBytes) {
      return failure('ARCHIVE_TOO_LARGE');
    }

    const archive = new Uint8Array(archiveLength);
    const localOffsets: number[] = [];
    let cursor = 0;
    for (const entry of entries) {
      localOffsets.push(cursor);
      cursor = writeLocalEntry(archive, cursor, entry);
    }

    const centralDirectoryOffset = cursor;
    for (let entryIndex = 0; entryIndex < entries.length; entryIndex += 1) {
      const entry = entries[entryIndex];
      const localOffset = localOffsets[entryIndex];
      if (entry === undefined || localOffset === undefined) return failure('INVALID_INPUT');
      cursor = writeCentralEntry(archive, cursor, localOffset, entry);
    }
    const centralDirectorySize = cursor - centralDirectoryOffset;

    writeUint32(archive, cursor, END_OF_CENTRAL_DIRECTORY_SIGNATURE);
    writeUint16(archive, cursor + 4, 0);
    writeUint16(archive, cursor + 6, 0);
    writeUint16(archive, cursor + 8, entries.length);
    writeUint16(archive, cursor + 10, entries.length);
    writeUint32(archive, cursor + 12, centralDirectorySize);
    writeUint32(archive, cursor + 16, centralDirectoryOffset);
    writeUint16(archive, cursor + 20, 0);

    return {
      ok: true,
      value: Object.freeze({
        bytes: archive,
        base64: encodeCanonicalYamlZipBase64(archive),
      }),
    };
  } catch {
    return failure('INVALID_INPUT');
  }
}
