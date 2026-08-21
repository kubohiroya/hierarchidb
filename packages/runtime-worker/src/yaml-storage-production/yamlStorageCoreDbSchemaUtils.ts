import { YAML_MIGRATION_JOURNAL_STORE_NAME } from '../services/CoreDB.js';
import type { YamlStorageCoreDbErrorCode } from './yamlStorageCoreDbTypes.js';
import {
  CORE_DB_CANONICAL_LOGICAL_VERSION,
  CORE_DB_CANONICAL_NATIVE_VERSION,
  CORE_DB_LEGACY_LOGICAL_VERSION,
  CORE_DB_LEGACY_NATIVE_VERSION,
} from './yamlStorageCoreDbVersion.js';

interface IndexSpec {
  readonly name: string;
  readonly keyPath: string | readonly string[];
  readonly unique: boolean;
  readonly multiEntry: boolean;
}

interface StoreSpec {
  readonly name: string;
  readonly keyPath: string | readonly string[];
  readonly indexes: readonly IndexSpec[];
}

const CORE_DB_V1_STORE_SPECS: readonly StoreSpec[] = Object.freeze([
  Object.freeze({
    name: 'trees',
    keyPath: 'id',
    indexes: Object.freeze([
      Object.freeze({ name: 'rootId', keyPath: 'rootId', unique: false, multiEntry: false }),
      Object.freeze({
        name: 'archiveRootId',
        keyPath: 'archiveRootId',
        unique: false,
        multiEntry: false,
      }),
      Object.freeze({
        name: 'superRootId',
        keyPath: 'superRootId',
        unique: false,
        multiEntry: false,
      }),
    ]),
  }),
  Object.freeze({
    name: 'nodes',
    keyPath: 'id',
    indexes: Object.freeze([
      Object.freeze({ name: 'parentId', keyPath: 'parentId', unique: false, multiEntry: false }),
      Object.freeze({
        name: '[parentId+metadata.name]',
        keyPath: Object.freeze(['parentId', 'metadata.name']),
        unique: true,
        multiEntry: false,
      }),
      Object.freeze({
        name: '[parentId+updatedAt]',
        keyPath: Object.freeze(['parentId', 'updatedAt']),
        unique: false,
        multiEntry: false,
      }),
      Object.freeze({ name: 'depth', keyPath: 'depth', unique: false, multiEntry: false }),
      Object.freeze({
        name: 'references',
        keyPath: 'references',
        unique: false,
        multiEntry: true,
      }),
    ]),
  }),
  Object.freeze({ name: 'rootStates', keyPath: 'rootNodeId', indexes: Object.freeze([]) }),
  Object.freeze({
    name: 'tags',
    keyPath: 'id',
    indexes: Object.freeze([
      Object.freeze({ name: 'name', keyPath: 'name', unique: false, multiEntry: false }),
      Object.freeze({
        name: 'createdAt',
        keyPath: 'createdAt',
        unique: false,
        multiEntry: false,
      }),
    ]),
  }),
  Object.freeze({
    name: 'tagAssociations',
    keyPath: 'id',
    indexes: Object.freeze([
      Object.freeze({ name: 'nodeId', keyPath: 'nodeId', unique: false, multiEntry: false }),
      Object.freeze({ name: 'tagId', keyPath: 'tagId', unique: false, multiEntry: false }),
      Object.freeze({ name: 'scope', keyPath: 'scope', unique: false, multiEntry: false }),
      Object.freeze({
        name: 'createdAt',
        keyPath: 'createdAt',
        unique: false,
        multiEntry: false,
      }),
      Object.freeze({
        name: '[nodeId+tagId+scope]',
        keyPath: Object.freeze(['nodeId', 'tagId', 'scope']),
        unique: true,
        multiEntry: false,
      }),
    ]),
  }),
]);

const YAML_MIGRATION_JOURNAL_STORE_SPEC: StoreSpec = Object.freeze({
  name: YAML_MIGRATION_JOURNAL_STORE_NAME,
  keyPath: Object.freeze(['migrationId', 'nodeId', 'slot']),
  indexes: Object.freeze([
    Object.freeze({
      name: '[migrationId+fromCoreDbVersion+toCoreDbVersion]',
      keyPath: Object.freeze(['migrationId', 'fromCoreDbVersion', 'toCoreDbVersion']),
      unique: false,
      multiEntry: false,
    }),
  ]),
});

function keyPathMatches(
  actual: string | string[] | null,
  expected: string | readonly string[]
): boolean {
  if (typeof expected === 'string') return actual === expected;
  return (
    Array.isArray(actual) &&
    actual.length === expected.length &&
    actual.every((entry, index) => entry === expected[index])
  );
}

function stringListsMatch(actual: DOMStringList, expected: readonly string[]): boolean {
  const actualValues = Array.from(actual).sort();
  const expectedValues = [...expected].sort();
  return (
    actualValues.length === expectedValues.length &&
    actualValues.every((value, index) => value === expectedValues[index])
  );
}

function storeMatches(store: IDBObjectStore, spec: StoreSpec): boolean {
  if (store.autoIncrement || !keyPathMatches(store.keyPath, spec.keyPath)) return false;
  if (
    !stringListsMatch(
      store.indexNames,
      spec.indexes.map((index) => index.name)
    )
  )
    return false;
  return spec.indexes.every((indexSpec) => {
    const index = store.index(indexSpec.name);
    return (
      keyPathMatches(index.keyPath, indexSpec.keyPath) &&
      index.unique === indexSpec.unique &&
      index.multiEntry === indexSpec.multiEntry
    );
  });
}

function validateStoreSpecs(database: IDBDatabase, specs: readonly StoreSpec[]): boolean {
  if (
    !stringListsMatch(
      database.objectStoreNames,
      specs.map((spec) => spec.name)
    )
  )
    return false;
  try {
    const transaction = database.transaction(
      specs.map((spec) => spec.name),
      'readonly'
    );
    return specs.every((spec) => storeMatches(transaction.objectStore(spec.name), spec));
  } catch {
    return false;
  }
}

function createStoreFromSpec(database: IDBDatabase, spec: StoreSpec): void {
  const store = database.createObjectStore(spec.name, {
    keyPath: typeof spec.keyPath === 'string' ? spec.keyPath : [...spec.keyPath],
  });
  for (const index of spec.indexes) {
    store.createIndex(
      index.name,
      typeof index.keyPath === 'string' ? index.keyPath : [...index.keyPath],
      {
        unique: index.unique,
        multiEntry: index.multiEntry,
      }
    );
  }
}

/** Creates the exact canonical CoreDB v2 topology for a genuinely absent database. */
export function createCoreDbV2Schema(database: IDBDatabase): void {
  for (const spec of [...CORE_DB_V1_STORE_SPECS, YAML_MIGRATION_JOURNAL_STORE_SPEC]) {
    createStoreFromSpec(database, spec);
  }
}

export function validateCoreDbV1Schema(database: IDBDatabase): boolean {
  return (
    database.version === CORE_DB_LEGACY_NATIVE_VERSION &&
    validateStoreSpecs(database, CORE_DB_V1_STORE_SPECS)
  );
}

export function validateCoreDbV2Schema(database: IDBDatabase): boolean {
  return (
    database.version === CORE_DB_CANONICAL_NATIVE_VERSION &&
    validateStoreSpecs(database, [...CORE_DB_V1_STORE_SPECS, YAML_MIGRATION_JOURNAL_STORE_SPEC])
  );
}

export type OpenExistingCoreDbResult =
  | Readonly<{ readonly ok: true; readonly database: IDBDatabase }>
  | Readonly<{ readonly ok: false; readonly code: YamlStorageCoreDbErrorCode }>;

export async function openExistingCoreDb(
  factory: IDBFactory,
  databaseName: string,
  expectedVersion: number
): Promise<OpenExistingCoreDbResult> {
  if (typeof factory.databases !== 'function') {
    return Object.freeze({ ok: false, code: 'CORE_DB_DISCOVERY_UNAVAILABLE' });
  }
  let databases: IDBDatabaseInfo[];
  try {
    databases = await factory.databases();
  } catch {
    return Object.freeze({ ok: false, code: 'CORE_DB_DISCOVERY_UNAVAILABLE' });
  }
  const matches = databases.filter((entry) => entry.name === databaseName);
  if (matches.length === 0) return Object.freeze({ ok: false, code: 'CORE_DB_NOT_FOUND' });
  if (matches.length !== 1 || matches[0]?.version !== expectedVersion) {
    return Object.freeze({ ok: false, code: 'CORE_DB_VERSION_MISMATCH' });
  }
  return await new Promise((resolve) => {
    let request: IDBOpenDBRequest;
    try {
      request = factory.open(databaseName);
    } catch {
      resolve(Object.freeze({ ok: false, code: 'CORE_DB_OPEN_FAILED' }));
      return;
    }
    let unexpectedUpgrade = false;
    request.onupgradeneeded = () => {
      unexpectedUpgrade = true;
      request.transaction?.abort();
    };
    request.onerror = () =>
      resolve(
        Object.freeze({
          ok: false,
          code: unexpectedUpgrade ? 'CORE_DB_VERSION_MISMATCH' : 'CORE_DB_OPEN_FAILED',
        })
      );
    request.onblocked = () => resolve(Object.freeze({ ok: false, code: 'CORE_DB_OPEN_FAILED' }));
    request.onsuccess = () => {
      if (request.result.version !== expectedVersion) {
        request.result.close();
        resolve(Object.freeze({ ok: false, code: 'CORE_DB_VERSION_MISMATCH' }));
        return;
      }
      resolve(Object.freeze({ ok: true, database: request.result }));
    };
  });
}

/** Reopens a database without discovery and aborts instead of creating or upgrading it. */
export function openCoreDbAtExactVersion(
  factory: IDBFactory,
  databaseName: string,
  expectedVersion: number
): Promise<OpenExistingCoreDbResult> {
  return new Promise((resolve) => {
    let settled = false;
    let unexpectedUpgrade = false;
    const finish = (result: OpenExistingCoreDbResult): void => {
      if (settled) return;
      settled = true;
      resolve(result);
    };
    let request: IDBOpenDBRequest;
    try {
      request = factory.open(databaseName, expectedVersion);
    } catch {
      finish(Object.freeze({ ok: false, code: 'CORE_DB_OPEN_FAILED' }));
      return;
    }
    request.onupgradeneeded = () => {
      unexpectedUpgrade = true;
      request.transaction?.abort();
    };
    request.onerror = () =>
      finish(
        Object.freeze({
          ok: false,
          code: unexpectedUpgrade ? 'CORE_DB_VERSION_MISMATCH' : 'CORE_DB_OPEN_FAILED',
        })
      );
    request.onblocked = () => finish(Object.freeze({ ok: false, code: 'CORE_DB_OPEN_FAILED' }));
    request.onsuccess = () => {
      if (request.result.version !== expectedVersion) {
        request.result.close();
        finish(Object.freeze({ ok: false, code: 'CORE_DB_VERSION_MISMATCH' }));
        return;
      }
      finish(Object.freeze({ ok: true, database: request.result }));
    };
  });
}

export function readAllCoreDbNodes(database: IDBDatabase): Promise<readonly unknown[]> {
  return new Promise((resolve, reject) => {
    let snapshot: readonly unknown[] | null = null;
    let settled = false;
    const transaction = database.transaction('nodes', 'readonly');
    const request = transaction.objectStore('nodes').getAll();
    const fail = (): void => {
      if (settled) return;
      settled = true;
      reject(new Error('core-db-snapshot-failed'));
    };
    request.onerror = fail;
    request.onsuccess = () => {
      snapshot = request.result;
    };
    transaction.onabort = fail;
    transaction.onerror = fail;
    transaction.oncomplete = () => {
      if (settled) return;
      settled = true;
      if (snapshot === null) {
        reject(new Error('core-db-snapshot-failed'));
        return;
      }
      resolve(Object.freeze([...snapshot]));
    };
  });
}

export const yamlStorageCoreDbSchema = Object.freeze({
  legacyLogicalVersion: CORE_DB_LEGACY_LOGICAL_VERSION,
  canonicalLogicalVersion: CORE_DB_CANONICAL_LOGICAL_VERSION,
  legacyNativeVersion: CORE_DB_LEGACY_NATIVE_VERSION,
  canonicalNativeVersion: CORE_DB_CANONICAL_NATIVE_VERSION,
  journalStoreName: YAML_MIGRATION_JOURNAL_STORE_NAME,
  journalPrimaryKey: Object.freeze(['migrationId', 'nodeId', 'slot']),
  journalCohortIndexName: '[migrationId+fromCoreDbVersion+toCoreDbVersion]',
  journalCohortIndexKeyPath: Object.freeze(['migrationId', 'fromCoreDbVersion', 'toCoreDbVersion']),
});
