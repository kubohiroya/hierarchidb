import type { YamlCanonicalFilename } from '@hierarchidb/yaml-api';
import type {
  ValidatedYamlCanonicalPayload,
  YamlCanonicalValidationErrorCode,
} from '@hierarchidb/yaml-api/validation';

export type CanonicalYamlZipCodecErrorCode =
  | 'INVALID_INPUT'
  | 'INVALID_BASE64'
  | 'ARCHIVE_TOO_LARGE'
  | 'INVALID_EOCD'
  | 'ZIP64_UNSUPPORTED'
  | 'MULTI_DISK_UNSUPPORTED'
  | 'ENTRY_LIMIT_EXCEEDED'
  | 'INVALID_CENTRAL_DIRECTORY'
  | 'INVALID_CENTRAL_HEADER'
  | 'INVALID_LOCAL_HEADER'
  | 'ENCRYPTION_UNSUPPORTED'
  | 'UNSUPPORTED_FLAGS'
  | 'UNSUPPORTED_COMPRESSION'
  | 'EXTRA_FIELD_UNSUPPORTED'
  | 'COMMENT_UNSUPPORTED'
  | 'DIRECTORY_ENTRY_UNSUPPORTED'
  | 'INVALID_UTF8_FILENAME'
  | 'UNSAFE_FILENAME'
  | 'UNKNOWN_FILENAME'
  | 'DUPLICATE_FILENAME'
  | 'DUPLICATE_LOCAL_HEADER_REFERENCE'
  | 'HEADER_MISMATCH'
  | 'ENTRY_TOO_LARGE'
  | 'TOTAL_CONTENT_TOO_LARGE'
  | 'ENTRY_RANGE_INVALID'
  | 'ENTRY_RANGE_OVERLAP'
  | 'CRC_MISMATCH'
  | 'INVALID_UTF8_CONTENT'
  | 'CANONICAL_VALIDATION_FAILED';

export interface CanonicalYamlZipCodecError {
  readonly code: CanonicalYamlZipCodecErrorCode;
  readonly entryIndex?: number;
  readonly validationCode?: YamlCanonicalValidationErrorCode;
}

export interface CanonicalYamlZipInputEntry {
  readonly filename: YamlCanonicalFilename;
  readonly payload: ValidatedYamlCanonicalPayload;
}

export interface DecodedCanonicalYamlZipEntry {
  readonly occurrenceIndex: number;
  readonly filename: YamlCanonicalFilename;
  readonly payload: ValidatedYamlCanonicalPayload;
}

export interface EncodedCanonicalYamlZip {
  readonly bytes: Uint8Array;
  readonly base64: string;
}

export interface DecodedCanonicalYamlZip {
  readonly entries: readonly DecodedCanonicalYamlZipEntry[];
}

export type EncodeCanonicalYamlZipResult =
  | Readonly<{ readonly ok: true; readonly value: EncodedCanonicalYamlZip }>
  | Readonly<{ readonly ok: false; readonly error: CanonicalYamlZipCodecError }>;

export type DecodeCanonicalYamlZipResult =
  | Readonly<{ readonly ok: true; readonly value: DecodedCanonicalYamlZip }>
  | Readonly<{ readonly ok: false; readonly error: CanonicalYamlZipCodecError }>;
