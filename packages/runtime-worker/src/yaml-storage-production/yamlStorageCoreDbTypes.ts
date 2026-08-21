import type { YamlCoreDbMigrationError } from '@hierarchidb/yaml-api/migration';
import type {
  YamlStorageActivationState,
  YamlStorageCanonicalReadyState,
  YamlStoragePreflightState,
} from '../yaml-storage-activation/index.js';

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
