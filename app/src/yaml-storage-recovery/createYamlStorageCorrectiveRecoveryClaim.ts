import type {
  YamlStorageCorrectiveRecoveryClaimRecord,
  YamlStorageCorrectiveRecoveryInterruptedCoreStatus,
  YamlStorageCorrectiveRecoveryYamlStatus,
} from '@hierarchidb/runtime-worker/yaml-storage-production';

const RECOVERY_DATABASE_VERSION = 1;
const RECOVERY_STORE_NAME = 'recovery-state';
const RECOVERY_DATABASE_SUFFIX = '-yaml-storage-recovery';
const DATABASE_PREFIX_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/u;
const RECOVERY_RELEASE_ID = 'incident-1388-v1' as const;
const SOURCE_SHA_PATTERN = /^[0-9a-f]{40}$/u;
const SHA256_PATTERN = /^[0-9a-f]{64}$/u;

export interface CreateYamlStorageCorrectiveRecoveryClaimInput {
  readonly factory: IDBFactory;
  readonly recoveryDatabaseName: string;
  readonly recoveryReleaseId: string;
  readonly coordinatorFingerprintSha256: string;
  readonly recoveryReleaseVersion: string;
  readonly openRequestId: string;
  readonly interruptedCoreDatabaseStatus: YamlStorageCorrectiveRecoveryInterruptedCoreStatus;
  readonly yamlDatabaseStatus: YamlStorageCorrectiveRecoveryYamlStatus;
  readonly yamlRowCount: number | null;
  readonly yamlDigestSha256: string | null;
}

export type CreateYamlStorageCorrectiveRecoveryClaimResult =
  | Readonly<{ readonly ok: true; readonly database: IDBDatabase }>
  | Readonly<{
      readonly ok: false;
      readonly code:
        | 'RECOVERY_CLAIM_INPUT_INVALID'
        | 'RECOVERY_CLAIM_OPEN_FAILED'
        | 'RECOVERY_CLAIM_OPEN_BLOCKED'
        | 'RECOVERY_CLAIM_ALREADY_EXISTS'
        | 'RECOVERY_CLAIM_WRITE_FAILED';
    }>;

function inputIsValid(input: CreateYamlStorageCorrectiveRecoveryClaimInput): boolean {
  if (
    typeof input.recoveryDatabaseName !== 'string' ||
    typeof input.coordinatorFingerprintSha256 !== 'string' ||
    typeof input.recoveryReleaseVersion !== 'string' ||
    typeof input.openRequestId !== 'string'
  ) {
    return false;
  }
  const prefix = input.recoveryDatabaseName.endsWith(RECOVERY_DATABASE_SUFFIX)
    ? input.recoveryDatabaseName.slice(0, -RECOVERY_DATABASE_SUFFIX.length)
    : '';
  const yamlSummaryIsValid =
    (input.yamlDatabaseStatus === 'missing' &&
      input.yamlRowCount === null &&
      input.yamlDigestSha256 === null) ||
    (input.yamlDatabaseStatus === 'exact-v1' &&
      typeof input.yamlRowCount === 'number' &&
      Number.isSafeInteger(input.yamlRowCount) &&
      input.yamlRowCount >= 0 &&
      typeof input.yamlDigestSha256 === 'string' &&
      SHA256_PATTERN.test(input.yamlDigestSha256));
  return (
    DATABASE_PREFIX_PATTERN.test(prefix) &&
    input.recoveryDatabaseName === `${prefix}${RECOVERY_DATABASE_SUFFIX}` &&
    input.recoveryReleaseId === RECOVERY_RELEASE_ID &&
    SHA256_PATTERN.test(input.coordinatorFingerprintSha256) &&
    SOURCE_SHA_PATTERN.test(input.recoveryReleaseVersion) &&
    input.openRequestId.length > 0 &&
    (input.interruptedCoreDatabaseStatus === 'missing' ||
      input.interruptedCoreDatabaseStatus === 'empty-native-v2') &&
    yamlSummaryIsValid &&
    typeof input.factory.open === 'function'
  );
}

function createClaimRecord(
  input: CreateYamlStorageCorrectiveRecoveryClaimInput
): YamlStorageCorrectiveRecoveryClaimRecord {
  return Object.freeze({
    key: input.recoveryReleaseId,
    protocolVersion: 1,
    phase: 'claimed',
    coordinatorFingerprintSha256: input.coordinatorFingerprintSha256,
    recoveryReleaseId: input.recoveryReleaseId,
    recoveryReleaseVersion: input.recoveryReleaseVersion,
    openRequestId: input.openRequestId,
    interruptedCoreDatabaseStatus: input.interruptedCoreDatabaseStatus,
    yamlDatabaseStatus: input.yamlDatabaseStatus,
    yamlRowCount: input.yamlRowCount,
    yamlDigestSha256: input.yamlDigestSha256,
  });
}

/** Atomically creates the dedicated recovery database and its only claim record. */
export function createYamlStorageCorrectiveRecoveryClaim(
  input: CreateYamlStorageCorrectiveRecoveryClaimInput
): Promise<CreateYamlStorageCorrectiveRecoveryClaimResult> {
  return new Promise((resolve) => {
    if (!inputIsValid(input)) {
      resolve(Object.freeze({ ok: false, code: 'RECOVERY_CLAIM_INPUT_INVALID' }));
      return;
    }
    let settled = false;
    let claimStarted = false;
    let claimWriteFailed = false;
    let blocked = false;
    const finish = (result: CreateYamlStorageCorrectiveRecoveryClaimResult): void => {
      if (settled) return;
      settled = true;
      resolve(result);
    };
    let request: IDBOpenDBRequest;
    try {
      request = input.factory.open(input.recoveryDatabaseName, RECOVERY_DATABASE_VERSION);
    } catch {
      finish(Object.freeze({ ok: false, code: 'RECOVERY_CLAIM_OPEN_FAILED' }));
      return;
    }
    request.onblocked = () => {
      blocked = true;
      finish(Object.freeze({ ok: false, code: 'RECOVERY_CLAIM_OPEN_BLOCKED' }));
    };
    request.onerror = () =>
      finish(
        Object.freeze({
          ok: false,
          code: claimWriteFailed ? 'RECOVERY_CLAIM_WRITE_FAILED' : 'RECOVERY_CLAIM_OPEN_FAILED',
        })
      );
    request.onupgradeneeded = (event) => {
      const transaction = request.transaction;
      if (
        transaction === null ||
        blocked ||
        event.oldVersion !== 0 ||
        event.newVersion !== RECOVERY_DATABASE_VERSION ||
        request.result.objectStoreNames.length !== 0
      ) {
        transaction?.abort();
        return;
      }
      claimStarted = true;
      try {
        const store = request.result.createObjectStore(RECOVERY_STORE_NAME, { keyPath: 'key' });
        const addRequest = store.add(createClaimRecord(input));
        addRequest.onerror = () => {
          claimWriteFailed = true;
          transaction.abort();
        };
      } catch {
        claimWriteFailed = true;
        transaction.abort();
      }
    };
    request.onsuccess = () => {
      if (settled) {
        request.result.close();
        return;
      }
      if (claimStarted) {
        finish(Object.freeze({ ok: true, database: request.result }));
        return;
      }
      request.result.close();
      finish(Object.freeze({ ok: false, code: 'RECOVERY_CLAIM_ALREADY_EXISTS' }));
    };
  });
}
