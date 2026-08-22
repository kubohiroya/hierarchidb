import { validateCanonicalYamlStorageCoreDb } from './validateCanonicalYamlStorageCoreDb.js';
import { createCoreDbV2Schema, openCoreDbAtExactVersion } from './yamlStorageCoreDbSchemaUtils.js';
import type {
  RecoverMissingYamlStorageCoreDbInput,
  RecoverMissingYamlStorageCoreDbResult,
  YamlStorageCorrectiveRecoveryClaimRecord,
  YamlStorageCorrectiveRecoveryErrorCode,
} from './yamlStorageCoreDbTypes.js';
import { CORE_DB_CANONICAL_NATIVE_VERSION } from './yamlStorageCoreDbVersionConstants.js';

const RECOVERY_DATABASE_VERSION = 1;
const RECOVERY_STORE_NAME = 'recovery-state';
const DATABASE_NAME_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/u;
const RECOVERY_RELEASE_ID = 'incident-1388-v1' as const;
const SOURCE_SHA_PATTERN = /^[0-9a-f]{40}$/u;
const SHA256_PATTERN = /^[0-9a-f]{64}$/u;

type OwnDataProperty =
  | Readonly<{ readonly found: false }>
  | Readonly<{ readonly found: true; readonly value: unknown }>;

function failedResult(
  code: YamlStorageCorrectiveRecoveryErrorCode
): RecoverMissingYamlStorageCoreDbResult {
  return Object.freeze({ ok: false, error: Object.freeze({ code }) });
}

function readOwnDataProperty(value: object, key: string): OwnDataProperty {
  const descriptor = Object.getOwnPropertyDescriptor(value, key);
  return descriptor !== undefined && 'value' in descriptor
    ? Object.freeze({ found: true, value: descriptor.value })
    : Object.freeze({ found: false });
}

function isPlainObject(value: unknown): value is object {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) return false;
  const prototype = Object.getPrototypeOf(value);
  return prototype === Object.prototype || prototype === null;
}

function hasExactOwnDataProperties(value: object, expectedKeys: readonly string[]): boolean {
  const keys = Reflect.ownKeys(value);
  return (
    keys.length === expectedKeys.length &&
    keys.every((key) => typeof key === 'string' && expectedKeys.includes(key)) &&
    expectedKeys.every((key) => readOwnDataProperty(value, key).found)
  );
}

function readOwnValue(value: object, key: string): unknown {
  const property = readOwnDataProperty(value, key);
  return property.found ? property.value : undefined;
}

function isValidInput(input: RecoverMissingYamlStorageCoreDbInput): boolean {
  const canonicalSuffix = '-core';
  const databasePrefix = input.databaseName.endsWith(canonicalSuffix)
    ? input.databaseName.slice(0, -canonicalSuffix.length)
    : '';
  const yamlSummaryValid =
    (input.yamlDatabaseStatus === 'missing' &&
      input.yamlRowCount === null &&
      input.yamlDigestSha256 === null) ||
    (input.yamlDatabaseStatus === 'exact-v1' &&
      Number.isSafeInteger(input.yamlRowCount) &&
      typeof input.yamlRowCount === 'number' &&
      input.yamlRowCount >= 0 &&
      typeof input.yamlDigestSha256 === 'string' &&
      SHA256_PATTERN.test(input.yamlDigestSha256));
  return (
    DATABASE_NAME_PATTERN.test(databasePrefix) &&
    input.databaseName === `${databasePrefix}-core` &&
    input.recoveryDatabaseName === `${databasePrefix}-yaml-storage-recovery` &&
    input.recoveryDatabase.name === input.recoveryDatabaseName &&
    input.recoveryDatabase.version === RECOVERY_DATABASE_VERSION &&
    input.recoveryReleaseId === RECOVERY_RELEASE_ID &&
    SHA256_PATTERN.test(input.coordinatorFingerprintSha256) &&
    SOURCE_SHA_PATTERN.test(input.recoveryReleaseVersion) &&
    typeof input.openRequestId === 'string' &&
    input.openRequestId.length > 0 &&
    (input.interruptedCoreDatabaseStatus === 'missing' ||
      input.interruptedCoreDatabaseStatus === 'empty-native-v2') &&
    yamlSummaryValid &&
    typeof input.environment.indexedDB.open === 'function' &&
    typeof input.environment.digestSha256Hex === 'function' &&
    typeof input.environment.initializeCoreDb === 'function'
  );
}

function createExpectedClaimRecord(
  input: RecoverMissingYamlStorageCoreDbInput,
  phase: 'claimed' | 'completed'
): YamlStorageCorrectiveRecoveryClaimRecord {
  return Object.freeze({
    key: input.recoveryReleaseId,
    protocolVersion: 1,
    phase,
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

function claimRecordMatches(
  value: unknown,
  expected: YamlStorageCorrectiveRecoveryClaimRecord
): boolean {
  if (
    !isPlainObject(value) ||
    !hasExactOwnDataProperties(value, [
      'key',
      'protocolVersion',
      'phase',
      'coordinatorFingerprintSha256',
      'recoveryReleaseId',
      'recoveryReleaseVersion',
      'openRequestId',
      'interruptedCoreDatabaseStatus',
      'yamlDatabaseStatus',
      'yamlRowCount',
      'yamlDigestSha256',
    ])
  ) {
    return false;
  }
  return (
    readOwnValue(value, 'key') === expected.key &&
    readOwnValue(value, 'protocolVersion') === expected.protocolVersion &&
    readOwnValue(value, 'phase') === expected.phase &&
    readOwnValue(value, 'coordinatorFingerprintSha256') === expected.coordinatorFingerprintSha256 &&
    readOwnValue(value, 'recoveryReleaseId') === expected.recoveryReleaseId &&
    readOwnValue(value, 'recoveryReleaseVersion') === expected.recoveryReleaseVersion &&
    readOwnValue(value, 'openRequestId') === expected.openRequestId &&
    readOwnValue(value, 'interruptedCoreDatabaseStatus') ===
      expected.interruptedCoreDatabaseStatus &&
    readOwnValue(value, 'yamlDatabaseStatus') === expected.yamlDatabaseStatus &&
    readOwnValue(value, 'yamlRowCount') === expected.yamlRowCount &&
    readOwnValue(value, 'yamlDigestSha256') === expected.yamlDigestSha256
  );
}

function hasExactRecoverySchema(database: IDBDatabase): boolean {
  if (
    database.version !== RECOVERY_DATABASE_VERSION ||
    database.objectStoreNames.length !== 1 ||
    !database.objectStoreNames.contains(RECOVERY_STORE_NAME)
  ) {
    return false;
  }
  try {
    const transaction = database.transaction(RECOVERY_STORE_NAME, 'readonly');
    const store = transaction.objectStore(RECOVERY_STORE_NAME);
    return store.keyPath === 'key' && !store.autoIncrement && store.indexNames.length === 0;
  } catch {
    return false;
  }
}

function readClaimRecord(
  database: IDBDatabase,
  recoveryReleaseId: string
): Promise<unknown | null> {
  if (!hasExactRecoverySchema(database)) return Promise.resolve(null);
  return new Promise((resolve) => {
    let settled = false;
    let value: unknown = null;
    const finish = (result: unknown | null): void => {
      if (settled) return;
      settled = true;
      resolve(result);
    };
    let transaction: IDBTransaction;
    let request: IDBRequest<unknown>;
    try {
      transaction = database.transaction(RECOVERY_STORE_NAME, 'readonly');
      request = transaction.objectStore(RECOVERY_STORE_NAME).get(recoveryReleaseId);
    } catch {
      finish(null);
      return;
    }
    request.onerror = () => finish(null);
    request.onsuccess = () => {
      value = request.result;
    };
    transaction.onerror = () => finish(null);
    transaction.onabort = () => finish(null);
    transaction.oncomplete = () => finish(value);
  });
}

function createTargetCoreDb(
  input: RecoverMissingYamlStorageCoreDbInput
): Promise<YamlStorageCorrectiveRecoveryErrorCode | null> {
  return new Promise((resolve) => {
    let settled = false;
    let creationStarted = false;
    let blocked = false;
    const finish = (code: YamlStorageCorrectiveRecoveryErrorCode | null): void => {
      if (settled) return;
      settled = true;
      resolve(code);
    };
    let request: IDBOpenDBRequest;
    try {
      request = input.environment.indexedDB.open(
        input.databaseName,
        CORE_DB_CANONICAL_NATIVE_VERSION
      );
    } catch {
      finish('RECOVERY_TARGET_OPEN_FAILED');
      return;
    }
    request.onblocked = () => {
      blocked = true;
      finish('RECOVERY_TARGET_OPEN_BLOCKED');
    };
    request.onerror = () => finish('RECOVERY_TARGET_OPEN_FAILED');
    request.onupgradeneeded = (event) => {
      const transaction = request.transaction;
      if (
        transaction === null ||
        blocked ||
        event.oldVersion !== 0 ||
        event.newVersion !== CORE_DB_CANONICAL_NATIVE_VERSION
      ) {
        transaction?.abort();
        return;
      }
      creationStarted = true;
      try {
        createCoreDbV2Schema(request.result);
      } catch {
        transaction.abort();
      }
    };
    request.onsuccess = () => {
      request.result.close();
      finish(creationStarted ? null : 'RECOVERY_TARGET_VERSION_MISMATCH');
    };
  });
}

async function validateCreatedCoreDb(
  input: RecoverMissingYamlStorageCoreDbInput
): Promise<YamlStorageCorrectiveRecoveryErrorCode | null> {
  const opened = await openCoreDbAtExactVersion(
    input.environment.indexedDB,
    input.databaseName,
    CORE_DB_CANONICAL_NATIVE_VERSION
  );
  if (opened.ok === false) return 'RECOVERY_CANONICAL_VALIDATION_FAILED';
  try {
    const validation = await validateCanonicalYamlStorageCoreDb(
      opened.database,
      input.environment.digestSha256Hex
    );
    return validation.ok ? null : 'RECOVERY_CANONICAL_VALIDATION_FAILED';
  } catch {
    return 'RECOVERY_CANONICAL_VALIDATION_FAILED';
  } finally {
    opened.database.close();
  }
}

async function markRecoveryCompleted(
  input: RecoverMissingYamlStorageCoreDbInput
): Promise<boolean> {
  const database = input.recoveryDatabase;
  if (!hasExactRecoverySchema(database)) return false;
  const expectedClaimed = createExpectedClaimRecord(input, 'claimed');
  const completed = createExpectedClaimRecord(input, 'completed');
  return await new Promise((resolve) => {
    let settled = false;
    let writeIssued = false;
    const finish = (value: boolean): void => {
      if (settled) return;
      settled = true;
      resolve(value);
    };
    let transaction: IDBTransaction;
    let request: IDBRequest<unknown>;
    try {
      transaction = database.transaction(RECOVERY_STORE_NAME, 'readwrite');
      const store = transaction.objectStore(RECOVERY_STORE_NAME);
      request = store.get(input.recoveryReleaseId);
      request.onsuccess = () => {
        if (!claimRecordMatches(request.result, expectedClaimed)) {
          transaction.abort();
          return;
        }
        try {
          store.put(completed);
          writeIssued = true;
        } catch {
          transaction.abort();
        }
      };
    } catch {
      finish(false);
      return;
    }
    request.onerror = () => finish(false);
    transaction.onerror = () => finish(false);
    transaction.onabort = () => finish(false);
    transaction.oncomplete = () => finish(writeIssued);
  });
}

/** Creates canonical CoreDB only after an exact, durable corrective-recovery claim. */
export async function recoverMissingYamlStorageCoreDb(
  input: RecoverMissingYamlStorageCoreDbInput
): Promise<RecoverMissingYamlStorageCoreDbResult> {
  try {
    if (!isValidInput(input)) return failedResult('INVALID_RECOVERY_INPUT');
    if (!hasExactRecoverySchema(input.recoveryDatabase)) {
      return failedResult('RECOVERY_CLAIM_SCHEMA_MISMATCH');
    }
    const rawClaim = await readClaimRecord(input.recoveryDatabase, input.recoveryReleaseId);
    if (rawClaim === null) return failedResult('RECOVERY_CLAIM_READ_FAILED');
    if (!claimRecordMatches(rawClaim, createExpectedClaimRecord(input, 'claimed'))) {
      return failedResult('RECOVERY_CLAIM_MISMATCH');
    }
    const targetError = await createTargetCoreDb(input);
    if (targetError !== null) return failedResult(targetError);
    try {
      await input.environment.initializeCoreDb();
    } catch {
      return failedResult('RECOVERY_CORE_DB_INITIALIZATION_FAILED');
    }
    const validationError = await validateCreatedCoreDb(input);
    if (validationError !== null) return failedResult(validationError);
    if (!(await markRecoveryCompleted(input))) {
      return failedResult('RECOVERY_COMPLETION_WRITE_FAILED');
    }
    return Object.freeze({ ok: true });
  } finally {
    input.recoveryDatabase.close();
  }
}
