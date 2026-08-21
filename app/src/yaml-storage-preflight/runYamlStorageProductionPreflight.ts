import {
  type CoordinatorStateSummary,
  encodeYamlDatabaseSnapshot,
  parseCoordinatorState,
  validateCoordinatorDatabaseSchema,
  validateCoreDatabaseSchema,
  validateYamlDatabaseSchema,
} from './yamlStorageProductionPreflightValidators.js';

export type YamlStorageProductionPreflightMode = 'pre' | 'post';

export type YamlStorageProductionPreflightCode =
  | 'PREFLIGHT_ACCEPTED'
  | 'CONFIGURATION_INVALID'
  | 'DATABASE_DISCOVERY_UNAVAILABLE'
  | 'DATABASE_DISCOVERY_FAILED'
  | 'COORDINATOR_DATABASE_NOT_FOUND'
  | 'COORDINATOR_DATABASE_VERSION_MISMATCH'
  | 'CORE_DATABASE_NOT_FOUND'
  | 'CORE_DATABASE_VERSION_MISMATCH'
  | 'YAML_DATABASE_NOT_FOUND'
  | 'YAML_DATABASE_VERSION_MISMATCH'
  | 'COORDINATOR_DATABASE_OPEN_FAILED'
  | 'COORDINATOR_DATABASE_OPEN_BLOCKED'
  | 'COORDINATOR_DATABASE_UNEXPECTED_UPGRADE'
  | 'COORDINATOR_SCHEMA_MISMATCH'
  | 'COORDINATOR_STATE_READ_FAILED'
  | 'COORDINATOR_STATE_MISMATCH'
  | 'CORE_DATABASE_OPEN_FAILED'
  | 'CORE_DATABASE_OPEN_BLOCKED'
  | 'CORE_DATABASE_UNEXPECTED_UPGRADE'
  | 'CORE_SCHEMA_MISMATCH'
  | 'CORE_JOURNAL_READ_FAILED'
  | 'YAML_DATABASE_OPEN_FAILED'
  | 'YAML_DATABASE_OPEN_BLOCKED'
  | 'YAML_DATABASE_UNEXPECTED_UPGRADE'
  | 'YAML_SCHEMA_MISMATCH'
  | 'YAML_SNAPSHOT_READ_FAILED'
  | 'YAML_DIGEST_FAILED'
  | 'PREFLIGHT_INTERNAL_FAILED'
  | 'PREFLIGHT_UI_EXECUTION_FAILED'
  | 'PREFLIGHT_MODE_INVALID';

interface PublicContext {
  readonly timestamp: string;
  readonly releaseVersion: string;
}

export type YamlStorageProductionPreflightResult =
  | Readonly<{
      readonly mode: YamlStorageProductionPreflightMode;
      readonly status: 'accepted';
      readonly code: 'PREFLIGHT_ACCEPTED';
      readonly timestamp: string;
      readonly releaseVersion: string;
      readonly coordinator: Readonly<{
        readonly databaseVersion: 2;
        readonly protocolVersion: 2;
        readonly phase: 'allowed' | 'revoked';
        readonly stateStatus?: 'ready-for-preflight';
        readonly topologyStatus: 'exact';
        readonly participantCount: number;
        readonly evidenceCount: number;
      }>;
      readonly coreDb: Readonly<{
        readonly databaseVersion: 1 | 2;
        readonly topologyStatus: 'exact';
        readonly journalTopologyStatus: 'absent' | 'exact';
        readonly journalRecordCount?: number;
      }>;
      readonly yamlDb: Readonly<{
        readonly databaseVersion: 1;
        readonly topologyStatus: 'exact';
        readonly rowCount: number;
        readonly digestSha256: string;
      }>;
    }>
  | Readonly<{
      readonly mode: YamlStorageProductionPreflightMode;
      readonly status: 'rejected';
      readonly code: Exclude<YamlStorageProductionPreflightCode, 'PREFLIGHT_ACCEPTED'>;
      readonly timestamp?: string;
      readonly releaseVersion?: string;
    }>;

export interface RunYamlStorageProductionPreflightInput {
  readonly mode: YamlStorageProductionPreflightMode;
  readonly factory: IDBFactory;
  readonly databasePrefix: string;
  readonly releaseVersion: string;
  readonly timestamp: string;
  readonly digestSha256Hex: (bytes: Uint8Array) => Promise<string>;
}

type RejectionCode = Exclude<YamlStorageProductionPreflightCode, 'PREFLIGHT_ACCEPTED'>;

type OpenDatabaseResult =
  | Readonly<{ readonly ok: true; readonly database: IDBDatabase }>
  | Readonly<{ readonly ok: false; readonly code: RejectionCode }>;

type ReadCoordinatorResult =
  | Readonly<{ readonly ok: true; readonly summary: CoordinatorStateSummary }>
  | Readonly<{ readonly ok: false; readonly code: RejectionCode }>;

type ReadYamlSnapshotResult =
  | Readonly<{
      readonly ok: true;
      readonly keys: readonly IDBValidKey[];
      readonly rows: readonly unknown[];
    }>
  | Readonly<{ readonly ok: false; readonly code: RejectionCode }>;

const RELEASE_VERSION_PATTERN = /^[0-9a-f]{40}$/u;
const DATABASE_PREFIX_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/u;
const SHA256_PATTERN = /^[0-9a-f]{64}$/u;

function hasExactTimestamp(value: string): boolean {
  try {
    return new Date(value).toISOString() === value;
  } catch {
    return false;
  }
}

function rejected(
  mode: YamlStorageProductionPreflightMode,
  code: RejectionCode,
  context?: PublicContext
): YamlStorageProductionPreflightResult {
  return context === undefined
    ? Object.freeze({ mode, status: 'rejected', code })
    : Object.freeze({ mode, status: 'rejected', code, ...context });
}

function catalogFailureCode(
  entries: readonly IDBDatabaseInfo[],
  databaseName: string,
  expectedVersion: number,
  missingCode: RejectionCode,
  versionCode: RejectionCode
): RejectionCode | null {
  const matches = entries.filter((entry) => entry.name === databaseName);
  if (matches.length === 0) return missingCode;
  return matches.length === 1 && matches[0]?.version === expectedVersion ? null : versionCode;
}

async function discoverDatabases(
  factory: IDBFactory
): Promise<
  | Readonly<{ readonly ok: true; readonly entries: readonly IDBDatabaseInfo[] }>
  | Readonly<{ readonly ok: false; readonly code: RejectionCode }>
> {
  if (typeof factory.databases !== 'function') {
    return Object.freeze({ ok: false, code: 'DATABASE_DISCOVERY_UNAVAILABLE' });
  }
  try {
    return Object.freeze({ ok: true, entries: await factory.databases() });
  } catch {
    return Object.freeze({ ok: false, code: 'DATABASE_DISCOVERY_FAILED' });
  }
}

function openExactDatabase(
  factory: IDBFactory,
  databaseName: string,
  expectedVersion: number,
  codes: Readonly<{
    readonly open: RejectionCode;
    readonly blocked: RejectionCode;
    readonly upgrade: RejectionCode;
  }>
): Promise<OpenDatabaseResult> {
  return new Promise((resolve) => {
    let settled = false;
    let unexpectedUpgrade = false;
    const finish = (result: OpenDatabaseResult): void => {
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
      finish(Object.freeze({ ok: false, code: codes.open }));
      return;
    }
    request.onupgradeneeded = () => {
      unexpectedUpgrade = true;
      request.transaction?.abort();
    };
    request.onerror = () => {
      finish(Object.freeze({ ok: false, code: unexpectedUpgrade ? codes.upgrade : codes.open }));
    };
    request.onblocked = () => finish(Object.freeze({ ok: false, code: codes.blocked }));
    request.onsuccess = () => {
      if (request.result.version !== expectedVersion) {
        request.result.close();
        finish(Object.freeze({ ok: false, code: codes.upgrade }));
        return;
      }
      finish(Object.freeze({ ok: true, database: request.result }));
    };
  });
}

function readCoordinatorState(
  database: IDBDatabase,
  expectedPhase: 'allowed' | 'revoked'
): Promise<ReadCoordinatorResult> {
  if (!validateCoordinatorDatabaseSchema(database)) {
    return Promise.resolve(Object.freeze({ ok: false, code: 'COORDINATOR_SCHEMA_MISMATCH' }));
  }
  return new Promise((resolve) => {
    let rawState: unknown = null;
    let settled = false;
    const finish = (result: ReadCoordinatorResult): void => {
      if (settled) return;
      settled = true;
      resolve(result);
    };
    let transaction: IDBTransaction;
    let request: IDBRequest<unknown[]>;
    try {
      transaction = database.transaction('coordinator-state', 'readonly');
      request = transaction.objectStore('coordinator-state').getAll();
    } catch {
      finish(Object.freeze({ ok: false, code: 'COORDINATOR_STATE_READ_FAILED' }));
      return;
    }
    request.onerror = () => {
      finish(Object.freeze({ ok: false, code: 'COORDINATOR_STATE_READ_FAILED' }));
    };
    request.onsuccess = () => {
      rawState = request.result.length === 1 ? request.result[0] : null;
    };
    transaction.onerror = () => {
      finish(Object.freeze({ ok: false, code: 'COORDINATOR_STATE_READ_FAILED' }));
    };
    transaction.onabort = () => {
      finish(Object.freeze({ ok: false, code: 'COORDINATOR_STATE_READ_FAILED' }));
    };
    transaction.oncomplete = () => {
      const summary = parseCoordinatorState(rawState, expectedPhase);
      finish(
        summary === null
          ? Object.freeze({ ok: false, code: 'COORDINATOR_STATE_MISMATCH' })
          : Object.freeze({ ok: true, summary })
      );
    };
  });
}

function countJournalRecords(database: IDBDatabase): Promise<number | null> {
  return new Promise((resolve) => {
    let count: number | null = null;
    let settled = false;
    const finish = (result: number | null): void => {
      if (settled) return;
      settled = true;
      resolve(result);
    };
    let transaction: IDBTransaction;
    let request: IDBRequest<number>;
    try {
      transaction = database.transaction('yamlMigrationJournal', 'readonly');
      request = transaction.objectStore('yamlMigrationJournal').count();
    } catch {
      finish(null);
      return;
    }
    request.onerror = () => finish(null);
    request.onsuccess = () => {
      count = request.result;
    };
    transaction.onerror = () => finish(null);
    transaction.onabort = () => finish(null);
    transaction.oncomplete = () => finish(count);
  });
}

function readYamlSnapshot(database: IDBDatabase): Promise<ReadYamlSnapshotResult> {
  if (!validateYamlDatabaseSchema(database)) {
    return Promise.resolve(Object.freeze({ ok: false, code: 'YAML_SCHEMA_MISMATCH' }));
  }
  return new Promise((resolve) => {
    let keys: readonly IDBValidKey[] | null = null;
    let rows: readonly unknown[] | null = null;
    let settled = false;
    const finish = (result: ReadYamlSnapshotResult): void => {
      if (settled) return;
      settled = true;
      resolve(result);
    };
    let transaction: IDBTransaction;
    let keysRequest: IDBRequest<IDBValidKey[]>;
    let rowsRequest: IDBRequest<unknown[]>;
    try {
      transaction = database.transaction('nodes', 'readonly');
      const store = transaction.objectStore('nodes');
      keysRequest = store.getAllKeys();
      rowsRequest = store.getAll();
    } catch {
      finish(Object.freeze({ ok: false, code: 'YAML_SNAPSHOT_READ_FAILED' }));
      return;
    }
    keysRequest.onerror = () => {
      finish(Object.freeze({ ok: false, code: 'YAML_SNAPSHOT_READ_FAILED' }));
    };
    keysRequest.onsuccess = () => {
      keys = Object.freeze([...keysRequest.result]);
    };
    rowsRequest.onerror = () => {
      finish(Object.freeze({ ok: false, code: 'YAML_SNAPSHOT_READ_FAILED' }));
    };
    rowsRequest.onsuccess = () => {
      rows = Object.freeze([...rowsRequest.result]);
    };
    transaction.onerror = () => {
      finish(Object.freeze({ ok: false, code: 'YAML_SNAPSHOT_READ_FAILED' }));
    };
    transaction.onabort = () => {
      finish(Object.freeze({ ok: false, code: 'YAML_SNAPSHOT_READ_FAILED' }));
    };
    transaction.oncomplete = () => {
      finish(
        keys === null || rows === null || keys.length !== rows.length
          ? Object.freeze({ ok: false, code: 'YAML_SNAPSHOT_READ_FAILED' })
          : Object.freeze({ ok: true, keys, rows })
      );
    };
  });
}

export async function runYamlStorageProductionPreflight(
  input: RunYamlStorageProductionPreflightInput
): Promise<YamlStorageProductionPreflightResult> {
  if (
    !DATABASE_PREFIX_PATTERN.test(input.databasePrefix) ||
    !RELEASE_VERSION_PATTERN.test(input.releaseVersion) ||
    !hasExactTimestamp(input.timestamp)
  ) {
    return rejected(input.mode, 'CONFIGURATION_INVALID');
  }
  const context = Object.freeze({
    timestamp: input.timestamp,
    releaseVersion: input.releaseVersion,
  });
  const coordinatorDatabaseName = `${input.databasePrefix}-origin-coordinator`;
  const coreDatabaseName = `${input.databasePrefix}-core`;
  const yamlDatabaseName = `${input.databasePrefix}-yaml`;
  const coreVersion = input.mode === 'pre' ? 1 : 2;
  let coordinatorDatabase: IDBDatabase | null = null;
  let coreDatabase: IDBDatabase | null = null;
  let yamlDatabase: IDBDatabase | null = null;

  try {
    const discovery = await discoverDatabases(input.factory);
    if (!discovery.ok) return rejected(input.mode, discovery.code, context);
    const catalogChecks = [
      catalogFailureCode(
        discovery.entries,
        coordinatorDatabaseName,
        2,
        'COORDINATOR_DATABASE_NOT_FOUND',
        'COORDINATOR_DATABASE_VERSION_MISMATCH'
      ),
      catalogFailureCode(
        discovery.entries,
        coreDatabaseName,
        coreVersion,
        'CORE_DATABASE_NOT_FOUND',
        'CORE_DATABASE_VERSION_MISMATCH'
      ),
      catalogFailureCode(
        discovery.entries,
        yamlDatabaseName,
        1,
        'YAML_DATABASE_NOT_FOUND',
        'YAML_DATABASE_VERSION_MISMATCH'
      ),
    ];
    const catalogFailure = catalogChecks.find((code) => code !== null);
    if (catalogFailure !== undefined && catalogFailure !== null) {
      return rejected(input.mode, catalogFailure, context);
    }

    const coordinatorOpen = await openExactDatabase(input.factory, coordinatorDatabaseName, 2, {
      open: 'COORDINATOR_DATABASE_OPEN_FAILED',
      blocked: 'COORDINATOR_DATABASE_OPEN_BLOCKED',
      upgrade: 'COORDINATOR_DATABASE_UNEXPECTED_UPGRADE',
    });
    if (!coordinatorOpen.ok) return rejected(input.mode, coordinatorOpen.code, context);
    coordinatorDatabase = coordinatorOpen.database;
    const coordinator = await readCoordinatorState(
      coordinatorDatabase,
      input.mode === 'pre' ? 'allowed' : 'revoked'
    );
    if (!coordinator.ok) return rejected(input.mode, coordinator.code, context);

    const coreOpen = await openExactDatabase(input.factory, coreDatabaseName, coreVersion, {
      open: 'CORE_DATABASE_OPEN_FAILED',
      blocked: 'CORE_DATABASE_OPEN_BLOCKED',
      upgrade: 'CORE_DATABASE_UNEXPECTED_UPGRADE',
    });
    if (!coreOpen.ok) return rejected(input.mode, coreOpen.code, context);
    coreDatabase = coreOpen.database;
    if (!validateCoreDatabaseSchema(coreDatabase, coreVersion)) {
      return rejected(input.mode, 'CORE_SCHEMA_MISMATCH', context);
    }
    let coreDbResult:
      | Readonly<{
          readonly databaseVersion: 1;
          readonly topologyStatus: 'exact';
          readonly journalTopologyStatus: 'absent';
        }>
      | Readonly<{
          readonly databaseVersion: 2;
          readonly topologyStatus: 'exact';
          readonly journalTopologyStatus: 'exact';
          readonly journalRecordCount: number;
        }>;
    if (input.mode === 'pre') {
      coreDbResult = Object.freeze({
        databaseVersion: 1,
        topologyStatus: 'exact',
        journalTopologyStatus: 'absent',
      });
    } else {
      const journalRecordCount = await countJournalRecords(coreDatabase);
      if (journalRecordCount === null) {
        return rejected(input.mode, 'CORE_JOURNAL_READ_FAILED', context);
      }
      coreDbResult = Object.freeze({
        databaseVersion: 2,
        topologyStatus: 'exact',
        journalTopologyStatus: 'exact',
        journalRecordCount,
      });
    }

    const yamlOpen = await openExactDatabase(input.factory, yamlDatabaseName, 1, {
      open: 'YAML_DATABASE_OPEN_FAILED',
      blocked: 'YAML_DATABASE_OPEN_BLOCKED',
      upgrade: 'YAML_DATABASE_UNEXPECTED_UPGRADE',
    });
    if (!yamlOpen.ok) return rejected(input.mode, yamlOpen.code, context);
    yamlDatabase = yamlOpen.database;
    const yamlSnapshot = await readYamlSnapshot(yamlDatabase);
    if (!yamlSnapshot.ok) return rejected(input.mode, yamlSnapshot.code, context);
    let digestSha256: string;
    try {
      digestSha256 = await input.digestSha256Hex(
        encodeYamlDatabaseSnapshot(yamlSnapshot.keys, yamlSnapshot.rows)
      );
    } catch {
      return rejected(input.mode, 'YAML_DIGEST_FAILED', context);
    }
    if (!SHA256_PATTERN.test(digestSha256)) {
      return rejected(input.mode, 'YAML_DIGEST_FAILED', context);
    }

    const coordinatorResult = {
      databaseVersion: 2 as const,
      protocolVersion: 2 as const,
      phase: coordinator.summary.phase,
      ...(coordinator.summary.phase === 'revoked'
        ? { stateStatus: coordinator.summary.stateStatus }
        : {}),
      topologyStatus: 'exact' as const,
      participantCount: coordinator.summary.participantCount,
      evidenceCount: coordinator.summary.evidenceCount,
    };
    return Object.freeze({
      mode: input.mode,
      status: 'accepted',
      code: 'PREFLIGHT_ACCEPTED',
      ...context,
      coordinator: Object.freeze(coordinatorResult),
      coreDb: coreDbResult,
      yamlDb: Object.freeze({
        databaseVersion: 1,
        topologyStatus: 'exact',
        rowCount: yamlSnapshot.rows.length,
        digestSha256,
      }),
    });
  } catch {
    return rejected(input.mode, 'PREFLIGHT_INTERNAL_FAILED', context);
  } finally {
    yamlDatabase?.close();
    coreDatabase?.close();
    coordinatorDatabase?.close();
  }
}
