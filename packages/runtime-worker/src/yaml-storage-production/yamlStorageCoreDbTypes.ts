import type { YamlCoreDbMigrationError } from '@hierarchidb/yaml-api/migration';
import type {
  YamlStorageActivationState,
  YamlStorageCanonicalReadyState,
  YamlStoragePreflightState,
} from '../yaml-storage-activation/yamlStorageActivationTypes.js';

export type YamlStorageCoreDbErrorCode =
  | 'INVALID_ACTIVATION_INPUT'
  | 'CORE_DB_DISCOVERY_UNAVAILABLE'
  | 'CORE_DB_NOT_FOUND'
  | 'CORE_DB_VERSION_MISMATCH'
  | 'CORE_DB_OPEN_FAILED'
  | 'CORE_DB_SCHEMA_MISMATCH'
  | 'CORE_DB_SNAPSHOT_FAILED'
  | 'MIGRATION_PREFLIGHT_FAILED'
  | 'MIGRATION_SNAPSHOT_MISMATCH'
  | 'MIGRATION_TARGET_OPEN_FAILED'
  | 'MIGRATION_UPGRADE_FAILED'
  | 'CORE_DB_INITIALIZATION_FAILED'
  | 'POST_ACTIVATION_CANONICAL_VALIDATION_FAILED';

export interface YamlStorageCoreDbError {
  readonly code: YamlStorageCoreDbErrorCode;
  readonly planningErrors?: readonly YamlCoreDbMigrationError[];
}

export interface YamlStorageCoreDbEnvironment {
  readonly indexedDB: IDBFactory;
  readonly digestSha256Hex: (bytes: Uint8Array) => Promise<string>;
  readonly initializeCoreDb: () => Promise<void>;
}

export interface ActivateYamlStorageCoreDbInput {
  readonly state: YamlStoragePreflightState;
  readonly databaseName: string;
  readonly migrationId: string;
  readonly openRequestId: string;
  readonly environment: YamlStorageCoreDbEnvironment;
}

export type ActivateYamlStorageCoreDbResult =
  | Readonly<{
      readonly ok: true;
      readonly state: YamlStorageCanonicalReadyState;
    }>
  | Readonly<{
      readonly ok: false;
      readonly state: YamlStorageActivationState;
      readonly error: YamlStorageCoreDbError;
    }>;

export interface InspectCanonicalYamlStorageCoreDbInput {
  readonly activationId: string;
  readonly databaseName: string;
  readonly targetVersion: number;
  readonly openRequestId: string;
  readonly coordinatorGate: 'revoked-ready-for-preflight';
  readonly environment: YamlStorageCoreDbEnvironment;
}

export type InspectCanonicalYamlStorageCoreDbResult =
  | Readonly<{
      readonly ok: true;
      readonly state: YamlStorageCanonicalReadyState;
    }>
  | Readonly<{
      readonly ok: false;
      readonly error: YamlStorageCoreDbError;
    }>;

export type YamlStorageCorrectiveRecoveryInterruptedCoreStatus = 'missing' | 'empty-native-v2';

export type YamlStorageCorrectiveRecoveryYamlStatus = 'missing' | 'exact-v1';

export interface YamlStorageCorrectiveRecoveryClaimRecord {
  readonly key: string;
  readonly protocolVersion: 1;
  readonly phase: 'claimed' | 'completed';
  readonly coordinatorFingerprintSha256: string;
  readonly recoveryReleaseId: string;
  readonly recoveryReleaseVersion: string;
  readonly openRequestId: string;
  readonly interruptedCoreDatabaseStatus: YamlStorageCorrectiveRecoveryInterruptedCoreStatus;
  readonly yamlDatabaseStatus: YamlStorageCorrectiveRecoveryYamlStatus;
  readonly yamlRowCount: number | null;
  readonly yamlDigestSha256: string | null;
}

export type YamlStorageCorrectiveRecoveryErrorCode =
  | 'INVALID_RECOVERY_INPUT'
  | 'RECOVERY_CLAIM_SCHEMA_MISMATCH'
  | 'RECOVERY_CLAIM_READ_FAILED'
  | 'RECOVERY_CLAIM_MISMATCH'
  | 'RECOVERY_TARGET_OPEN_FAILED'
  | 'RECOVERY_TARGET_OPEN_BLOCKED'
  | 'RECOVERY_TARGET_VERSION_MISMATCH'
  | 'RECOVERY_CORE_DB_INITIALIZATION_FAILED'
  | 'RECOVERY_CANONICAL_VALIDATION_FAILED'
  | 'RECOVERY_COMPLETION_WRITE_FAILED';

export interface RecoverMissingYamlStorageCoreDbInput {
  readonly databaseName: string;
  readonly recoveryDatabaseName: string;
  readonly recoveryDatabase: IDBDatabase;
  readonly recoveryReleaseId: string;
  readonly coordinatorFingerprintSha256: string;
  readonly recoveryReleaseVersion: string;
  readonly openRequestId: string;
  readonly interruptedCoreDatabaseStatus: YamlStorageCorrectiveRecoveryInterruptedCoreStatus;
  readonly yamlDatabaseStatus: YamlStorageCorrectiveRecoveryYamlStatus;
  readonly yamlRowCount: number | null;
  readonly yamlDigestSha256: string | null;
  readonly environment: YamlStorageCoreDbEnvironment;
}

export type RecoverMissingYamlStorageCoreDbResult =
  | Readonly<{ readonly ok: true }>
  | Readonly<{
      readonly ok: false;
      readonly error: Readonly<{ readonly code: YamlStorageCorrectiveRecoveryErrorCode }>;
    }>;
