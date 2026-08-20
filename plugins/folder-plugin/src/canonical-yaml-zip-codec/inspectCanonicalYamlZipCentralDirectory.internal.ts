import { calculateCanonicalYamlZipCrc32 } from './calculateCanonicalYamlZipCrc32.internalUtils.js';
import type { CanonicalYamlZipCodecError } from './canonicalYamlZipCodecTypes.js';
import { decodeCanonicalYamlZipUtf8 } from './canonicalYamlZipUtf8.internalUtils.js';
import {
  CANONICAL_YAML_ZIP_LIMITS,
  CANONICAL_YAML_ZIP_STORE_METHOD,
  CANONICAL_YAML_ZIP_UTF8_FLAG,
} from './constants.js';

const LOCAL_FILE_HEADER_SIGNATURE = 0x04034b50;
const CENTRAL_DIRECTORY_HEADER_SIGNATURE = 0x02014b50;
const END_OF_CENTRAL_DIRECTORY_SIGNATURE = 0x06054b50;
const END_OF_CENTRAL_DIRECTORY_BYTES = 22;
const CENTRAL_DIRECTORY_HEADER_BYTES = 46;
const LOCAL_FILE_HEADER_BYTES = 30;
const ZIP64_UINT16_SENTINEL = 0xffff;
const ZIP64_UINT32_SENTINEL = 0xffffffff;

interface RawCentralDirectoryRecord {
  readonly occurrenceIndex: number;
  readonly filenameBytes: Uint8Array;
  readonly flags: number;
  readonly method: number;
  readonly crc32: number;
  readonly compressedSize: number;
  readonly uncompressedSize: number;
  readonly localHeaderOffset: number;
  readonly externalAttributes: number;
}

interface RawInspectedCanonicalYamlZipEntry {
  readonly occurrenceIndex: number;
  readonly filenameBytes: Uint8Array;
  readonly contentBytes: Uint8Array;
  readonly crc32: number;
  readonly externalAttributes: number;
}

export interface InspectedCanonicalYamlZipEntry {
  readonly occurrenceIndex: number;
  readonly decodedFilename: string;
  readonly contentBytes: Uint8Array;
}

interface FilenameDecodedCanonicalYamlZipEntry extends InspectedCanonicalYamlZipEntry {
  readonly externalAttributes: number;
}

type InspectCanonicalYamlZipCentralDirectoryResult =
  | Readonly<{
      readonly ok: true;
      readonly entries: readonly InspectedCanonicalYamlZipEntry[];
    }>
  | Readonly<{ readonly ok: false; readonly error: CanonicalYamlZipCodecError }>;

type ParseCentralDirectoryRecordsResult =
  | Readonly<{ readonly ok: true; readonly records: readonly RawCentralDirectoryRecord[] }>
  | Readonly<{ readonly ok: false; readonly error: CanonicalYamlZipCodecError }>;

function failure(
  code: CanonicalYamlZipCodecError['code'],
  entryIndex?: number
): Readonly<{ readonly ok: false; readonly error: CanonicalYamlZipCodecError }> {
  return {
    ok: false,
    error: entryIndex === undefined ? { code } : { code, entryIndex },
  };
}

function readUint16(bytes: Uint8Array, offset: number): number {
  return (bytes[offset] ?? 0) | ((bytes[offset + 1] ?? 0) << 8);
}

function readUint32(bytes: Uint8Array, offset: number): number {
  return (
    ((bytes[offset] ?? 0) |
      ((bytes[offset + 1] ?? 0) << 8) |
      ((bytes[offset + 2] ?? 0) << 16) |
      ((bytes[offset + 3] ?? 0) << 24)) >>>
    0
  );
}

function bytesEqual(left: Uint8Array, right: Uint8Array): boolean {
  if (left.length !== right.length) return false;
  for (let index = 0; index < left.length; index += 1) {
    if (left[index] !== right[index]) return false;
  }
  return true;
}

function isDirectoryExternalAttribute(externalAttributes: number): boolean {
  const dosDirectoryBit = (externalAttributes & 0x10) !== 0;
  const unixFileType = (externalAttributes >>> 16) & 0xf000;
  return dosDirectoryBit || unixFileType === 0x4000;
}

function parseCentralDirectoryRecords(
  bytes: Uint8Array,
  centralDirectoryOffset: number,
  centralDirectoryEnd: number,
  entryCount: number
): ParseCentralDirectoryRecordsResult {
  const records: RawCentralDirectoryRecord[] = [];
  let cursor = centralDirectoryOffset;
  let totalContentBytes = 0;

  for (let occurrenceIndex = 0; occurrenceIndex < entryCount; occurrenceIndex += 1) {
    if (
      cursor + CENTRAL_DIRECTORY_HEADER_BYTES > centralDirectoryEnd ||
      readUint32(bytes, cursor) !== CENTRAL_DIRECTORY_HEADER_SIGNATURE
    ) {
      return failure('INVALID_CENTRAL_HEADER', occurrenceIndex);
    }

    const flags = readUint16(bytes, cursor + 8);
    const method = readUint16(bytes, cursor + 10);
    const crc32 = readUint32(bytes, cursor + 16);
    const compressedSize = readUint32(bytes, cursor + 20);
    const uncompressedSize = readUint32(bytes, cursor + 24);
    const filenameLength = readUint16(bytes, cursor + 28);
    const extraFieldLength = readUint16(bytes, cursor + 30);
    const commentLength = readUint16(bytes, cursor + 32);
    const diskNumberStart = readUint16(bytes, cursor + 34);
    const externalAttributes = readUint32(bytes, cursor + 38);
    const localHeaderOffset = readUint32(bytes, cursor + 42);
    const recordEnd =
      cursor + CENTRAL_DIRECTORY_HEADER_BYTES + filenameLength + extraFieldLength + commentLength;

    if (recordEnd > centralDirectoryEnd || filenameLength === 0) {
      return failure('INVALID_CENTRAL_HEADER', occurrenceIndex);
    }
    if (
      compressedSize === ZIP64_UINT32_SENTINEL ||
      uncompressedSize === ZIP64_UINT32_SENTINEL ||
      localHeaderOffset === ZIP64_UINT32_SENTINEL
    ) {
      return failure('ZIP64_UNSUPPORTED', occurrenceIndex);
    }
    if (diskNumberStart !== 0) {
      return failure('MULTI_DISK_UNSUPPORTED', occurrenceIndex);
    }
    if ((flags & 0x0001) !== 0) {
      return failure('ENCRYPTION_UNSUPPORTED', occurrenceIndex);
    }
    if (flags !== CANONICAL_YAML_ZIP_UTF8_FLAG) {
      return failure('UNSUPPORTED_FLAGS', occurrenceIndex);
    }
    if (method !== CANONICAL_YAML_ZIP_STORE_METHOD) {
      return failure('UNSUPPORTED_COMPRESSION', occurrenceIndex);
    }
    if (extraFieldLength !== 0) {
      return failure('EXTRA_FIELD_UNSUPPORTED', occurrenceIndex);
    }
    if (commentLength !== 0) {
      return failure('COMMENT_UNSUPPORTED', occurrenceIndex);
    }
    if (compressedSize !== uncompressedSize) {
      return failure('HEADER_MISMATCH', occurrenceIndex);
    }
    if (uncompressedSize > CANONICAL_YAML_ZIP_LIMITS.entryBytes) {
      return failure('ENTRY_TOO_LARGE', occurrenceIndex);
    }
    totalContentBytes += uncompressedSize;
    if (totalContentBytes > CANONICAL_YAML_ZIP_LIMITS.totalContentBytes) {
      return failure('TOTAL_CONTENT_TOO_LARGE', occurrenceIndex);
    }

    const filenameBytes = bytes.slice(
      cursor + CENTRAL_DIRECTORY_HEADER_BYTES,
      cursor + CENTRAL_DIRECTORY_HEADER_BYTES + filenameLength
    );
    records.push({
      occurrenceIndex,
      filenameBytes,
      flags,
      method,
      crc32,
      compressedSize,
      uncompressedSize,
      localHeaderOffset,
      externalAttributes,
    });
    cursor = recordEnd;
  }

  if (cursor !== centralDirectoryEnd) {
    return failure('INVALID_CENTRAL_DIRECTORY');
  }
  return { ok: true, records };
}

function validateRawRecordIdentities(
  records: readonly RawCentralDirectoryRecord[]
): InspectCanonicalYamlZipCentralDirectoryResult | undefined {
  for (let leftIndex = 0; leftIndex < records.length; leftIndex += 1) {
    const left = records[leftIndex];
    if (left === undefined) return failure('INVALID_CENTRAL_DIRECTORY');
    for (let rightIndex = leftIndex + 1; rightIndex < records.length; rightIndex += 1) {
      const right = records[rightIndex];
      if (right === undefined) return failure('INVALID_CENTRAL_DIRECTORY');
      if (bytesEqual(left.filenameBytes, right.filenameBytes)) {
        return failure('DUPLICATE_FILENAME', right.occurrenceIndex);
      }
      if (left.localHeaderOffset === right.localHeaderOffset) {
        return failure('DUPLICATE_LOCAL_HEADER_REFERENCE', right.occurrenceIndex);
      }
    }
  }
  return undefined;
}

function inspectLocalRecords(
  bytes: Uint8Array,
  records: readonly RawCentralDirectoryRecord[],
  centralDirectoryOffset: number
): InspectCanonicalYamlZipCentralDirectoryResult {
  const rawInspectedEntries: RawInspectedCanonicalYamlZipEntry[] = [];
  const ranges: Array<Readonly<{ start: number; end: number; entryIndex: number }>> = [];

  for (const record of records) {
    const localOffset = record.localHeaderOffset;
    if (
      localOffset + LOCAL_FILE_HEADER_BYTES > centralDirectoryOffset ||
      readUint32(bytes, localOffset) !== LOCAL_FILE_HEADER_SIGNATURE
    ) {
      return failure('INVALID_LOCAL_HEADER', record.occurrenceIndex);
    }

    const localFlags = readUint16(bytes, localOffset + 6);
    const localMethod = readUint16(bytes, localOffset + 8);
    const localCrc32 = readUint32(bytes, localOffset + 14);
    const localCompressedSize = readUint32(bytes, localOffset + 18);
    const localUncompressedSize = readUint32(bytes, localOffset + 22);
    const localFilenameLength = readUint16(bytes, localOffset + 26);
    const localExtraFieldLength = readUint16(bytes, localOffset + 28);
    const localHeaderEnd =
      localOffset + LOCAL_FILE_HEADER_BYTES + localFilenameLength + localExtraFieldLength;
    const dataEnd = localHeaderEnd + localCompressedSize;

    if (localExtraFieldLength !== 0) {
      return failure('EXTRA_FIELD_UNSUPPORTED', record.occurrenceIndex);
    }
    if (localHeaderEnd > centralDirectoryOffset || dataEnd > centralDirectoryOffset) {
      return failure('ENTRY_RANGE_INVALID', record.occurrenceIndex);
    }
    if (
      localFlags !== record.flags ||
      localMethod !== record.method ||
      localCrc32 !== record.crc32 ||
      localCompressedSize !== record.compressedSize ||
      localUncompressedSize !== record.uncompressedSize ||
      localFilenameLength !== record.filenameBytes.length
    ) {
      return failure('HEADER_MISMATCH', record.occurrenceIndex);
    }

    const localFilenameBytes = bytes.subarray(
      localOffset + LOCAL_FILE_HEADER_BYTES,
      localOffset + LOCAL_FILE_HEADER_BYTES + localFilenameLength
    );
    if (!bytesEqual(localFilenameBytes, record.filenameBytes)) {
      return failure('HEADER_MISMATCH', record.occurrenceIndex);
    }

    const contentBytes = bytes.slice(localHeaderEnd, dataEnd);
    ranges.push({ start: localOffset, end: dataEnd, entryIndex: record.occurrenceIndex });
    rawInspectedEntries.push({
      occurrenceIndex: record.occurrenceIndex,
      filenameBytes: record.filenameBytes,
      contentBytes,
      crc32: record.crc32,
      externalAttributes: record.externalAttributes,
    });
  }

  const orderedRanges = [...ranges].sort((left, right) => left.start - right.start);
  const firstRange = orderedRanges[0];
  if (firstRange === undefined) {
    if (centralDirectoryOffset !== 0) return failure('ENTRY_RANGE_INVALID');
    return { ok: true, entries: Object.freeze([]) };
  }
  if (firstRange.start !== 0) {
    return failure('ENTRY_RANGE_INVALID', firstRange.entryIndex);
  }
  for (let index = 1; index < orderedRanges.length; index += 1) {
    const previous = orderedRanges[index - 1];
    const current = orderedRanges[index];
    if (previous === undefined || current === undefined) {
      return failure('ENTRY_RANGE_INVALID');
    }
    if (current.start < previous.end) {
      return failure('ENTRY_RANGE_OVERLAP', current.entryIndex);
    }
    if (current.start !== previous.end) {
      return failure('ENTRY_RANGE_INVALID', current.entryIndex);
    }
  }

  const lastRange = orderedRanges[orderedRanges.length - 1];
  if (lastRange === undefined || lastRange.end !== centralDirectoryOffset) {
    return failure(
      'ENTRY_RANGE_INVALID',
      lastRange === undefined ? undefined : lastRange.entryIndex
    );
  }

  for (const rawInspectedEntry of rawInspectedEntries) {
    if (
      calculateCanonicalYamlZipCrc32(rawInspectedEntry.contentBytes) !== rawInspectedEntry.crc32
    ) {
      return failure('CRC_MISMATCH', rawInspectedEntry.occurrenceIndex);
    }
  }

  const filenameDecodedEntries: FilenameDecodedCanonicalYamlZipEntry[] = [];
  for (const rawInspectedEntry of rawInspectedEntries) {
    const decodedFilename = decodeCanonicalYamlZipUtf8(rawInspectedEntry.filenameBytes);
    if (decodedFilename === undefined) {
      return failure('INVALID_UTF8_FILENAME', rawInspectedEntry.occurrenceIndex);
    }
    filenameDecodedEntries.push({
      occurrenceIndex: rawInspectedEntry.occurrenceIndex,
      decodedFilename,
      contentBytes: rawInspectedEntry.contentBytes,
      externalAttributes: rawInspectedEntry.externalAttributes,
    });
  }

  const inspectedEntries: InspectedCanonicalYamlZipEntry[] = [];
  for (const filenameDecodedEntry of filenameDecodedEntries) {
    if (isDirectoryExternalAttribute(filenameDecodedEntry.externalAttributes)) {
      return failure('DIRECTORY_ENTRY_UNSUPPORTED', filenameDecodedEntry.occurrenceIndex);
    }
    inspectedEntries.push({
      occurrenceIndex: filenameDecodedEntry.occurrenceIndex,
      decodedFilename: filenameDecodedEntry.decodedFilename,
      contentBytes: filenameDecodedEntry.contentBytes,
    });
  }

  return { ok: true, entries: Object.freeze(inspectedEntries) };
}

export function inspectCanonicalYamlZipCentralDirectory(
  bytes: Uint8Array
): InspectCanonicalYamlZipCentralDirectoryResult {
  if (bytes.length > CANONICAL_YAML_ZIP_LIMITS.archiveBytes) {
    return failure('ARCHIVE_TOO_LARGE');
  }
  if (bytes.length < END_OF_CENTRAL_DIRECTORY_BYTES) {
    return failure('INVALID_EOCD');
  }

  const eocdOffset = bytes.length - END_OF_CENTRAL_DIRECTORY_BYTES;
  if (readUint32(bytes, eocdOffset) !== END_OF_CENTRAL_DIRECTORY_SIGNATURE) {
    return failure('INVALID_EOCD');
  }

  const diskNumber = readUint16(bytes, eocdOffset + 4);
  const centralDirectoryDisk = readUint16(bytes, eocdOffset + 6);
  const entriesOnDisk = readUint16(bytes, eocdOffset + 8);
  const totalEntries = readUint16(bytes, eocdOffset + 10);
  const centralDirectorySize = readUint32(bytes, eocdOffset + 12);
  const centralDirectoryOffset = readUint32(bytes, eocdOffset + 16);
  const archiveCommentLength = readUint16(bytes, eocdOffset + 20);

  if (
    entriesOnDisk === ZIP64_UINT16_SENTINEL ||
    totalEntries === ZIP64_UINT16_SENTINEL ||
    centralDirectorySize === ZIP64_UINT32_SENTINEL ||
    centralDirectoryOffset === ZIP64_UINT32_SENTINEL
  ) {
    return failure('ZIP64_UNSUPPORTED');
  }
  if (diskNumber !== 0 || centralDirectoryDisk !== 0 || entriesOnDisk !== totalEntries) {
    return failure('MULTI_DISK_UNSUPPORTED');
  }
  if (archiveCommentLength !== 0) {
    return failure('COMMENT_UNSUPPORTED');
  }
  if (totalEntries > CANONICAL_YAML_ZIP_LIMITS.entryCount) {
    return failure('ENTRY_LIMIT_EXCEEDED');
  }

  const centralDirectoryEnd = centralDirectoryOffset + centralDirectorySize;
  if (
    !Number.isSafeInteger(centralDirectoryEnd) ||
    centralDirectoryOffset > eocdOffset ||
    centralDirectoryEnd !== eocdOffset
  ) {
    return failure('INVALID_CENTRAL_DIRECTORY');
  }

  const parsed = parseCentralDirectoryRecords(
    bytes,
    centralDirectoryOffset,
    centralDirectoryEnd,
    totalEntries
  );
  if (!parsed.ok) return parsed;

  const identityFailure = validateRawRecordIdentities(parsed.records);
  if (identityFailure !== undefined) return identityFailure;

  return inspectLocalRecords(bytes, parsed.records, centralDirectoryOffset);
}
