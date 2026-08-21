import type {
  YamlStorageCorrectiveRecoveryInterruptedCoreStatus,
  YamlStorageCorrectiveRecoveryYamlStatus,
} from '@hierarchidb/runtime-worker/yaml-storage-production';

export type YamlStorageCorrectiveRecoveryInspectionStage = 'recovery-pre' | 'recovery-post';

export interface YamlStorageCorrectiveRecoveryDatabaseNames {
  readonly coordinator: string;
  readonly canonicalCore: string;
  readonly interruptedCore: string;
  readonly yaml: string;
  readonly recovery: string;
}

export type YamlStorageCorrectiveRecoveryInspectionCode =
  | 'RECOVERY_INVENTORY_ACCEPTED'
  | 'RECOVERY_CONFIGURATION_INVALID'
  | 'RECOVERY_DATABASE_DISCOVERY_UNAVAILABLE'
  | 'RECOVERY_DATABASE_DISCOVERY_FAILED'
  | 'RECOVERY_COORDINATOR_CATALOG_MISMATCH'
  | 'RECOVERY_COORDINATOR_OPEN_FAILED'
  | 'RECOVERY_COORDINATOR_OPEN_BLOCKED'
  | 'RECOVERY_COORDINATOR_UNEXPECTED_UPGRADE'
  | 'RECOVERY_COORDINATOR_SCHEMA_MISMATCH'
  | 'RECOVERY_COORDINATOR_STATE_READ_FAILED'
  | 'RECOVERY_COORDINATOR_STATE_MISMATCH'
  | 'RECOVERY_COORDINATOR_DIGEST_FAILED'
  | 'RECOVERY_CANONICAL_CORE_MUST_BE_MISSING'
  | 'RECOVERY_CANONICAL_CORE_CATALOG_MISMATCH'
  | 'RECOVERY_CANONICAL_CORE_OPEN_FAILED'
  | 'RECOVERY_CANONICAL_CORE_SCHEMA_MISMATCH'
  | 'RECOVERY_CANONICAL_CORE_VALIDATION_FAILED'
  | 'RECOVERY_INTERRUPTED_CORE_CATALOG_MISMATCH'
  | 'RECOVERY_INTERRUPTED_CORE_OPEN_FAILED'
  | 'RECOVERY_INTERRUPTED_CORE_UNSAFE'
  | 'RECOVERY_YAML_CATALOG_MISMATCH'
  | 'RECOVERY_YAML_OPEN_FAILED'
  | 'RECOVERY_YAML_SCHEMA_MISMATCH'
  | 'RECOVERY_YAML_SNAPSHOT_READ_FAILED'
  | 'RECOVERY_YAML_DIGEST_FAILED'
  | 'RECOVERY_CLAIM_MUST_BE_MISSING'
  | 'RECOVERY_CLAIM_CATALOG_MISMATCH'
  | 'RECOVERY_CLAIM_OPEN_FAILED'
  | 'RECOVERY_CLAIM_SCHEMA_MISMATCH'
  | 'RECOVERY_CLAIM_READ_FAILED'
  | 'RECOVERY_CLAIM_MISMATCH'
  | 'RECOVERY_BASELINE_MISMATCH'
  | 'RECOVERY_INTERNAL_FAILED';

export type YamlStorageCorrectiveRecoveryInspectionResult =
  | Readonly<{
      readonly mode: YamlStorageCorrectiveRecoveryInspectionStage;
      readonly status: 'accepted';
      readonly code: 'RECOVERY_INVENTORY_ACCEPTED';
      readonly timestamp: string;
      readonly releaseVersion: string;
      readonly coordinator: Readonly<{
        readonly databaseVersion: 2;
        readonly protocolVersion: 2;
        readonly phase: 'revoked';
        readonly stateStatus: 'ready-for-preflight';
        readonly participantCount: number;
        readonly evidenceCount: number;
        readonly fingerprintSha256: string;
      }>;
      readonly canonicalCoreDb: Readonly<
        | { readonly status: 'missing' }
        | {
            readonly status: 'exact-v2';
            readonly logicalVersion: 2;
            readonly nativeVersion: 20;
            readonly topologyStatus: 'exact';
          }
      >;
      readonly interruptedCoreDb: Readonly<{
        readonly status: YamlStorageCorrectiveRecoveryInterruptedCoreStatus;
      }>;
      readonly yamlDb: Readonly<
        | { readonly status: 'missing' }
        | {
            readonly status: 'exact-v1';
            readonly databaseVersion: 1;
            readonly topologyStatus: 'exact';
            readonly rowCount: number;
            readonly digestSha256: string;
          }
      >;
      readonly recoveryClaim: Readonly<
        | { readonly status: 'missing' }
        | {
            readonly status: 'completed';
            readonly protocolVersion: 1;
            readonly recoveryReleaseId: string;
          }
      >;
    }>
  | Readonly<{
      readonly mode: YamlStorageCorrectiveRecoveryInspectionStage;
      readonly status: 'rejected';
      readonly code: Exclude<
        YamlStorageCorrectiveRecoveryInspectionCode,
        'RECOVERY_INVENTORY_ACCEPTED'
      >;
      readonly timestamp?: string;
      readonly releaseVersion?: string;
    }>;

export interface InspectYamlStorageCorrectiveRecoveryInput {
  readonly stage: YamlStorageCorrectiveRecoveryInspectionStage;
  readonly factory: IDBFactory;
  readonly databaseNames: YamlStorageCorrectiveRecoveryDatabaseNames;
  readonly releaseVersion: string;
  readonly timestamp: string;
  readonly digestSha256Hex: (bytes: Uint8Array) => Promise<string>;
}

export interface YamlStorageCorrectiveRecoveryPrivateEvidence {
  readonly coordinatorFingerprintSha256: string;
  readonly interruptedCoreDatabaseStatus: YamlStorageCorrectiveRecoveryInterruptedCoreStatus;
  readonly yamlDatabaseStatus: YamlStorageCorrectiveRecoveryYamlStatus;
  readonly yamlRowCount: number | null;
  readonly yamlDigestSha256: string | null;
}

export type InspectYamlStorageCorrectiveRecoveryPrivateResult =
  | Readonly<{
      readonly ok: true;
      readonly publicResult: Extract<
        YamlStorageCorrectiveRecoveryInspectionResult,
        { readonly status: 'accepted' }
      >;
      readonly evidence: YamlStorageCorrectiveRecoveryPrivateEvidence;
    }>
  | Readonly<{
      readonly ok: false;
      readonly publicResult: Extract<
        YamlStorageCorrectiveRecoveryInspectionResult,
        { readonly status: 'rejected' }
      >;
    }>;

export interface RunYamlStorageCorrectiveRecoveryInput {
  readonly factory: IDBFactory;
  readonly databaseNames: YamlStorageCorrectiveRecoveryDatabaseNames;
  readonly recoveryReleaseId: string;
  readonly expectedCoordinatorFingerprintSha256: string;
  readonly recoveryReleaseVersion: string;
  readonly timestamp: string;
  readonly openRequestId: string;
  readonly digestSha256Hex: (bytes: Uint8Array) => Promise<string>;
  readonly initializeCoreDb: () => Promise<void>;
}

export type RunYamlStorageCorrectiveRecoveryResult =
  | Readonly<{ readonly ok: true; readonly status: 'canonical-existing' | 'recovered' }>
  | Readonly<{ readonly ok: false; readonly code: string }>;
