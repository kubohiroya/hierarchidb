import type { YamlSubtype } from '../YamlSubtype.js';

export type YamlCoreDbMigrationSlot = 'committed' | 'draft';

export type YamlCoreDbMigrationErrorSlot = 'input' | 'node' | YamlCoreDbMigrationSlot;

export type YamlCoreDbMigrationErrorCode =
  | 'INVALID_MIGRATION_ID'
  | 'INVALID_CORE_DB_VERSION'
  | 'INVALID_RAW_NODES'
  | 'INVALID_DIGEST_PORT'
  | 'INVALID_RAW_NODE'
  | 'INVALID_NODE_ID'
  | 'INVALID_NODE_VERSION'
  | 'DUPLICATE_NODE_ID'
  | 'INVALID_NODE_TYPE'
  | 'UNSAFE_PROPERTY_DESCRIPTOR'
  | 'RAW_RECORD_ACCESS_FAILED'
  | 'INVALID_METADATA'
  | 'INVALID_METADATA_NAME'
  | 'INVALID_DRAFT_METADATA'
  | 'INVALID_DRAFT_METADATA_NAME'
  | 'INCOMPLETE_RECORD'
  | 'DRAFT_DATA_WITHOUT_METADATA'
  | 'METADATA_ONLY_DRAFT_NAME_MISMATCH'
  | 'INVALID_PAYLOAD'
  | 'MIXED_PAYLOAD'
  | 'INCOMPLETE_PAYLOAD'
  | 'UNKNOWN_PAYLOAD_FIELD'
  | 'INVALID_PAYLOAD_FIELD'
  | 'METADATA_PAYLOAD_NAME_MISMATCH'
  | 'UNKNOWN_REGISTRY_TUPLE'
  | 'AMBIGUOUS_REGISTRY_TUPLE'
  | 'INVALID_YAML'
  | 'MULTIPLE_YAML_DOCUMENTS'
  | 'YAML_ROOT_NOT_MAPPING'
  | 'CONTENT_SCHEMA_INVALID'
  | 'DIGEST_PORT_FAILED'
  | 'INVALID_DIGEST_OUTPUT';

export interface YamlCoreDbMigrationError {
  readonly sourceIndex: number;
  readonly nodeId?: string;
  readonly slot: YamlCoreDbMigrationErrorSlot;
  readonly code: YamlCoreDbMigrationErrorCode;
  readonly context?: Readonly<{
    readonly field?:
      | 'migrationId'
      | 'fromCoreDbVersion'
      | 'toCoreDbVersion'
      | 'rawNodes'
      | 'digestSha256Hex'
      | 'id'
      | 'version'
      | 'nodeType'
      | 'metadata'
      | 'draftMetadata'
      | 'data'
      | 'draftData'
      | 'payload'
      | 'name'
      | 'subtype'
      | 'schemaId'
      | 'content';
    readonly reason?:
      | 'missing'
      | 'undefined'
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
      | 'duplicate-node-id'
      | 'hash-failure'
      | 'invalid-hash-output'
      | 'accessor-property'
      | 'record-access-failure';
  }>;
}

export interface YamlCoreDbMigrationInput {
  readonly migrationId: string;
  readonly fromCoreDbVersion: number;
  readonly toCoreDbVersion: number;
  readonly rawNodes: readonly unknown[];
  readonly digestSha256Hex: (bytes: Uint8Array) => Promise<string>;
}

export interface YamlLegacyMigrationPayload {
  readonly name: string;
  readonly schemaId: string;
  readonly content: string;
}

export interface YamlHostSplitLegacyMigrationPayload {
  readonly schemaId: string;
  readonly content: string;
}

export type YamlCoreDbMigrationPreimageRepresentation = 'legacy-with-name' | 'host-split-legacy';

export interface YamlCanonicalMigrationPayload {
  readonly subtype: YamlSubtype;
  readonly schemaId: string;
  readonly content: string;
}

export interface YamlCoreDbMigrationJournalValue {
  readonly migrationId: string;
  readonly fromCoreDbVersion: number;
  readonly toCoreDbVersion: number;
  readonly nodeId: string;
  readonly slot: YamlCoreDbMigrationSlot;
  readonly preimageRepresentation: YamlCoreDbMigrationPreimageRepresentation;
  readonly legacyName: string;
  readonly canonicalPostimageDigest: string;
}

interface YamlCoreDbMigrateEntryBase {
  readonly action: 'migrate';
  readonly nodeId: string;
  readonly slot: YamlCoreDbMigrationSlot;
  readonly postimage: YamlCanonicalMigrationPayload;
  readonly legacyName: string;
  readonly canonicalPostimageDigest: string;
  readonly journalValue: YamlCoreDbMigrationJournalValue;
}

export interface YamlCoreDbLegacyWithNameMigrateEntry extends YamlCoreDbMigrateEntryBase {
  readonly preimageRepresentation: 'legacy-with-name';
  readonly preimage: YamlLegacyMigrationPayload;
}

export interface YamlCoreDbHostSplitLegacyMigrateEntry extends YamlCoreDbMigrateEntryBase {
  readonly preimageRepresentation: 'host-split-legacy';
  readonly preimage: YamlHostSplitLegacyMigrationPayload;
}

export type YamlCoreDbMigrateEntry =
  | YamlCoreDbLegacyWithNameMigrateEntry
  | YamlCoreDbHostSplitLegacyMigrateEntry;

export interface YamlCoreDbValidatedNoopEntry {
  readonly action: 'validated-noop';
  readonly nodeId: string;
  readonly slot: YamlCoreDbMigrationSlot;
  readonly reason: 'canonical' | 'temporary-placeholder' | 'metadata-only-draft';
}

export type YamlCoreDbMigrationPlanEntry = YamlCoreDbMigrateEntry | YamlCoreDbValidatedNoopEntry;

export interface YamlCoreDbMigrationNodeGuard {
  readonly sourceIndex: number;
  readonly nodeId: string;
  readonly expectedVersion: number;
}

export interface YamlCoreDbMigrationPlan {
  readonly migrationId: string;
  readonly fromCoreDbVersion: number;
  readonly toCoreDbVersion: number;
  readonly nodeGuards: readonly YamlCoreDbMigrationNodeGuard[];
  readonly entries: readonly YamlCoreDbMigrationPlanEntry[];
}

export type YamlCoreDbMigrationResult =
  | Readonly<{
      readonly ok: true;
      readonly plan: YamlCoreDbMigrationPlan;
    }>
  | Readonly<{
      readonly ok: false;
      readonly errors: readonly YamlCoreDbMigrationError[];
    }>;
