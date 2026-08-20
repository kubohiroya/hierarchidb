import {
  ORIGIN_COORDINATOR_DATABASE_NAME,
  ORIGIN_COORDINATOR_DATABASE_VERSION,
  ORIGIN_COORDINATOR_PROTOCOL_VERSION,
  ORIGIN_COORDINATOR_STATE_STORE_NAME,
  ORIGIN_COORDINATOR_YAML_STATE_KEY,
} from '@hierarchidb/origin-coordinator';
import { parseOriginCoordinatorAllowedState } from './originCoordinatorValidatorUtils.js';
import type { OriginCoordinatorAllowedState } from './types.js';

export type OriginCoordinatorStateDbResult =
  | { readonly ok: true; readonly state: OriginCoordinatorAllowedState }
  | {
      readonly ok: false;
      readonly code: 'COORDINATOR_STORAGE_FAILED' | 'INVALID_DURABLE_STATE';
    };

function createAllowedState(): OriginCoordinatorAllowedState {
  return Object.freeze({
    key: ORIGIN_COORDINATOR_YAML_STATE_KEY,
    protocolVersion: ORIGIN_COORDINATOR_PROTOCOL_VERSION,
    phase: 'allowed',
  });
}

function openCoordinatorDatabase(
  factory: IDBFactory,
  initializeFirstStore: boolean
): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    let createdStore = false;
    let upgradeRejected = false;
    const request = factory.open(
      ORIGIN_COORDINATOR_DATABASE_NAME,
      ORIGIN_COORDINATOR_DATABASE_VERSION
    );

    request.onupgradeneeded = (event) => {
      const oldVersion = event.oldVersion;
      const database = request.result;
      const transaction = request.transaction;
      if (
        !initializeFirstStore ||
        oldVersion !== 0 ||
        transaction === null ||
        database.objectStoreNames.contains(ORIGIN_COORDINATOR_STATE_STORE_NAME)
      ) {
        upgradeRejected = true;
        transaction?.abort();
        return;
      }
      const store = database.createObjectStore(ORIGIN_COORDINATOR_STATE_STORE_NAME, {
        keyPath: 'key',
      });
      store.add(createAllowedState());
      createdStore = true;
    };

    request.onerror = () => {
      reject(request.error ?? new Error('origin-coordinator-database-open-failed'));
    };
    request.onblocked = () => {
      reject(new Error('origin-coordinator-database-open-blocked'));
    };
    request.onsuccess = () => {
      if (
        upgradeRejected ||
        (initializeFirstStore && request.result.version === 1 && !createdStore)
      ) {
        request.result.close();
        reject(new Error('origin-coordinator-database-initialization-rejected'));
        return;
      }
      resolve(request.result);
    };
  });
}

async function readStateFromDatabase(database: IDBDatabase): Promise<unknown> {
  return await new Promise((resolve, reject) => {
    if (
      database.objectStoreNames.length !== 1 ||
      !database.objectStoreNames.contains(ORIGIN_COORDINATOR_STATE_STORE_NAME)
    ) {
      resolve(null);
      return;
    }
    const transaction = database.transaction(ORIGIN_COORDINATOR_STATE_STORE_NAME, 'readonly');
    const store = transaction.objectStore(ORIGIN_COORDINATOR_STATE_STORE_NAME);
    if (store.keyPath !== 'key' || store.autoIncrement || store.indexNames.length !== 0) {
      resolve(null);
      return;
    }
    const request = store.getAll();
    request.onerror = () => {
      reject(request.error ?? new Error('origin-coordinator-state-read-failed'));
    };
    request.onsuccess = () => {
      resolve(request.result.length === 1 ? request.result[0] : null);
    };
    transaction.onabort = () => {
      reject(transaction.error ?? new Error('origin-coordinator-state-read-aborted'));
    };
  });
}

export async function initializeOriginCoordinatorStateDb(
  factory: IDBFactory
): Promise<OriginCoordinatorStateDbResult> {
  let database: IDBDatabase | null = null;
  try {
    const existingDatabases =
      typeof factory.databases === 'function' ? await factory.databases() : null;
    if (existingDatabases === null) {
      return Object.freeze({ ok: false, code: 'COORDINATOR_STORAGE_FAILED' });
    }
    const databaseExists = existingDatabases.some(
      (entry) => entry.name === ORIGIN_COORDINATOR_DATABASE_NAME
    );
    database = await openCoordinatorDatabase(factory, !databaseExists);
    const rawState = await readStateFromDatabase(database);
    const state = parseOriginCoordinatorAllowedState(rawState);
    if (state === null) {
      return Object.freeze({ ok: false, code: 'INVALID_DURABLE_STATE' });
    }
    return Object.freeze({ ok: true, state });
  } catch {
    return Object.freeze({ ok: false, code: 'COORDINATOR_STORAGE_FAILED' });
  } finally {
    database?.close();
  }
}

export async function readOriginCoordinatorStateDb(
  factory: IDBFactory
): Promise<OriginCoordinatorStateDbResult> {
  let database: IDBDatabase | null = null;
  try {
    database = await openCoordinatorDatabase(factory, false);
    const rawState = await readStateFromDatabase(database);
    const state = parseOriginCoordinatorAllowedState(rawState);
    if (state === null) {
      return Object.freeze({ ok: false, code: 'INVALID_DURABLE_STATE' });
    }
    return Object.freeze({ ok: true, state });
  } catch {
    return Object.freeze({ ok: false, code: 'COORDINATOR_STORAGE_FAILED' });
  } finally {
    database?.close();
  }
}
