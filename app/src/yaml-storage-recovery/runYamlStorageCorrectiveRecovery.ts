import {
  CORE_DB_CANONICAL_NATIVE_VERSION,
  recoverMissingYamlStorageCoreDb,
} from '@hierarchidb/runtime-worker/yaml-storage-production';
import { createYamlStorageCorrectiveRecoveryClaim } from './createYamlStorageCorrectiveRecoveryClaim.js';
import { inspectYamlStorageCorrectiveRecoveryPrivate } from './inspectYamlStorageCorrectiveRecovery.js';
import { isExactYamlStorageCorrectiveRecoveryDatabaseNames } from './isExactYamlStorageCorrectiveRecoveryDatabaseNames.js';
import type {
  RunYamlStorageCorrectiveRecoveryInput,
  RunYamlStorageCorrectiveRecoveryResult,
} from './yamlStorageCorrectiveRecoveryTypes.js';

const RECOVERY_RELEASE_ID = 'incident-1388-v1' as const;
const SOURCE_SHA_PATTERN = /^[0-9a-f]{40}$/u;
const SHA256_PATTERN = /^[0-9a-f]{64}$/u;

function failed(code: string): RunYamlStorageCorrectiveRecoveryResult {
  return Object.freeze({ ok: false, code });
}

function inputIsValid(input: RunYamlStorageCorrectiveRecoveryInput): boolean {
  return (
    input.recoveryReleaseId === RECOVERY_RELEASE_ID &&
    isExactYamlStorageCorrectiveRecoveryDatabaseNames(input.databaseNames) &&
    SHA256_PATTERN.test(input.expectedCoordinatorFingerprintSha256) &&
    SOURCE_SHA_PATTERN.test(input.recoveryReleaseVersion) &&
    typeof input.openRequestId === 'string' &&
    input.openRequestId.length > 0 &&
    typeof input.digestSha256Hex === 'function' &&
    typeof input.initializeCoreDb === 'function'
  );
}

/** Runs the approved incident recovery once; an existing canonical database uses normal successor boot. */
export async function runYamlStorageCorrectiveRecovery(
  input: RunYamlStorageCorrectiveRecoveryInput
): Promise<RunYamlStorageCorrectiveRecoveryResult> {
  if (!inputIsValid(input)) return failed('RECOVERY_CONFIGURATION_INVALID');
  if (typeof input.factory.databases !== 'function') {
    return failed('RECOVERY_DATABASE_DISCOVERY_UNAVAILABLE');
  }
  let catalog: IDBDatabaseInfo[];
  try {
    catalog = await input.factory.databases();
  } catch {
    return failed('RECOVERY_DATABASE_DISCOVERY_FAILED');
  }
  const canonicalMatches = catalog.filter(
    (entry) => entry.name === input.databaseNames.canonicalCore
  );
  const recoveryMatches = catalog.filter((entry) => entry.name === input.databaseNames.recovery);
  if (canonicalMatches.length > 0) {
    if (
      canonicalMatches.length !== 1 ||
      canonicalMatches[0]?.version !== CORE_DB_CANONICAL_NATIVE_VERSION
    ) {
      return failed('RECOVERY_CANONICAL_CORE_CATALOG_MISMATCH');
    }
    if (recoveryMatches.length === 0) {
      return Object.freeze({ ok: true, status: 'canonical-existing' });
    }
    const postInspection = await inspectYamlStorageCorrectiveRecoveryPrivate(
      {
        stage: 'recovery-post',
        factory: input.factory,
        databaseNames: input.databaseNames,
        releaseVersion: input.recoveryReleaseVersion,
        timestamp: input.timestamp,
        digestSha256Hex: input.digestSha256Hex,
      },
      catalog
    );
    return postInspection.ok
      ? Object.freeze({ ok: true, status: 'canonical-existing' })
      : failed(postInspection.publicResult.code);
  }
  if (recoveryMatches.length !== 0) {
    return failed('RECOVERY_CLAIM_ALREADY_EXISTS');
  }

  const preInspection = await inspectYamlStorageCorrectiveRecoveryPrivate(
    {
      stage: 'recovery-pre',
      factory: input.factory,
      databaseNames: input.databaseNames,
      releaseVersion: input.recoveryReleaseVersion,
      timestamp: input.timestamp,
      digestSha256Hex: input.digestSha256Hex,
    },
    catalog
  );
  if (preInspection.ok === false) return failed(preInspection.publicResult.code);
  if (
    preInspection.evidence.coordinatorFingerprintSha256 !==
    input.expectedCoordinatorFingerprintSha256
  ) {
    return failed('RECOVERY_COORDINATOR_FINGERPRINT_MISMATCH');
  }

  const claim = await createYamlStorageCorrectiveRecoveryClaim({
    factory: input.factory,
    recoveryDatabaseName: input.databaseNames.recovery,
    recoveryReleaseId: input.recoveryReleaseId,
    coordinatorFingerprintSha256: preInspection.evidence.coordinatorFingerprintSha256,
    recoveryReleaseVersion: input.recoveryReleaseVersion,
    openRequestId: input.openRequestId,
    interruptedCoreDatabaseStatus: preInspection.evidence.interruptedCoreDatabaseStatus,
    yamlDatabaseStatus: preInspection.evidence.yamlDatabaseStatus,
    yamlRowCount: preInspection.evidence.yamlRowCount,
    yamlDigestSha256: preInspection.evidence.yamlDigestSha256,
  });
  if (claim.ok === false) return failed(claim.code);

  const recovered = await recoverMissingYamlStorageCoreDb({
    databaseName: input.databaseNames.canonicalCore,
    recoveryDatabaseName: input.databaseNames.recovery,
    recoveryDatabase: claim.database,
    recoveryReleaseId: input.recoveryReleaseId,
    coordinatorFingerprintSha256: preInspection.evidence.coordinatorFingerprintSha256,
    recoveryReleaseVersion: input.recoveryReleaseVersion,
    openRequestId: input.openRequestId,
    interruptedCoreDatabaseStatus: preInspection.evidence.interruptedCoreDatabaseStatus,
    yamlDatabaseStatus: preInspection.evidence.yamlDatabaseStatus,
    yamlRowCount: preInspection.evidence.yamlRowCount,
    yamlDigestSha256: preInspection.evidence.yamlDigestSha256,
    environment: {
      indexedDB: input.factory,
      digestSha256Hex: input.digestSha256Hex,
      initializeCoreDb: input.initializeCoreDb,
    },
  });
  return recovered.ok
    ? Object.freeze({ ok: true, status: 'recovered' })
    : failed(recovered.error.code);
}
