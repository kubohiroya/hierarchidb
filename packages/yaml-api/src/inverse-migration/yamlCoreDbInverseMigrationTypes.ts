import type { YamlSubtype } from '../YamlSubtype.js';

export type YamlCoreDbInverseMigrationSlot = 'committed' | 'draft';

export type ExactYamlCoreDbInversePublicationRequirement = 'canonical-writer-never-published';

export type ReleaseYamlCoreDbInversePublicationRequirement =
  'canonical-writer-published-or-unknown';

export type YamlCoreDbInverseMigrationErrorSlot =
  | 'input'
  | 'node'
  | 'journal'
  | YamlCoreDbInverseMigrationSlot;

export type YamlCoreDbInverseMigrationErrorCode =
  | 'INVALID_INPUT'
  | 'INVALID_ROLLBACK_ID'
  | 'INVALID_FORWARD_MIGRATION_ID'
  | 'INVALID_CORE_DB_VERSION'
  | 'INVALID_PUBLICATION_REQUIREMENT'
  | 'INVALID_RAW_NODES'
  | 'INVALID_RAW_JOURNAL'
  | 'INVALID_DIGEST_PORT'
  | 'INVALID_RAW_NODE'
  | 'INVALID_NODE_ID'
  | 'INVALID_NODE_VERSION'
  | 'DUPLICATE_NODE_ID'
  | 'INVALID_NODE_TYPE'
  | 'UNKNOWN_RAW_NODE_FIELD'
  | 'UNSAFE_PROPERTY_DESCRIPTOR'
  | 'RAW_RECORD_ACCESS_FAILED'
  | 'INVALID_METADATA'
  | 'INVALID_METADATA_NAME'
  | 'UNKNOWN_METADATA_FIELD'
  | 'INVALID_DRAFT_METADATA'
  | 'INVALID_DRAFT_METADATA_NAME'
  | 'INCOMPLETE_RECORD'
  | 'DRAFT_DATA_WITHOUT_METADATA'
  | 'METADATA_ONLY_DRAFT_NAME_MISMATCH'
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
  | 'PAYLOAD_ACCESS_FAILED'
  | 'INVALID_RAW_JOURNAL_ENTRY'
  | 'INVALID_JOURNAL_FIELD'
  | 'DUPLICATE_JOURNAL_KEY'
  | 'JOURNAL_MIGRATION_ID_MISMATCH'
  | 'JOURNAL_VERSION_COHORT_MISMATCH'
  | 'JOURNAL_NODE_NOT_FOUND'
  | 'JOURNAL_SLOT_NOT_FOUND'
  | 'JOURNAL_LEGACY_NAME_MISMATCH'
  | 'JOURNAL_DIGEST_MISMATCH'
  | 'DIGEST_PORT_FAILED'
  | 'INVALID_DIGEST_OUTPUT';

export interface YamlCoreDbInverseMigrationError {
  readonly sourceIndex: number;
  readonly nodeId?: string;
  readonly slot: YamlCoreDbInverseMigrationErrorSlot;
  readonly code: YamlCoreDbInverseMigrationErrorCode;
  readonly context?: Readonly<{
    readonly field?:
      | 'input'
      | 'rollbackId'
      | 'forwardMigrationId'
      | 'currentCoreDbVersion'
      | 'rollbackTargetVersion'
      | 'publicationRequirement'
      | 'rawNodes'
      | 'rawJournalEntries'
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
      | 'content'
      | 'migrationId'
      | 'fromCoreDbVersion'
      | 'toCoreDbVersion'
      | 'nodeId'
      | 'slot'
      | 'preimageRepresentation'
      | 'legacyName'
      | 'canonicalPostimageDigest';
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
      | 'duplicate-journal-key'
      | 'migration-id-mismatch'
      | 'version-cohort-mismatch'
      | 'missing-node'
      | 'missing-slot'
      | 'digest-mismatch'
      | 'hash-failure'
      | 'invalid-hash-output'
      | 'accessor-property'
      | 'reflection-failure';
  }>;
}

export interface YamlCanonicalInverseMigrationPayload {
  readonly subtype: YamlSubtype;
  readonly schemaId: string;
  readonly content: string;
}

export interface YamlLegacyInverseMigrationPayload {
  readonly name: string;
  readonly schemaId: string;
  readonly content: string;
}

export interface YamlHostSplitLegacyInverseMigrationPayload {
  readonly schemaId: string;
  readonly content: string;
}

export type YamlCoreDbInverseMigrationPreimageRepresentation =
  | 'legacy-with-name'
  | 'host-split-legacy';

export interface YamlCoreDbInverseMigrationNodeGuard {
  readonly sourceIndex: number;
  readonly nodeId: string;
  readonly expectedVersion: number;
}

export interface YamlCoreDbExactInverseMigrationJournalGuard {
  readonly sourceIndex: number;
  readonly migrationId: string;
  readonly fromCoreDbVersion: number;
  readonly toCoreDbVersion: number;
  readonly nodeId: string;
  readonly slot: YamlCoreDbInverseMigrationSlot;
  readonly preimageRepresentation: YamlCoreDbInverseMigrationPreimageRepresentation;
  readonly legacyName: string;
  readonly canonicalPostimageDigest: string;
}

export interface YamlCoreDbInverseMigrationValidatedNoop {
  readonly action: 'validated-noop';
  readonly nodeId: string;
  readonly slot: YamlCoreDbInverseMigrationSlot;
  readonly reason: 'non-journal-canonical' | 'temporary-placeholder' | 'metadata-only-draft';
}

interface YamlCoreDbExactInverseMigrationEntryBase {
  readonly action: 'restore-exact-legacy';
  readonly nodeId: string;
  readonly slot: YamlCoreDbInverseMigrationSlot;
  readonly preimage: YamlCanonicalInverseMigrationPayload;
  readonly expectedCanonicalPostimageDigest: string;
}

export interface YamlCoreDbExactLegacyWithNameInverseMigrationEntry
  extends YamlCoreDbExactInverseMigrationEntryBase {
  readonly preimageRepresentation: 'legacy-with-name';
  readonly postimage: YamlLegacyInverseMigrationPayload;
}

export interface YamlCoreDbExactHostSplitLegacyInverseMigrationEntry
  extends YamlCoreDbExactInverseMigrationEntryBase {
  readonly preimageRepresentation: 'host-split-legacy';
  readonly postimage: YamlHostSplitLegacyInverseMigrationPayload;
}

export type YamlCoreDbExactInverseMigrationEntry =
  | YamlCoreDbExactLegacyWithNameInverseMigrationEntry
  | YamlCoreDbExactHostSplitLegacyInverseMigrationEntry;

export interface YamlCoreDbReleaseInverseMigrationEntry {
  readonly action: 'restore-release-legacy';
  readonly nodeId: string;
  readonly slot: YamlCoreDbInverseMigrationSlot;
  readonly preimage: YamlCanonicalInverseMigrationPayload;
  readonly postimage: YamlLegacyInverseMigrationPayload;
}

export type YamlCoreDbExactInverseMigrationPlanEntry =
  | YamlCoreDbExactInverseMigrationEntry
  | YamlCoreDbInverseMigrationValidatedNoop;

export type YamlCoreDbReleaseInverseMigrationPlanEntry =
  | YamlCoreDbReleaseInverseMigrationEntry
  | YamlCoreDbInverseMigrationValidatedNoop;

export interface PlanExactYamlCoreDbInverseMigrationInput {
  readonly rollbackId: string;
  readonly forwardMigrationId: string;
  readonly currentCoreDbVersion: number;
  readonly rollbackTargetVersion: number;
  readonly publicationRequirement: ExactYamlCoreDbInversePublicationRequirement;
  readonly rawNodes: readonly unknown[];
  readonly rawJournalEntries: readonly unknown[];
  readonly digestSha256Hex: (bytes: Uint8Array) => Promise<string>;
}

export interface PlanReleaseYamlCoreDbInverseMigrationInput {
  readonly rollbackId: string;
  readonly currentCoreDbVersion: number;
  readonly rollbackTargetVersion: number;
  readonly publicationRequirement: ReleaseYamlCoreDbInversePublicationRequirement;
  readonly rawNodes: readonly unknown[];
}

export interface YamlCoreDbExactInverseMigrationPlan {
  readonly rollbackId: string;
  readonly forwardMigrationId: string;
  readonly currentCoreDbVersion: number;
  readonly rollbackTargetVersion: number;
  readonly publicationRequirement: ExactYamlCoreDbInversePublicationRequirement;
  readonly nodeGuards: readonly YamlCoreDbInverseMigrationNodeGuard[];
  readonly journalGuards: readonly YamlCoreDbExactInverseMigrationJournalGuard[];
  readonly entries: readonly YamlCoreDbExactInverseMigrationPlanEntry[];
}

export interface YamlCoreDbReleaseInverseMigrationPlan {
  readonly rollbackId: string;
  readonly currentCoreDbVersion: number;
  readonly rollbackTargetVersion: number;
  readonly publicationRequirement: ReleaseYamlCoreDbInversePublicationRequirement;
  readonly nodeGuards: readonly YamlCoreDbInverseMigrationNodeGuard[];
  readonly entries: readonly YamlCoreDbReleaseInverseMigrationPlanEntry[];
}

export type PlanExactYamlCoreDbInverseMigrationResult =
  | Readonly<{ readonly ok: true; readonly plan: YamlCoreDbExactInverseMigrationPlan }>
  | Readonly<{ readonly ok: false; readonly errors: readonly YamlCoreDbInverseMigrationError[] }>;

export type PlanReleaseYamlCoreDbInverseMigrationResult =
  | Readonly<{ readonly ok: true; readonly plan: YamlCoreDbReleaseInverseMigrationPlan }>
  | Readonly<{ readonly ok: false; readonly errors: readonly YamlCoreDbInverseMigrationError[] }>;
