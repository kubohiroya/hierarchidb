import type { YamlSubtype } from '../YamlSubtype.js';

/** A canonical YAML payload whose registry tuple and content have been validated. */
export interface ValidatedYamlCanonicalPayload {
  readonly subtype: YamlSubtype;
  readonly schemaId: string;
  readonly content: string;
}

/** Stable, redacted error codes returned by the canonical validation facade. */
export type YamlCanonicalValidationErrorCode =
  | 'INVALID_FILENAME'
  | 'INVALID_PAYLOAD'
  | 'LEGACY_PAYLOAD'
  | 'MIXED_PAYLOAD'
  | 'INCOMPLETE_PAYLOAD'
  | 'UNKNOWN_PAYLOAD_FIELD'
  | 'INVALID_PAYLOAD_FIELD'
  | 'UNKNOWN_REGISTRY_TUPLE'
  | 'INVALID_YAML'
  | 'MULTIPLE_YAML_DOCUMENTS'
  | 'YAML_ROOT_NOT_MAPPING'
  | 'CONTENT_SCHEMA_INVALID'
  | 'UNSAFE_PROPERTY_DESCRIPTOR'
  | 'PAYLOAD_ACCESS_FAILED';

/** Safe error context. Raw input, YAML content, and parser details are never included. */
export interface YamlCanonicalValidationError {
  readonly code: YamlCanonicalValidationErrorCode;
  readonly context?: Readonly<{
    readonly field?: 'filename' | 'payload' | 'name' | 'subtype' | 'schemaId' | 'content';
    readonly reason?:
      | 'missing'
      | 'null'
      | 'invalid-type'
      | 'empty'
      | 'unexpected-field'
      | 'name-mismatch'
      | 'registry-mismatch'
      | 'schema-validation'
      | 'parse-failure'
      | 'multiple-documents'
      | 'non-mapping-root'
      | 'accessor-property'
      | 'reflection-failure';
  }>;
}

/** Result of validating a canonical filename and payload together. */
export type ValidateYamlCanonicalPayloadResult =
  | Readonly<{ readonly ok: true; readonly value: ValidatedYamlCanonicalPayload }>
  | Readonly<{ readonly ok: false; readonly error: YamlCanonicalValidationError }>;
