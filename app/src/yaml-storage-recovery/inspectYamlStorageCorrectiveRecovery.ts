import {
  CORE_DB_CANONICAL_LOGICAL_VERSION,
  CORE_DB_CANONICAL_NATIVE_VERSION,
  validateCanonicalYamlStorageCoreDb,
  validateCoreDbV2StoreTopology,
} from '@hierarchidb/runtime-worker/yaml-storage-production';
import {
  encodeCoordinatorReadyStateFingerprint,
  encodeYamlDatabaseSnapshot,
  parseCoordinatorReadyStateEvidence,
  validateCoordinatorDatabaseSchema,
  validateCoreDatabaseSchema,
  validateYamlDatabaseSchema,
} from '../yaml-storage-preflight/yamlStorageProductionPreflightValidators.js';
import { isExactYamlStorageCorrectiveRecoveryDatabaseNames } from './isExactYamlStorageCorrectiveRecoveryDatabaseNames.js';
import type {
  InspectYamlStorageCorrectiveRecoveryInput,
  InspectYamlStorageCorrectiveRecoveryPrivateResult,
  YamlStorageCorrectiveRecoveryInspectionCode,
  YamlStorageCorrectiveRecoveryInspectionResult,
  YamlStorageCorrectiveRecoveryInspectionStage,
} from './yamlStorageCorrectiveRecoveryTypes.js';

const SOURCE_SHA_PATTERN = /^[0-9a-f]{40}$/u;
const SHA256_PATTERN = /^[0-9a-f]{64}$/u;
const RECOVERY_RELEASE_ID = 'incident-1388-v1' as const;
const RECOVERY_DATABASE_VERSION = 1;
const RECOVERY_STORE_NAME = 'recovery-state';

type RejectionCode = Exclude<
  YamlStorageCorrectiveRecoveryInspectionCode,
  'RECOVERY_INVENTORY_ACCEPTED'
>;

type OpenExactResult =
  | Readonly<{ readonly ok: true; readonly database: IDBDatabase }>
  | Readonly<{ readonly ok: false; readonly reason: 'open' | 'blocked' | 'upgrade' }>;

type YamlSummary =
  | Readonly<{
      readonly status: 'missing';
      readonly rowCount: null;
      readonly digestSha256: null;
    }>
  | Readonly<{
      readonly status: 'exact-v1';
      readonly rowCount: number;
      readonly digestSha256: string;
    }>;

type ClaimSummary = Readonly<{
  readonly phase: 'claimed' | 'completed';
  readonly coordinatorFingerprintSha256: string;
  readonly recoveryReleaseId: string;
  readonly recoveryReleaseVersion: string;
  readonly openRequestId: string;
  readonly interruptedCoreDatabaseStatus: 'missing' | 'empty-native-v2';
  readonly yamlDatabaseStatus: 'missing' | 'exact-v1';
  readonly yamlRowCount: number | null;
  readonly yamlDigestSha256: string | null;
}>;

type OwnDataProperty =
  | Readonly<{ readonly found: false }>
  | Readonly<{ readonly found: true; readonly value: unknown }>;

function rejected(
  stage: YamlStorageCorrectiveRecoveryInspectionStage,
  code: RejectionCode,
  context?: Readonly<{ readonly timestamp: string; readonly releaseVersion: string }>
): InspectYamlStorageCorrectiveRecoveryPrivateResult {
  const publicResult: Extract<
    YamlStorageCorrectiveRecoveryInspectionResult,
    { readonly status: 'rejected' }
  > =
    context === undefined
      ? Object.freeze({ mode: stage, status: 'rejected', code })
      : Object.freeze({ mode: stage, status: 'rejected', code, ...context });
  return Object.freeze({ ok: false, publicResult });
}

function hasExactTimestamp(value: string): boolean {
  try {
    return new Date(value).toISOString() === value;
  } catch {
    return false;
  }
}

function inputIsValid(input: InspectYamlStorageCorrectiveRecoveryInput): boolean {
  return (
    isExactYamlStorageCorrectiveRecoveryDatabaseNames(input.databaseNames) &&
    SOURCE_SHA_PATTERN.test(input.releaseVersion) &&
    hasExactTimestamp(input.timestamp) &&
    typeof input.factory.open === 'function' &&
    typeof input.digestSha256Hex === 'function'
  );
}

function catalogMatches(
  catalog: readonly IDBDatabaseInfo[],
  databaseName: string,
  expectedVersion: number
): boolean {
  const matches = catalog.filter((entry) => entry.name === databaseName);
  return matches.length === 1 && matches[0]?.version === expectedVersion;
}

function catalogMissing(catalog: readonly IDBDatabaseInfo[], databaseName: string): boolean {
  return catalog.every((entry) => entry.name !== databaseName);
}

function openExactDatabase(
  factory: IDBFactory,
  databaseName: string,
  expectedVersion: number
): Promise<OpenExactResult> {
  return new Promise((resolve) => {
    let settled = false;
    let unexpectedUpgrade = false;
    const finish = (result: OpenExactResult): void => {
      if (settled) {
        if (result.ok) result.database.close();
        return;
      }
      settled = true;
      resolve(result);
    };
    let request: IDBOpenDBRequest;
    try {
      request = factory.open(databaseName, expectedVersion);
    } catch {
      finish(Object.freeze({ ok: false, reason: 'open' }));
      return;
    }
    request.onupgradeneeded = () => {
      unexpectedUpgrade = true;
      request.transaction?.abort();
    };
    request.onerror = () =>
      finish(Object.freeze({ ok: false, reason: unexpectedUpgrade ? 'upgrade' : 'open' }));
    request.onblocked = () => finish(Object.freeze({ ok: false, reason: 'blocked' }));
    request.onsuccess = () => {
      if (request.result.version !== expectedVersion) {
        request.result.close();
        finish(Object.freeze({ ok: false, reason: 'upgrade' }));
        return;
      }
      finish(Object.freeze({ ok: true, database: request.result }));
    };
  });
}

function readSingleStoreRecord(
  database: IDBDatabase,
  storeName: string
): Promise<
  Readonly<{ readonly ok: true; readonly value: unknown }> | Readonly<{ readonly ok: false }>
> {
  return new Promise((resolve) => {
    let settled = false;
    let values: readonly unknown[] | null = null;
    const finish = (
      result:
        | Readonly<{ readonly ok: true; readonly value: unknown }>
        | Readonly<{ readonly ok: false }>
    ): void => {
      if (settled) return;
      settled = true;
      resolve(result);
    };
    let transaction: IDBTransaction;
    let request: IDBRequest<unknown[]>;
    try {
      transaction = database.transaction(storeName, 'readonly');
      request = transaction.objectStore(storeName).getAll();
    } catch {
      finish(Object.freeze({ ok: false }));
      return;
    }
    request.onerror = () => finish(Object.freeze({ ok: false }));
    request.onsuccess = () => {
      values = request.result;
    };
    transaction.onerror = () => finish(Object.freeze({ ok: false }));
    transaction.onabort = () => finish(Object.freeze({ ok: false }));
    transaction.oncomplete = () => {
      finish(
        values !== null && values.length === 1
          ? Object.freeze({ ok: true, value: values[0] })
          : Object.freeze({ ok: false })
      );
    };
  });
}

function countAllRecords(database: IDBDatabase): Promise<number | null> {
  const storeNames = Array.from(database.objectStoreNames);
  return new Promise((resolve) => {
    let settled = false;
    let completedCounts = 0;
    let total = 0;
    const finish = (value: number | null): void => {
      if (settled) return;
      settled = true;
      resolve(value);
    };
    let transaction: IDBTransaction;
    try {
      transaction = database.transaction(storeNames, 'readonly');
      for (const storeName of storeNames) {
        const request = transaction.objectStore(storeName).count();
        request.onerror = () => finish(null);
        request.onsuccess = () => {
          total += request.result;
          completedCounts += 1;
        };
      }
    } catch {
      finish(null);
      return;
    }
    transaction.onerror = () => finish(null);
    transaction.onabort = () => finish(null);
    transaction.oncomplete = () => finish(completedCounts === storeNames.length ? total : null);
  });
}

function readYamlSnapshot(database: IDBDatabase): Promise<
  | Readonly<{
      readonly ok: true;
      readonly keys: readonly IDBValidKey[];
      readonly rows: readonly unknown[];
    }>
  | Readonly<{ readonly ok: false }>
> {
  return new Promise((resolve) => {
    let settled = false;
    let keys: readonly IDBValidKey[] | null = null;
    let rows: readonly unknown[] | null = null;
    const finish = (
      result:
        | Readonly<{
            readonly ok: true;
            readonly keys: readonly IDBValidKey[];
            readonly rows: readonly unknown[];
          }>
        | Readonly<{ readonly ok: false }>
    ): void => {
      if (settled) return;
      settled = true;
      resolve(result);
    };
    let transaction: IDBTransaction;
    try {
      transaction = database.transaction('nodes', 'readonly');
      const store = transaction.objectStore('nodes');
      const keyRequest = store.getAllKeys();
      const rowRequest = store.getAll();
      keyRequest.onerror = () => finish(Object.freeze({ ok: false }));
      rowRequest.onerror = () => finish(Object.freeze({ ok: false }));
      keyRequest.onsuccess = () => {
        keys = Object.freeze([...keyRequest.result]);
      };
      rowRequest.onsuccess = () => {
        rows = Object.freeze([...rowRequest.result]);
      };
    } catch {
      finish(Object.freeze({ ok: false }));
      return;
    }
    transaction.onerror = () => finish(Object.freeze({ ok: false }));
    transaction.onabort = () => finish(Object.freeze({ ok: false }));
    transaction.oncomplete = () => {
      finish(
        keys !== null && rows !== null && keys.length === rows.length
          ? Object.freeze({ ok: true, keys, rows })
          : Object.freeze({ ok: false })
      );
    };
  });
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

function hasExactOwnDataProperties(value: object, keys: readonly string[]): boolean {
  const ownKeys = Reflect.ownKeys(value);
  return (
    ownKeys.length === keys.length &&
    ownKeys.every((key) => typeof key === 'string' && keys.includes(key)) &&
    keys.every((key) => readOwnDataProperty(value, key).found)
  );
}

function parseClaimRecord(value: unknown): ClaimSummary | null {
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
    return null;
  }
  const read = (key: string): unknown => {
    const property = readOwnDataProperty(value, key);
    return property.found ? property.value : undefined;
  };
  const phase = read('phase');
  const coordinatorFingerprintSha256 = read('coordinatorFingerprintSha256');
  const recoveryReleaseId = read('recoveryReleaseId');
  const recoveryReleaseVersion = read('recoveryReleaseVersion');
  const openRequestId = read('openRequestId');
  const interruptedCoreDatabaseStatus = read('interruptedCoreDatabaseStatus');
  const yamlDatabaseStatus = read('yamlDatabaseStatus');
  const yamlRowCount = read('yamlRowCount');
  const yamlDigestSha256 = read('yamlDigestSha256');
  const yamlSummaryValid =
    (yamlDatabaseStatus === 'missing' && yamlRowCount === null && yamlDigestSha256 === null) ||
    (yamlDatabaseStatus === 'exact-v1' &&
      typeof yamlRowCount === 'number' &&
      Number.isSafeInteger(yamlRowCount) &&
      yamlRowCount >= 0 &&
      typeof yamlDigestSha256 === 'string' &&
      SHA256_PATTERN.test(yamlDigestSha256));
  if (
    read('key') !== recoveryReleaseId ||
    read('protocolVersion') !== 1 ||
    (phase !== 'claimed' && phase !== 'completed') ||
    typeof coordinatorFingerprintSha256 !== 'string' ||
    !SHA256_PATTERN.test(coordinatorFingerprintSha256) ||
    typeof recoveryReleaseId !== 'string' ||
    recoveryReleaseId !== RECOVERY_RELEASE_ID ||
    typeof recoveryReleaseVersion !== 'string' ||
    !SOURCE_SHA_PATTERN.test(recoveryReleaseVersion) ||
    typeof openRequestId !== 'string' ||
    openRequestId.length === 0 ||
    (interruptedCoreDatabaseStatus !== 'missing' &&
      interruptedCoreDatabaseStatus !== 'empty-native-v2') ||
    !yamlSummaryValid
  ) {
    return null;
  }
  return Object.freeze({
    phase,
    coordinatorFingerprintSha256,
    recoveryReleaseId,
    recoveryReleaseVersion,
    openRequestId,
    interruptedCoreDatabaseStatus,
    yamlDatabaseStatus,
    yamlRowCount,
    yamlDigestSha256,
  });
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

function openFailureCode(
  result: Extract<OpenExactResult, { readonly ok: false }>,
  openCode: RejectionCode,
  blockedCode: RejectionCode,
  upgradeCode: RejectionCode
): RejectionCode {
  return result.reason === 'blocked'
    ? blockedCode
    : result.reason === 'upgrade'
      ? upgradeCode
      : openCode;
}

export async function inspectYamlStorageCorrectiveRecoveryPrivate(
  input: InspectYamlStorageCorrectiveRecoveryInput,
  discoveredCatalog?: readonly IDBDatabaseInfo[]
): Promise<InspectYamlStorageCorrectiveRecoveryPrivateResult> {
  if (!inputIsValid(input)) return rejected(input.stage, 'RECOVERY_CONFIGURATION_INVALID');
  const context = Object.freeze({
    timestamp: input.timestamp,
    releaseVersion: input.releaseVersion,
  });
  let coordinatorDatabase: IDBDatabase | null = null;
  let canonicalCoreDatabase: IDBDatabase | null = null;
  let interruptedCoreDatabase: IDBDatabase | null = null;
  let yamlDatabase: IDBDatabase | null = null;
  let recoveryDatabase: IDBDatabase | null = null;
  try {
    let catalog: IDBDatabaseInfo[];
    if (discoveredCatalog === undefined) {
      if (typeof input.factory.databases !== 'function') {
        return rejected(input.stage, 'RECOVERY_DATABASE_DISCOVERY_UNAVAILABLE', context);
      }
      try {
        catalog = await input.factory.databases();
      } catch {
        return rejected(input.stage, 'RECOVERY_DATABASE_DISCOVERY_FAILED', context);
      }
    } else {
      catalog = [...discoveredCatalog];
    }

    if (!catalogMatches(catalog, input.databaseNames.coordinator, 2)) {
      return rejected(input.stage, 'RECOVERY_COORDINATOR_CATALOG_MISMATCH', context);
    }
    const coordinatorOpen = await openExactDatabase(
      input.factory,
      input.databaseNames.coordinator,
      2
    );
    if (coordinatorOpen.ok === false) {
      return rejected(
        input.stage,
        openFailureCode(
          coordinatorOpen,
          'RECOVERY_COORDINATOR_OPEN_FAILED',
          'RECOVERY_COORDINATOR_OPEN_BLOCKED',
          'RECOVERY_COORDINATOR_UNEXPECTED_UPGRADE'
        ),
        context
      );
    }
    coordinatorDatabase = coordinatorOpen.database;
    if (!validateCoordinatorDatabaseSchema(coordinatorDatabase)) {
      return rejected(input.stage, 'RECOVERY_COORDINATOR_SCHEMA_MISMATCH', context);
    }
    const coordinatorRecord = await readSingleStoreRecord(coordinatorDatabase, 'coordinator-state');
    if (coordinatorRecord.ok === false) {
      return rejected(input.stage, 'RECOVERY_COORDINATOR_STATE_READ_FAILED', context);
    }
    const coordinatorEvidence = parseCoordinatorReadyStateEvidence(coordinatorRecord.value);
    if (coordinatorEvidence === null) {
      return rejected(input.stage, 'RECOVERY_COORDINATOR_STATE_MISMATCH', context);
    }
    let coordinatorFingerprintSha256: string;
    try {
      coordinatorFingerprintSha256 = await input.digestSha256Hex(
        encodeCoordinatorReadyStateFingerprint(coordinatorEvidence)
      );
    } catch {
      return rejected(input.stage, 'RECOVERY_COORDINATOR_DIGEST_FAILED', context);
    }
    if (!SHA256_PATTERN.test(coordinatorFingerprintSha256)) {
      return rejected(input.stage, 'RECOVERY_COORDINATOR_DIGEST_FAILED', context);
    }

    const canonicalMissing = catalogMissing(catalog, input.databaseNames.canonicalCore);
    if (input.stage === 'recovery-pre' && !canonicalMissing) {
      return rejected(input.stage, 'RECOVERY_CANONICAL_CORE_MUST_BE_MISSING', context);
    }
    if (input.stage === 'recovery-post') {
      if (
        !catalogMatches(
          catalog,
          input.databaseNames.canonicalCore,
          CORE_DB_CANONICAL_NATIVE_VERSION
        )
      ) {
        return rejected(input.stage, 'RECOVERY_CANONICAL_CORE_CATALOG_MISMATCH', context);
      }
      const canonicalOpen = await openExactDatabase(
        input.factory,
        input.databaseNames.canonicalCore,
        CORE_DB_CANONICAL_NATIVE_VERSION
      );
      if (canonicalOpen.ok === false) {
        return rejected(input.stage, 'RECOVERY_CANONICAL_CORE_OPEN_FAILED', context);
      }
      canonicalCoreDatabase = canonicalOpen.database;
      if (!validateCoreDatabaseSchema(canonicalCoreDatabase, CORE_DB_CANONICAL_LOGICAL_VERSION)) {
        return rejected(input.stage, 'RECOVERY_CANONICAL_CORE_SCHEMA_MISMATCH', context);
      }
      const validation = await validateCanonicalYamlStorageCoreDb(
        canonicalCoreDatabase,
        input.digestSha256Hex
      );
      if (validation.ok === false) {
        return rejected(input.stage, 'RECOVERY_CANONICAL_CORE_VALIDATION_FAILED', context);
      }
    }

    let interruptedCoreDatabaseStatus: 'missing' | 'empty-native-v2';
    if (catalogMissing(catalog, input.databaseNames.interruptedCore)) {
      interruptedCoreDatabaseStatus = 'missing';
    } else {
      if (!catalogMatches(catalog, input.databaseNames.interruptedCore, 2)) {
        return rejected(input.stage, 'RECOVERY_INTERRUPTED_CORE_CATALOG_MISMATCH', context);
      }
      const interruptedOpen = await openExactDatabase(
        input.factory,
        input.databaseNames.interruptedCore,
        2
      );
      if (interruptedOpen.ok === false) {
        return rejected(input.stage, 'RECOVERY_INTERRUPTED_CORE_OPEN_FAILED', context);
      }
      interruptedCoreDatabase = interruptedOpen.database;
      if (!validateCoreDbV2StoreTopology(interruptedCoreDatabase)) {
        return rejected(input.stage, 'RECOVERY_INTERRUPTED_CORE_UNSAFE', context);
      }
      const interruptedRecordCount = await countAllRecords(interruptedCoreDatabase);
      if (interruptedRecordCount !== 0) {
        return rejected(input.stage, 'RECOVERY_INTERRUPTED_CORE_UNSAFE', context);
      }
      interruptedCoreDatabaseStatus = 'empty-native-v2';
    }

    let yamlSummary: YamlSummary;
    if (catalogMissing(catalog, input.databaseNames.yaml)) {
      yamlSummary = Object.freeze({ status: 'missing', rowCount: null, digestSha256: null });
    } else {
      if (!catalogMatches(catalog, input.databaseNames.yaml, 1)) {
        return rejected(input.stage, 'RECOVERY_YAML_CATALOG_MISMATCH', context);
      }
      const yamlOpen = await openExactDatabase(input.factory, input.databaseNames.yaml, 1);
      if (yamlOpen.ok === false) {
        return rejected(input.stage, 'RECOVERY_YAML_OPEN_FAILED', context);
      }
      yamlDatabase = yamlOpen.database;
      if (!validateYamlDatabaseSchema(yamlDatabase)) {
        return rejected(input.stage, 'RECOVERY_YAML_SCHEMA_MISMATCH', context);
      }
      const snapshot = await readYamlSnapshot(yamlDatabase);
      if (snapshot.ok === false) {
        return rejected(input.stage, 'RECOVERY_YAML_SNAPSHOT_READ_FAILED', context);
      }
      let digestSha256: string;
      try {
        digestSha256 = await input.digestSha256Hex(
          encodeYamlDatabaseSnapshot(snapshot.keys, snapshot.rows)
        );
      } catch {
        return rejected(input.stage, 'RECOVERY_YAML_DIGEST_FAILED', context);
      }
      if (!SHA256_PATTERN.test(digestSha256)) {
        return rejected(input.stage, 'RECOVERY_YAML_DIGEST_FAILED', context);
      }
      yamlSummary = Object.freeze({
        status: 'exact-v1',
        rowCount: snapshot.rows.length,
        digestSha256,
      });
    }

    let claimSummary: ClaimSummary | null = null;
    if (input.stage === 'recovery-pre') {
      if (!catalogMissing(catalog, input.databaseNames.recovery)) {
        return rejected(input.stage, 'RECOVERY_CLAIM_MUST_BE_MISSING', context);
      }
    } else {
      if (!catalogMatches(catalog, input.databaseNames.recovery, RECOVERY_DATABASE_VERSION)) {
        return rejected(input.stage, 'RECOVERY_CLAIM_CATALOG_MISMATCH', context);
      }
      const recoveryOpen = await openExactDatabase(
        input.factory,
        input.databaseNames.recovery,
        RECOVERY_DATABASE_VERSION
      );
      if (recoveryOpen.ok === false) {
        return rejected(input.stage, 'RECOVERY_CLAIM_OPEN_FAILED', context);
      }
      recoveryDatabase = recoveryOpen.database;
      if (!hasExactRecoverySchema(recoveryDatabase)) {
        return rejected(input.stage, 'RECOVERY_CLAIM_SCHEMA_MISMATCH', context);
      }
      const rawClaim = await readSingleStoreRecord(recoveryDatabase, RECOVERY_STORE_NAME);
      if (rawClaim.ok === false) {
        return rejected(input.stage, 'RECOVERY_CLAIM_READ_FAILED', context);
      }
      claimSummary = parseClaimRecord(rawClaim.value);
      if (claimSummary === null || claimSummary.phase !== 'completed') {
        return rejected(input.stage, 'RECOVERY_CLAIM_MISMATCH', context);
      }
      if (
        claimSummary.coordinatorFingerprintSha256 !== coordinatorFingerprintSha256 ||
        claimSummary.recoveryReleaseVersion !== input.releaseVersion ||
        claimSummary.interruptedCoreDatabaseStatus !== interruptedCoreDatabaseStatus ||
        claimSummary.yamlDatabaseStatus !== yamlSummary.status ||
        claimSummary.yamlRowCount !== yamlSummary.rowCount ||
        claimSummary.yamlDigestSha256 !== yamlSummary.digestSha256
      ) {
        return rejected(input.stage, 'RECOVERY_BASELINE_MISMATCH', context);
      }
    }

    const recoveryClaim =
      input.stage === 'recovery-pre'
        ? Object.freeze({ status: 'missing' as const })
        : claimSummary === null
          ? null
          : Object.freeze({
              status: 'completed' as const,
              protocolVersion: 1 as const,
              recoveryReleaseId: claimSummary.recoveryReleaseId,
            });
    if (recoveryClaim === null) {
      return rejected(input.stage, 'RECOVERY_CLAIM_MISMATCH', context);
    }

    const acceptedPublicResult: Extract<
      YamlStorageCorrectiveRecoveryInspectionResult,
      { readonly status: 'accepted' }
    > = Object.freeze({
      mode: input.stage,
      status: 'accepted',
      code: 'RECOVERY_INVENTORY_ACCEPTED',
      ...context,
      coordinator: Object.freeze({
        databaseVersion: 2,
        protocolVersion: 2,
        phase: 'revoked',
        stateStatus: 'ready-for-preflight',
        participantCount: coordinatorEvidence.participants.length,
        evidenceCount: coordinatorEvidence.evidence.length,
        fingerprintSha256: coordinatorFingerprintSha256,
      }),
      canonicalCoreDb: Object.freeze(
        input.stage === 'recovery-pre'
          ? { status: 'missing' as const }
          : {
              status: 'exact-v2' as const,
              logicalVersion: CORE_DB_CANONICAL_LOGICAL_VERSION,
              nativeVersion: CORE_DB_CANONICAL_NATIVE_VERSION,
              topologyStatus: 'exact' as const,
            }
      ),
      interruptedCoreDb: Object.freeze({ status: interruptedCoreDatabaseStatus }),
      yamlDb: Object.freeze(
        yamlSummary.status === 'missing'
          ? { status: 'missing' as const }
          : {
              status: 'exact-v1' as const,
              databaseVersion: 1 as const,
              topologyStatus: 'exact' as const,
              rowCount: yamlSummary.rowCount,
              digestSha256: yamlSummary.digestSha256,
            }
      ),
      recoveryClaim,
    });
    return Object.freeze({
      ok: true,
      publicResult: acceptedPublicResult,
      evidence: Object.freeze({
        coordinatorFingerprintSha256,
        interruptedCoreDatabaseStatus,
        yamlDatabaseStatus: yamlSummary.status,
        yamlRowCount: yamlSummary.rowCount,
        yamlDigestSha256: yamlSummary.digestSha256,
      }),
    });
  } catch {
    return rejected(input.stage, 'RECOVERY_INTERNAL_FAILED', context);
  } finally {
    recoveryDatabase?.close();
    yamlDatabase?.close();
    interruptedCoreDatabase?.close();
    canonicalCoreDatabase?.close();
    coordinatorDatabase?.close();
  }
}

export async function inspectYamlStorageCorrectiveRecovery(
  input: InspectYamlStorageCorrectiveRecoveryInput
): Promise<YamlStorageCorrectiveRecoveryInspectionResult> {
  const result = await inspectYamlStorageCorrectiveRecoveryPrivate(input);
  return result.publicResult;
}
