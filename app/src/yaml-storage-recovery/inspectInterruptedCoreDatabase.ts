import { validateCoreDbV2StoreTopology } from '@hierarchidb/runtime-worker/yaml-storage-production';

const INTERRUPTED_CORE_DATABASE_NAME = 'hidb-core' as const;
const SOURCE_SHA_PATTERN = /^[0-9a-f]{40}$/u;

export interface InspectInterruptedCoreDatabaseInput {
  readonly factory: IDBFactory;
  readonly releaseVersion: string;
  readonly timestamp: string;
}

export type InterruptedCoreDatabaseInspectionCode =
  | 'INTERRUPTED_CORE_DIAGNOSTIC_ACCEPTED'
  | 'INTERRUPTED_CORE_DIAGNOSTIC_CONFIGURATION_INVALID'
  | 'INTERRUPTED_CORE_DIAGNOSTIC_DISCOVERY_UNAVAILABLE'
  | 'INTERRUPTED_CORE_DIAGNOSTIC_DISCOVERY_FAILED'
  | 'INTERRUPTED_CORE_DIAGNOSTIC_DATABASE_MISSING'
  | 'INTERRUPTED_CORE_DIAGNOSTIC_CATALOG_MISMATCH'
  | 'INTERRUPTED_CORE_DIAGNOSTIC_OPEN_FAILED'
  | 'INTERRUPTED_CORE_DIAGNOSTIC_OPEN_BLOCKED'
  | 'INTERRUPTED_CORE_DIAGNOSTIC_UNEXPECTED_UPGRADE'
  | 'INTERRUPTED_CORE_DIAGNOSTIC_TOPOLOGY_MISMATCH'
  | 'INTERRUPTED_CORE_DIAGNOSTIC_COUNT_FAILED'
  | 'INTERRUPTED_CORE_DIAGNOSTIC_INTERNAL_FAILED';

type InterruptedCoreDatabaseSummary = Readonly<{
  readonly nativeVersion: number;
  readonly topologyStatus: 'exact-logical-v2' | 'mismatch';
  readonly recordCount: number | null;
}>;

export type InterruptedCoreDatabaseInspectionResult =
  | Readonly<{
      readonly mode: 'recovery-interrupted-core';
      readonly status: 'accepted';
      readonly code: 'INTERRUPTED_CORE_DIAGNOSTIC_ACCEPTED';
      readonly timestamp: string;
      readonly releaseVersion: string;
      readonly interruptedCoreDb: Readonly<{
        readonly nativeVersion: number;
        readonly topologyStatus: 'exact-logical-v2';
        readonly recordCount: number;
      }>;
    }>
  | Readonly<{
      readonly mode: 'recovery-interrupted-core';
      readonly status: 'rejected';
      readonly code: Exclude<
        InterruptedCoreDatabaseInspectionCode,
        'INTERRUPTED_CORE_DIAGNOSTIC_ACCEPTED'
      >;
      readonly timestamp?: string;
      readonly releaseVersion?: string;
      readonly interruptedCoreDb?: InterruptedCoreDatabaseSummary;
    }>;

type OpenExactResult =
  | Readonly<{ readonly ok: true; readonly database: IDBDatabase }>
  | Readonly<{ readonly ok: false; readonly reason: 'open' | 'blocked' | 'upgrade' }>;

function hasExactTimestamp(value: string): boolean {
  try {
    return new Date(value).toISOString() === value;
  } catch {
    return false;
  }
}

function inputIsValid(input: InspectInterruptedCoreDatabaseInput): boolean {
  return (
    SOURCE_SHA_PATTERN.test(input.releaseVersion) &&
    hasExactTimestamp(input.timestamp) &&
    typeof input.factory.open === 'function'
  );
}

function rejected(
  code: Exclude<InterruptedCoreDatabaseInspectionCode, 'INTERRUPTED_CORE_DIAGNOSTIC_ACCEPTED'>,
  context?: Readonly<{ readonly timestamp: string; readonly releaseVersion: string }>,
  interruptedCoreDb?: InterruptedCoreDatabaseSummary
): InterruptedCoreDatabaseInspectionResult {
  return Object.freeze({
    mode: 'recovery-interrupted-core',
    status: 'rejected',
    code,
    ...(context === undefined ? {} : context),
    ...(interruptedCoreDb === undefined ? {} : { interruptedCoreDb }),
  });
}

function openExactDatabase(factory: IDBFactory, nativeVersion: number): Promise<OpenExactResult> {
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
      request = factory.open(INTERRUPTED_CORE_DATABASE_NAME, nativeVersion);
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
      if (request.result.version !== nativeVersion) {
        request.result.close();
        finish(Object.freeze({ ok: false, reason: 'upgrade' }));
        return;
      }
      finish(Object.freeze({ ok: true, database: request.result }));
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
    transaction.oncomplete = () =>
      finish(completedCounts === storeNames.length && Number.isSafeInteger(total) ? total : null);
  });
}

/** Inspects only the fixed interrupted CoreDB name without authorizing recovery. */
export async function inspectInterruptedCoreDatabase(
  input: InspectInterruptedCoreDatabaseInput
): Promise<InterruptedCoreDatabaseInspectionResult> {
  try {
    if (!inputIsValid(input)) {
      return rejected('INTERRUPTED_CORE_DIAGNOSTIC_CONFIGURATION_INVALID');
    }
    const context = Object.freeze({
      timestamp: input.timestamp,
      releaseVersion: input.releaseVersion,
    });
    if (typeof input.factory.databases !== 'function') {
      return rejected('INTERRUPTED_CORE_DIAGNOSTIC_DISCOVERY_UNAVAILABLE', context);
    }
    let catalog: IDBDatabaseInfo[];
    try {
      catalog = await input.factory.databases();
    } catch {
      return rejected('INTERRUPTED_CORE_DIAGNOSTIC_DISCOVERY_FAILED', context);
    }
    const matches = catalog.filter((entry) => entry.name === INTERRUPTED_CORE_DATABASE_NAME);
    if (matches.length === 0) {
      return rejected('INTERRUPTED_CORE_DIAGNOSTIC_DATABASE_MISSING', context);
    }
    const nativeVersion = matches[0]?.version;
    if (
      matches.length !== 1 ||
      typeof nativeVersion !== 'number' ||
      !Number.isSafeInteger(nativeVersion) ||
      nativeVersion <= 0
    ) {
      return rejected('INTERRUPTED_CORE_DIAGNOSTIC_CATALOG_MISMATCH', context);
    }
    const opened = await openExactDatabase(input.factory, nativeVersion);
    if (opened.ok === false) {
      const code =
        opened.reason === 'blocked'
          ? 'INTERRUPTED_CORE_DIAGNOSTIC_OPEN_BLOCKED'
          : opened.reason === 'upgrade'
            ? 'INTERRUPTED_CORE_DIAGNOSTIC_UNEXPECTED_UPGRADE'
            : 'INTERRUPTED_CORE_DIAGNOSTIC_OPEN_FAILED';
      return rejected(code, context);
    }
    try {
      if (!validateCoreDbV2StoreTopology(opened.database)) {
        return rejected(
          'INTERRUPTED_CORE_DIAGNOSTIC_TOPOLOGY_MISMATCH',
          context,
          Object.freeze({ nativeVersion, topologyStatus: 'mismatch', recordCount: null })
        );
      }
      const recordCount = await countAllRecords(opened.database);
      if (recordCount === null) {
        return rejected(
          'INTERRUPTED_CORE_DIAGNOSTIC_COUNT_FAILED',
          context,
          Object.freeze({
            nativeVersion,
            topologyStatus: 'exact-logical-v2',
            recordCount: null,
          })
        );
      }
      return Object.freeze({
        mode: 'recovery-interrupted-core',
        status: 'accepted',
        code: 'INTERRUPTED_CORE_DIAGNOSTIC_ACCEPTED',
        ...context,
        interruptedCoreDb: Object.freeze({
          nativeVersion,
          topologyStatus: 'exact-logical-v2',
          recordCount,
        }),
      });
    } finally {
      opened.database.close();
    }
  } catch {
    return rejected('INTERRUPTED_CORE_DIAGNOSTIC_INTERNAL_FAILED');
  }
}
