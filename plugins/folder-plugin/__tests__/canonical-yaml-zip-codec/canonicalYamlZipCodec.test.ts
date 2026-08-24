import { YAML_SUBTYPE_REGISTRY, type YamlSubtype } from '@hierarchidb/yaml-api';
import fc from 'fast-check';
import JSZip from 'jszip';
import { describe, expect, it } from 'vitest';
import { calculateCanonicalYamlZipCrc32 } from '../../src/canonical-yaml-zip-codec/calculateCanonicalYamlZipCrc32.internalUtils.js';
import { CANONICAL_YAML_ZIP_LIMITS } from '../../src/canonical-yaml-zip-codec/constants.js';
import { CanonicalYamlZipCodecErrorCode, CanonicalYamlZipInputEntry, EncodedCanonicalYamlZip } from '../../src/canonical-yaml-zip-codec/canonicalYamlZipCodecTypes.js';
import { decodeCanonicalYamlZip } from '../../src/canonical-yaml-zip-codec/decodeCanonicalYamlZip.js';
import { encodeCanonicalYamlZip } from '../../src/canonical-yaml-zip-codec/encodeCanonicalYamlZip.js';

const EOCD_BYTES = 22;
const CENTRAL_HEADER_BYTES = 46;
const LOCAL_HEADER_BYTES = 30;

const VALID_CONTENT: Readonly<Record<YamlSubtype, string>> = {
  sources: 'sources: []\n',
  scenario: 'name: demo\n',
  'scenario-base': 'name: demo\n',
  calib: 'calibrationId: calibration-1\n',
  remote: 'host: remote.example.test\n',
  'remote-base': 'host: remote.example.test\n',
  ssh: 'host: ssh.example.test\nusername: user\n',
  'ssh-base': 'host: ssh.example.test\nusername: user\n',
  ec2: 'instanceId: i-123\nregion: ap-northeast-1\n',
  'ec2-base': 'instanceId: i-123\nregion: ap-northeast-1\n',
  rsync: 'include: []\nexclude: []\n',
  git: 'url: https://example.test/repository.git\n',
};

interface CentralRecordLocation {
  readonly centralOffset: number;
  readonly localOffset: number;
  readonly filenameLength: number;
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

function canonicalEntries(): readonly CanonicalYamlZipInputEntry[] {
  return Object.values(YAML_SUBTYPE_REGISTRY).map((entry) => ({
    filename: entry.fileName,
    payload: {
      subtype: entry.subtype,
      schemaId: entry.schemaId,
      content: VALID_CONTENT[entry.subtype],
    },
  }));
}

function expectEncoded(entries: readonly CanonicalYamlZipInputEntry[]): EncodedCanonicalYamlZip {
  const result = encodeCanonicalYamlZip(entries);
  expect(result.ok).toBe(true);
  if (!result.ok) throw new Error(`Expected encode success, got ${result.error.code}`);
  return result.value;
}

function expectDecodeError(bytes: Uint8Array | string, code: CanonicalYamlZipCodecErrorCode): void {
  const result = decodeCanonicalYamlZip(bytes);
  expect(result.ok).toBe(false);
  if (result.ok) throw new Error('Expected decode failure');
  expect(result.error.code).toBe(code);
  expect(Object.keys(result.error).sort()).toEqual(
    result.error.entryIndex === undefined ? ['code'] : ['code', 'entryIndex']
  );
}

function centralRecords(bytes: Uint8Array): readonly CentralRecordLocation[] {
  const eocdOffset = bytes.length - EOCD_BYTES;
  const count = readUint16(bytes, eocdOffset + 10);
  let cursor = readUint32(bytes, eocdOffset + 16);
  const records: CentralRecordLocation[] = [];
  for (let index = 0; index < count; index += 1) {
    const filenameLength = readUint16(bytes, cursor + 28);
    const extraLength = readUint16(bytes, cursor + 30);
    const commentLength = readUint16(bytes, cursor + 32);
    records.push({
      centralOffset: cursor,
      localOffset: readUint32(bytes, cursor + 42),
      filenameLength,
    });
    cursor += CENTRAL_HEADER_BYTES + filenameLength + extraLength + commentLength;
  }
  return records;
}

function requireRecord(
  records: readonly CentralRecordLocation[],
  index: number
): CentralRecordLocation {
  const record = records[index];
  if (record === undefined) throw new Error(`Missing central record ${index}`);
  return record;
}

function insertByte(bytes: Uint8Array, offset: number): Uint8Array {
  const result = new Uint8Array(bytes.length + 1);
  result.set(bytes.subarray(0, offset), 0);
  result[offset] = 0x7f;
  result.set(bytes.subarray(offset), offset + 1);
  return result;
}

function archiveWithLeadingJunk(bytes: Uint8Array): Uint8Array {
  const records = centralRecords(bytes);
  const centralOffset = readUint32(bytes, bytes.length - EOCD_BYTES + 16);
  const result = insertByte(bytes, 0);
  for (const record of records) {
    writeUint32(result, record.centralOffset + 1 + 42, record.localOffset + 1);
  }
  writeUint32(result, result.length - EOCD_BYTES + 16, centralOffset + 1);
  return result;
}

function archiveWithInterEntryJunk(bytes: Uint8Array): Uint8Array {
  const records = centralRecords(bytes);
  const secondRecord = requireRecord(records, 1);
  const centralOffset = readUint32(bytes, bytes.length - EOCD_BYTES + 16);
  const result = insertByte(bytes, secondRecord.localOffset);
  for (const record of records) {
    const adjustedLocalOffset =
      record.localOffset >= secondRecord.localOffset ? record.localOffset + 1 : record.localOffset;
    writeUint32(result, record.centralOffset + 1 + 42, adjustedLocalOffset);
  }
  writeUint32(result, result.length - EOCD_BYTES + 16, centralOffset + 1);
  return result;
}

function archiveWithLocalTailJunk(bytes: Uint8Array): Uint8Array {
  const centralOffset = readUint32(bytes, bytes.length - EOCD_BYTES + 16);
  const result = insertByte(bytes, centralOffset);
  writeUint32(result, result.length - EOCD_BYTES + 16, centralOffset + 1);
  return result;
}

function replaceStoredContent(
  bytes: Uint8Array,
  record: CentralRecordLocation,
  contentBytes: Uint8Array
): void {
  const localFilenameLength = readUint16(bytes, record.localOffset + 26);
  const originalContentLength = readUint32(bytes, record.localOffset + 22);
  if (contentBytes.length !== originalContentLength) {
    throw new Error('Replacement content must have the same byte length');
  }
  const contentOffset = record.localOffset + LOCAL_HEADER_BYTES + localFilenameLength;
  bytes.set(contentBytes, contentOffset);
  const crc32 = calculateCanonicalYamlZipCrc32(contentBytes);
  writeUint32(bytes, record.localOffset + 14, crc32);
  writeUint32(bytes, record.centralOffset + 16, crc32);
}

function replaceFilenameInBothHeaders(
  bytes: Uint8Array,
  record: CentralRecordLocation,
  filenameBytes: Uint8Array
): void {
  if (filenameBytes.length !== record.filenameLength) {
    throw new Error('Replacement filename must have the same byte length');
  }
  bytes.set(filenameBytes, record.centralOffset + CENTRAL_HEADER_BYTES);
  bytes.set(filenameBytes, record.localOffset + LOCAL_HEADER_BYTES);
}

describe('canonical YAML ZIP deterministic round trip', () => {
  it('round-trips all 12 canonical entries in deterministic UTF-8 filename order', () => {
    const input = canonicalEntries();
    const encoded = expectEncoded(input);
    const reversed = expectEncoded([...input].reverse());

    expect(encoded.bytes).toEqual(reversed.bytes);
    expect(encoded.base64).toBe(reversed.base64);

    const fromBytes = decodeCanonicalYamlZip(encoded.bytes);
    const fromBase64 = decodeCanonicalYamlZip(encoded.base64);
    expect(fromBytes).toEqual(fromBase64);
    expect(fromBytes.ok).toBe(true);
    if (!fromBytes.ok) throw new Error('Expected decode success');

    const expected = [...input].sort((left, right) =>
      left.filename.localeCompare(right.filename, 'en')
    );
    expect(fromBytes.value.entries.map((entry) => entry.filename)).toEqual(
      expected.map((entry) => entry.filename)
    );
    expect(fromBytes.value.entries.map((entry) => entry.payload)).toEqual(
      expected.map((entry) => entry.payload)
    );
    expect(Object.isFrozen(fromBytes.value.entries)).toBe(true);
    expect(Object.isFrozen(fromBytes.value.entries[0])).toBe(true);
  });

  it('is deterministic for arbitrary input permutations', () => {
    const input = canonicalEntries();
    const canonical = expectEncoded(input).bytes;
    fc.assert(
      fc.property(
        fc.shuffledSubarray(input, { minLength: input.length, maxLength: input.length }),
        (permutation) => {
          expect(expectEncoded(permutation).bytes).toEqual(canonical);
        }
      ),
      { numRuns: 50 }
    );
  });

  it('preserves Unicode YAML content byte-for-byte', () => {
    const entry = YAML_SUBTYPE_REGISTRY.scenario;
    const content = 'name: 日本語🙂\n';
    const encoded = expectEncoded([
      {
        filename: entry.fileName,
        payload: { subtype: entry.subtype, schemaId: entry.schemaId, content },
      },
    ]);
    const decoded = decodeCanonicalYamlZip(encoded.bytes);
    expect(decoded).toEqual({
      ok: true,
      value: {
        entries: [
          {
            occurrenceIndex: 0,
            filename: entry.fileName,
            payload: { subtype: entry.subtype, schemaId: entry.schemaId, content },
          },
        ],
      },
    });
  });

  it('preserves a UTF-8 BOM as U+FEFF byte-for-byte', () => {
    const entry = YAML_SUBTYPE_REGISTRY.scenario;
    const content = '\uFEFFname: demo\n';
    const encoded = expectEncoded([
      {
        filename: entry.fileName,
        payload: { subtype: entry.subtype, schemaId: entry.schemaId, content },
      },
    ]);
    const record = requireRecord(centralRecords(encoded.bytes), 0);
    const contentOffset =
      record.localOffset + LOCAL_HEADER_BYTES + readUint16(encoded.bytes, record.localOffset + 26);
    expect(encoded.bytes.slice(contentOffset, contentOffset + 3)).toEqual(
      new Uint8Array([0xef, 0xbb, 0xbf])
    );

    const decoded = decodeCanonicalYamlZip(encoded.bytes);
    expect(decoded.ok).toBe(true);
    if (!decoded.ok) throw new Error('Expected decode success');
    expect(decoded.value.entries[0]?.payload.content).toBe(content);
    expect(new TextEncoder().encode(decoded.value.entries[0]?.payload.content)).toEqual(
      new TextEncoder().encode(content)
    );
  });

  it('does not mutate archive bytes or input payloads', () => {
    const input = canonicalEntries().slice(0, 2);
    const inputSnapshot = structuredClone(input);
    const encoded = expectEncoded(input);
    const archiveSnapshot = new Uint8Array(encoded.bytes);

    expect(decodeCanonicalYamlZip(encoded.bytes).ok).toBe(true);
    expect(encoded.bytes).toEqual(archiveSnapshot);
    expect(input).toEqual(inputSnapshot);
  });

  it('emits STORE entries with fixed DOS metadata', () => {
    const encoded = expectEncoded(canonicalEntries().slice(0, 2));
    for (const record of centralRecords(encoded.bytes)) {
      expect(readUint16(encoded.bytes, record.localOffset + 8)).toBe(0);
      expect(readUint16(encoded.bytes, record.localOffset + 10)).toBe(0);
      expect(readUint16(encoded.bytes, record.localOffset + 12)).toBe(0x21);
      expect(readUint16(encoded.bytes, record.centralOffset + 10)).toBe(0);
      expect(readUint16(encoded.bytes, record.centralOffset + 12)).toBe(0);
      expect(readUint16(encoded.bytes, record.centralOffset + 14)).toBe(0x21);
      expect(readUint16(encoded.bytes, record.centralOffset + 30)).toBe(0);
      expect(readUint16(encoded.bytes, record.centralOffset + 32)).toBe(0);
    }
  });

  it('emits a standards-compatible archive with valid CRC values', async () => {
    const input = canonicalEntries().slice(0, 3);
    const encoded = expectEncoded(input);
    const archive = await JSZip.loadAsync(encoded.bytes, { checkCRC32: true });

    expect(Object.keys(archive.files).sort()).toEqual(input.map((entry) => entry.filename).sort());
    for (const entry of input) {
      expect(await archive.file(entry.filename)?.async('string')).toBe(entry.payload.content);
    }
  });
});

describe('canonical YAML ZIP raw archive rejection', () => {
  it('rejects duplicate raw central filenames before keyed-object conversion', async () => {
    const encoded = expectEncoded(
      canonicalEntries().filter(
        (entry) => entry.filename === 'scenario.yml' || entry.filename === 'ssh-base.yml'
      )
    );
    const bytes = new Uint8Array(encoded.bytes);
    const records = centralRecords(bytes);
    const first = requireRecord(records, 0);
    const second = requireRecord(records, 1);
    expect(first.filenameLength).toBe(second.filenameLength);
    bytes.copyWithin(
      second.centralOffset + CENTRAL_HEADER_BYTES,
      first.centralOffset + CENTRAL_HEADER_BYTES,
      first.centralOffset + CENTRAL_HEADER_BYTES + first.filenameLength
    );
    bytes.set(
      bytes.slice(
        first.centralOffset + CENTRAL_HEADER_BYTES,
        first.centralOffset + CENTRAL_HEADER_BYTES + first.filenameLength
      ),
      second.localOffset + LOCAL_HEADER_BYTES
    );
    const jsZipView = await JSZip.loadAsync(bytes);
    expect(Object.keys(jsZipView.files)).toEqual(['scenario.yml']);
    expectDecodeError(bytes, 'DUPLICATE_FILENAME');
  });

  it('rejects two central records that reuse one local header', () => {
    const bytes = new Uint8Array(expectEncoded(canonicalEntries().slice(0, 2)).bytes);
    const records = centralRecords(bytes);
    const first = requireRecord(records, 0);
    const second = requireRecord(records, 1);
    writeUint32(bytes, second.centralOffset + 42, first.localOffset);
    expectDecodeError(bytes, 'DUPLICATE_LOCAL_HEADER_REFERENCE');
  });

  it('rejects invalid UTF-8 filename bytes', () => {
    const bytes = new Uint8Array(expectEncoded(canonicalEntries().slice(0, 1)).bytes);
    const record = requireRecord(centralRecords(bytes), 0);
    const invalidFilename = bytes.slice(
      record.centralOffset + CENTRAL_HEADER_BYTES,
      record.centralOffset + CENTRAL_HEADER_BYTES + record.filenameLength
    );
    invalidFilename[0] = 0xff;
    replaceFilenameInBothHeaders(bytes, record, invalidFilename);
    expectDecodeError(bytes, 'INVALID_UTF8_FILENAME');
  });

  it('rejects invalid UTF-8 content after CRC validation', () => {
    const bytes = new Uint8Array(expectEncoded(canonicalEntries().slice(1, 2)).bytes);
    const record = requireRecord(centralRecords(bytes), 0);
    const contentLength = readUint32(bytes, record.localOffset + 22);
    const replacement = new Uint8Array(contentLength).fill(0xff);
    replaceStoredContent(bytes, record, replacement);
    expectDecodeError(bytes, 'INVALID_UTF8_CONTENT');
  });

  it('completes fatal content UTF-8 decoding archive-wide before schema validation', () => {
    const encoded = expectEncoded(
      canonicalEntries().filter(
        (entry) => entry.filename === 'scenario-base.yml' || entry.filename === 'scenario.yml'
      )
    );
    const bytes = new Uint8Array(encoded.bytes);
    const records = centralRecords(bytes);
    const schemaInvalidFirst = requireRecord(records, 0);
    const invalidUtf8Later = requireRecord(records, 1);
    replaceStoredContent(bytes, schemaInvalidFirst, new TextEncoder().encode('aaaaaaaaaaa'));
    replaceStoredContent(bytes, invalidUtf8Later, new Uint8Array(11).fill(0xff));

    expect(decodeCanonicalYamlZip(bytes)).toEqual({
      ok: false,
      error: { code: 'INVALID_UTF8_CONTENT', entryIndex: 1 },
    });
  });

  it.each(['unknown-entry.yml', 'unsafe/path-x.yml'])(
    'reports later invalid content UTF-8 before earlier filename semantics for %s',
    (replacementFilename) => {
      const encoded = expectEncoded(
        canonicalEntries().filter(
          (entry) => entry.filename === 'scenario-base.yml' || entry.filename === 'scenario.yml'
        )
      );
      const bytes = new Uint8Array(encoded.bytes);
      const records = centralRecords(bytes);
      const semanticInvalidFirst = requireRecord(records, 0);
      const invalidUtf8Later = requireRecord(records, 1);
      const replacementFilenameBytes = new TextEncoder().encode(replacementFilename);
      expect(replacementFilenameBytes.length).toBe(semanticInvalidFirst.filenameLength);
      replaceFilenameInBothHeaders(bytes, semanticInvalidFirst, replacementFilenameBytes);
      replaceStoredContent(bytes, invalidUtf8Later, new Uint8Array(11).fill(0xff));

      expect(decodeCanonicalYamlZip(bytes)).toEqual({
        ok: false,
        error: { code: 'INVALID_UTF8_CONTENT', entryIndex: 1 },
      });
    }
  );

  it('rejects nested, unknown, and directory entries without skipping them', () => {
    const encoded = expectEncoded(canonicalEntries().slice(0, 1));
    const nested = new Uint8Array(encoded.bytes);
    const nestedRecord = requireRecord(centralRecords(nested), 0);
    const nestedName = new TextEncoder().encode('../evil.yml');
    expect(nestedName.length).toBe(nestedRecord.filenameLength);
    replaceFilenameInBothHeaders(nested, nestedRecord, nestedName);
    expectDecodeError(nested, 'UNSAFE_FILENAME');

    const unknown = new Uint8Array(encoded.bytes);
    const unknownRecord = requireRecord(centralRecords(unknown), 0);
    const unknownName = new TextEncoder().encode('unknown.yml');
    expect(unknownName.length).toBe(unknownRecord.filenameLength);
    replaceFilenameInBothHeaders(unknown, unknownRecord, unknownName);
    expectDecodeError(unknown, 'UNKNOWN_FILENAME');

    const directory = new Uint8Array(encoded.bytes);
    const directoryRecord = requireRecord(centralRecords(directory), 0);
    writeUint32(directory, directoryRecord.centralOffset + 38, 0x10);
    expectDecodeError(directory, 'DIRECTORY_ENTRY_UNSUPPORTED');
  });

  it('enforces duplicate, local-header, range, and CRC precedence before filename semantics', () => {
    const duplicate = new Uint8Array(
      expectEncoded(
        canonicalEntries().filter(
          (entry) => entry.filename === 'scenario.yml' || entry.filename === 'ssh-base.yml'
        )
      ).bytes
    );
    const duplicateRecords = centralRecords(duplicate);
    const duplicateFirst = requireRecord(duplicateRecords, 0);
    const duplicateSecond = requireRecord(duplicateRecords, 1);
    duplicate.copyWithin(
      duplicateSecond.centralOffset + CENTRAL_HEADER_BYTES,
      duplicateFirst.centralOffset + CENTRAL_HEADER_BYTES,
      duplicateFirst.centralOffset + CENTRAL_HEADER_BYTES + duplicateFirst.filenameLength
    );
    expectDecodeError(duplicate, 'DUPLICATE_FILENAME');

    const encoded = expectEncoded(canonicalEntries().slice(0, 1));
    const centralOnly = new Uint8Array(encoded.bytes);
    const centralOnlyRecord = requireRecord(centralRecords(centralOnly), 0);
    centralOnly[centralOnlyRecord.centralOffset + CENTRAL_HEADER_BYTES] = 0xff;
    expectDecodeError(centralOnly, 'HEADER_MISMATCH');

    const rangeBeforeFilename = archiveWithLeadingJunk(encoded.bytes);
    const rangeRecord = requireRecord(centralRecords(rangeBeforeFilename), 0);
    const rangeInvalidFilename = rangeBeforeFilename.slice(
      rangeRecord.centralOffset + CENTRAL_HEADER_BYTES,
      rangeRecord.centralOffset + CENTRAL_HEADER_BYTES + rangeRecord.filenameLength
    );
    rangeInvalidFilename[0] = 0xff;
    replaceFilenameInBothHeaders(rangeBeforeFilename, rangeRecord, rangeInvalidFilename);
    expectDecodeError(rangeBeforeFilename, 'ENTRY_RANGE_INVALID');

    const crcBeforeFilename = new Uint8Array(encoded.bytes);
    const crcRecord = requireRecord(centralRecords(crcBeforeFilename), 0);
    const crcInvalidFilename = crcBeforeFilename.slice(
      crcRecord.centralOffset + CENTRAL_HEADER_BYTES,
      crcRecord.centralOffset + CENTRAL_HEADER_BYTES + crcRecord.filenameLength
    );
    crcInvalidFilename[0] = 0xff;
    replaceFilenameInBothHeaders(crcBeforeFilename, crcRecord, crcInvalidFilename);
    const contentOffset =
      crcRecord.localOffset +
      LOCAL_HEADER_BYTES +
      readUint16(crcBeforeFilename, crcRecord.localOffset + 26);
    crcBeforeFilename[contentOffset] = (crcBeforeFilename[contentOffset] ?? 0) ^ 0xff;
    expectDecodeError(crcBeforeFilename, 'CRC_MISMATCH');
  });

  it('rejects CRC and central/local header mismatches', () => {
    const encoded = expectEncoded(canonicalEntries().slice(0, 1));
    const crcMismatch = new Uint8Array(encoded.bytes);
    const crcRecord = requireRecord(centralRecords(crcMismatch), 0);
    const contentOffset =
      crcRecord.localOffset +
      LOCAL_HEADER_BYTES +
      readUint16(crcMismatch, crcRecord.localOffset + 26);
    crcMismatch[contentOffset] = (crcMismatch[contentOffset] ?? 0) ^ 0xff;
    expectDecodeError(crcMismatch, 'CRC_MISMATCH');

    const headerMismatch = new Uint8Array(encoded.bytes);
    const headerRecord = requireRecord(centralRecords(headerMismatch), 0);
    writeUint16(headerMismatch, headerRecord.localOffset + 6, 0);
    expectDecodeError(headerMismatch, 'HEADER_MISMATCH');
  });

  it('rejects local range overlap', () => {
    const bytes = new Uint8Array(expectEncoded(canonicalEntries().slice(0, 2)).bytes);
    const records = centralRecords(bytes);
    const first = requireRecord(records, 0);
    const originalSize = readUint32(bytes, first.localOffset + 22);
    const filenameLength = readUint16(bytes, first.localOffset + 26);
    const contentOffset = first.localOffset + LOCAL_HEADER_BYTES + filenameLength;
    const overlappingSize = originalSize + 1;
    const overlappingContent = bytes.slice(contentOffset, contentOffset + overlappingSize);
    const crc32 = calculateCanonicalYamlZipCrc32(overlappingContent);
    writeUint32(bytes, first.localOffset + 14, crc32);
    writeUint32(bytes, first.localOffset + 18, overlappingSize);
    writeUint32(bytes, first.localOffset + 22, overlappingSize);
    writeUint32(bytes, first.centralOffset + 16, crc32);
    writeUint32(bytes, first.centralOffset + 20, overlappingSize);
    writeUint32(bytes, first.centralOffset + 24, overlappingSize);
    expectDecodeError(bytes, 'ENTRY_RANGE_OVERLAP');
  });

  it.each([
    ['leading bytes', archiveWithLeadingJunk],
    ['inter-entry bytes', archiveWithInterEntryJunk],
    ['local-tail bytes', archiveWithLocalTailJunk],
  ] as const)('rejects unreferenced %s', (_label, mutate) => {
    const encoded = expectEncoded(canonicalEntries().slice(0, 2));
    expectDecodeError(mutate(encoded.bytes), 'ENTRY_RANGE_INVALID');
  });

  it('rejects extra fields, encryption, non-STORE, ZIP64, multi-disk, and trailing data', () => {
    const encoded = expectEncoded(canonicalEntries().slice(0, 1));
    const record = requireRecord(centralRecords(encoded.bytes), 0);

    const extra = new Uint8Array(encoded.bytes);
    writeUint16(extra, record.localOffset + 28, 1);
    expectDecodeError(extra, 'EXTRA_FIELD_UNSUPPORTED');

    const encrypted = new Uint8Array(encoded.bytes);
    writeUint16(encrypted, record.centralOffset + 8, 0x0801);
    expectDecodeError(encrypted, 'ENCRYPTION_UNSUPPORTED');

    const compressed = new Uint8Array(encoded.bytes);
    writeUint16(compressed, record.centralOffset + 10, 8);
    expectDecodeError(compressed, 'UNSUPPORTED_COMPRESSION');

    const zip64 = new Uint8Array(encoded.bytes);
    writeUint32(zip64, record.centralOffset + 24, 0xffffffff);
    expectDecodeError(zip64, 'ZIP64_UNSUPPORTED');

    const multiDisk = new Uint8Array(encoded.bytes);
    writeUint16(multiDisk, multiDisk.length - EOCD_BYTES + 4, 1);
    expectDecodeError(multiDisk, 'MULTI_DISK_UNSUPPORTED');

    const trailing = new Uint8Array(encoded.bytes.length + 1);
    trailing.set(encoded.bytes);
    expectDecodeError(trailing, 'INVALID_EOCD');
  });

  it('enforces entry and content size limits before content decode', () => {
    const tooMany = Array.from(
      { length: CANONICAL_YAML_ZIP_LIMITS.entryCount + 1 },
      () => canonicalEntries()[0]
    ) as readonly CanonicalYamlZipInputEntry[];
    const encodeResult = encodeCanonicalYamlZip(tooMany);
    expect(encodeResult).toEqual({ ok: false, error: { code: 'ENTRY_LIMIT_EXCEEDED' } });

    const bytes = new Uint8Array(expectEncoded(canonicalEntries().slice(0, 1)).bytes);
    const record = requireRecord(centralRecords(bytes), 0);
    writeUint32(bytes, record.centralOffset + 20, CANONICAL_YAML_ZIP_LIMITS.entryBytes + 1);
    writeUint32(bytes, record.centralOffset + 24, CANONICAL_YAML_ZIP_LIMITS.entryBytes + 1);
    expectDecodeError(bytes, 'ENTRY_TOO_LARGE');

    const aggregate = new Uint8Array(expectEncoded(canonicalEntries().slice(0, 5)).bytes);
    for (const aggregateRecord of centralRecords(aggregate)) {
      writeUint32(
        aggregate,
        aggregateRecord.centralOffset + 20,
        CANONICAL_YAML_ZIP_LIMITS.entryBytes
      );
      writeUint32(
        aggregate,
        aggregateRecord.centralOffset + 24,
        CANONICAL_YAML_ZIP_LIMITS.entryBytes
      );
    }
    expectDecodeError(aggregate, 'TOTAL_CONTENT_TOO_LARGE');

    expectDecodeError(
      new Uint8Array(CANONICAL_YAML_ZIP_LIMITS.archiveBytes + 1),
      'ARCHIVE_TOO_LARGE'
    );
  });

  it('delegates YAML/schema validation and returns only redacted stable error metadata', () => {
    const bytes = new Uint8Array(expectEncoded(canonicalEntries().slice(1, 2)).bytes);
    const record = requireRecord(centralRecords(bytes), 0);
    replaceStoredContent(bytes, record, new TextEncoder().encode('aaaaaaaaaaa'));
    const result = decodeCanonicalYamlZip(bytes);
    expect(result).toEqual({
      ok: false,
      error: {
        code: 'CANONICAL_VALIDATION_FAILED',
        entryIndex: 0,
        validationCode: 'YAML_ROOT_NOT_MAPPING',
      },
    });
    expect(JSON.stringify(result)).not.toContain('aaaaaaaaaaa');
  });
});

describe('canonical YAML ZIP strict public inputs', () => {
  it.each(['AA', 'AAAA\n', 'data:application/zip;base64,AAAA', '____', 'A==='])(
    'rejects non-canonical Base64 %s',
    (input) => expectDecodeError(input, 'INVALID_BASE64')
  );

  it('rejects unknown filenames and invalid payloads without fallback', () => {
    const unknown = encodeCanonicalYamlZip([
      {
        filename: 'unknown.yml',
        payload: { subtype: 'scenario', schemaId: 'ide-gsm/scenario', content: 'name: demo\n' },
      },
    ] as unknown as readonly CanonicalYamlZipInputEntry[]);
    expect(unknown).toEqual({ ok: false, error: { code: 'UNKNOWN_FILENAME', entryIndex: 0 } });

    const invalid = encodeCanonicalYamlZip([
      {
        filename: 'scenario.yml',
        payload: {
          subtype: 'scenario',
          schemaId: 'ide-gsm/scenario',
          content: 'name: [credential-must-not-leak\n',
        },
      },
    ]);
    expect(invalid.ok).toBe(false);
    expect(JSON.stringify(invalid)).not.toContain('credential-must-not-leak');
  });

  it.each([
    ['lone high surrogate', 'name: \ud800\n'],
    ['lone low surrogate', 'name: \udc00\n'],
  ])('rejects %s instead of replacing it during UTF-8 encoding', (_label, content) => {
    const result = encodeCanonicalYamlZip([
      {
        filename: 'scenario.yml',
        payload: { subtype: 'scenario', schemaId: 'ide-gsm/scenario', content },
      },
    ]);
    expect(result).toEqual({
      ok: false,
      error: { code: 'INVALID_UTF8_CONTENT', entryIndex: 0 },
    });
  });
});
