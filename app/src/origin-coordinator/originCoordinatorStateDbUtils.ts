import {
  ORIGIN_COORDINATOR_DATABASE_NAME,
  ORIGIN_COORDINATOR_DATABASE_VERSION,
  ORIGIN_COORDINATOR_PROTOCOL_VERSION,
  ORIGIN_COORDINATOR_STATE_STORE_NAME,
  ORIGIN_COORDINATOR_YAML_STATE_KEY,
} from '@hierarchidb/origin-coordinator';
import {
  parseOriginCoordinatorDurableState,
  parseOriginCoordinatorFoundationAllowedState,
} from './originCoordinatorValidatorUtils.js';
import type { OriginCoordinatorAllowedState, OriginCoordinatorDurableState } from './types.js';

export type OriginCoordinatorStateDbResult =
  | { readonly ok: true; readonly state: OriginCoordinatorDurableState }
  | {
      readonly ok: false;
      readonly code: 'COORDINATOR_STORAGE_FAILED' | 'INVALID_DURABLE_STATE';
    };

export type OriginCoordinatorStateDbTransitionResult =
  | { readonly ok: true; readonly state: OriginCoordinatorDurableState }
  | {
      readonly ok: false;
      readonly code: 'COORDINATOR_STORAGE_FAILED' | 'INVALID_DURABLE_STATE';
    }
  | {
      readonly ok: false;
      readonly code: 'TRANSITION_REJECTED';
      readonly state: OriginCoordinatorDurableState;
    };

function createAllowedState(): OriginCoordinatorAllowedState {
  return Object.freeze({
    key: ORIGIN_COORDINATOR_YAML_STATE_KEY,
    protocolVersion: ORIGIN_COORDINATOR_PROTOCOL_VERSION,
    phase: 'allowed',
  });
}

function hasExactStoreTopology(database: IDBDatabase): boolean {
  return (
    database.objectStoreNames.length === 1 &&
    database.objectStoreNames.contains(ORIGIN_COORDINATOR_STATE_STORE_NAME)
  );
}

function hasExactStoreSchema(store: IDBObjectStore): boolean {
  return store.keyPath === 'key' && !store.autoIncrement && store.indexNames.length === 0;
}

function openAndUpgradeCoordinatorDatabase(factory: IDBFactory): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    let invalidUpgradeState = false;
    const request = factory.open(
      ORIGIN_COORDINATOR_DATABASE_NAME,
      ORIGIN_COORDINATOR_DATABASE_VERSION
    );

    request.onupgradeneeded = (event) => {
      const database = request.result;
      const transaction = request.transaction;
      if (transaction === null) {
        invalidUpgradeState = true;
        return;
      }
      if (event.oldVersion === 0) {
        if (database.objectStoreNames.length !== 0) {
          invalidUpgradeState = true;
          transaction.abort();
          return;
        }
        const store = database.createObjectStore(ORIGIN_COORDINATOR_STATE_STORE_NAME, {
          keyPath: 'key',
        });
        store.add(createAllowedState());
        return;
      }
      if (event.oldVersion !== 1 || !hasExactStoreTopology(database)) {
        invalidUpgradeState = true;
        transaction.abort();
        return;
      }
      const store = transaction.objectStore(ORIGIN_COORDINATOR_STATE_STORE_NAME);
      if (!hasExactStoreSchema(store)) {
        invalidUpgradeState = true;
        transaction.abort();
        return;
      }
      const readRequest = store.getAll();
      readRequest.onerror = () => {
        transaction.abort();
      };
      readRequest.onsuccess = () => {
        const rawState = readRequest.result.length === 1 ? readRequest.result[0] : null;
        if (parseOriginCoordinatorFoundationAllowedState(rawState) === null) {
          invalidUpgradeState = true;
          transaction.abort();
          return;
        }
        store.put(createAllowedState());
      };
    };

    request.onerror = () => {
      reject(
        new Error(
          invalidUpgradeState
            ? 'origin-coordinator-invalid-upgrade-state'
            : 'origin-coordinator-database-open-failed'
        )
      );
    };
    request.onblocked = () => {
      reject(new Error('origin-coordinator-database-open-blocked'));
    };
    request.onsuccess = () => resolve(request.result);
  });
}

async function databaseVersionExists(factory: IDBFactory): Promise<boolean> {
  if (typeof factory.databases !== 'function') return false;
  const databases = await factory.databases();
  const matches = databases.filter((entry) => entry.name === ORIGIN_COORDINATOR_DATABASE_NAME);
  return matches.length === 1 && matches[0]?.version === ORIGIN_COORDINATOR_DATABASE_VERSION;
}

async function openExistingCoordinatorDatabase(factory: IDBFactory): Promise<IDBDatabase> {
  if (!(await databaseVersionExists(factory))) {
    throw new Error('origin-coordinator-database-missing-or-version-mismatch');
  }
  return await new Promise((resolve, reject) => {
    let unexpectedUpgrade = false;
    const request = factory.open(
      ORIGIN_COORDINATOR_DATABASE_NAME,
      ORIGIN_COORDINATOR_DATABASE_VERSION
    );
    request.onupgradeneeded = () => {
      unexpectedUpgrade = true;
      request.transaction?.abort();
    };
    request.onerror = () => {
      reject(
        new Error(
          unexpectedUpgrade
            ? 'origin-coordinator-unexpected-upgrade'
            : 'origin-coordinator-database-open-failed'
        )
      );
    };
    request.onblocked = () => reject(new Error('origin-coordinator-database-open-blocked'));
    request.onsuccess = () => resolve(request.result);
  });
}

async function readStateFromDatabase(database: IDBDatabase): Promise<unknown> {
  return await new Promise((resolve, reject) => {
    if (!hasExactStoreTopology(database)) {
      resolve(null);
      return;
    }
    const transaction = database.transaction(ORIGIN_COORDINATOR_STATE_STORE_NAME, 'readonly');
    const store = transaction.objectStore(ORIGIN_COORDINATOR_STATE_STORE_NAME);
    if (!hasExactStoreSchema(store)) {
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

async function readParsedState(database: IDBDatabase): Promise<OriginCoordinatorStateDbResult> {
  const rawState = await readStateFromDatabase(database);
  const state = parseOriginCoordinatorDurableState(rawState);
  return state === null
    ? Object.freeze({ ok: false, code: 'INVALID_DURABLE_STATE' })
    : Object.freeze({ ok: true, state });
}

export async function initializeOriginCoordinatorStateDb(
  factory: IDBFactory
): Promise<OriginCoordinatorStateDbResult> {
  let database: IDBDatabase | null = null;
  try {
    database = await openAndUpgradeCoordinatorDatabase(factory);
    return await readParsedState(database);
  } catch (error) {
    return Object.freeze({
      ok: false,
      code:
        error instanceof Error && error.message === 'origin-coordinator-invalid-upgrade-state'
          ? 'INVALID_DURABLE_STATE'
          : 'COORDINATOR_STORAGE_FAILED',
    });
  } finally {
    database?.close();
  }
}

export async function readOriginCoordinatorStateDb(
  factory: IDBFactory
): Promise<OriginCoordinatorStateDbResult> {
  let database: IDBDatabase | null = null;
  try {
    database = await openExistingCoordinatorDatabase(factory);
    return await readParsedState(database);
  } catch {
    return Object.freeze({ ok: false, code: 'COORDINATOR_STORAGE_FAILED' });
  } finally {
    database?.close();
  }
}

export async function transitionOriginCoordinatorStateDb(
  factory: IDBFactory,
  transition: (state: OriginCoordinatorDurableState) => OriginCoordinatorDurableState | null
): Promise<OriginCoordinatorStateDbTransitionResult> {
  let database: IDBDatabase | null = null;
  try {
    database = await openExistingCoordinatorDatabase(factory);
    if (!hasExactStoreTopology(database)) {
      return Object.freeze({ ok: false, code: 'INVALID_DURABLE_STATE' });
    }
    return await new Promise((resolve, reject) => {
      const transaction = database?.transaction(ORIGIN_COORDINATOR_STATE_STORE_NAME, 'readwrite');
      if (!transaction) {
        reject(new Error('origin-coordinator-transaction-unavailable'));
        return;
      }
      const store = transaction.objectStore(ORIGIN_COORDINATOR_STATE_STORE_NAME);
      if (!hasExactStoreSchema(store)) {
        transaction.abort();
        resolve(Object.freeze({ ok: false, code: 'INVALID_DURABLE_STATE' }));
        return;
      }
      let result: OriginCoordinatorStateDbTransitionResult | null = null;
      const request = store.getAll();
      request.onerror = () => transaction.abort();
      request.onsuccess = () => {
        const rawState = request.result.length === 1 ? request.result[0] : null;
        const currentState = parseOriginCoordinatorDurableState(rawState);
        if (currentState === null) {
          result = Object.freeze({ ok: false, code: 'INVALID_DURABLE_STATE' });
          transaction.abort();
          return;
        }
        const nextState = transition(currentState);
        if (nextState === null) {
          result = Object.freeze({
            ok: false,
            code: 'TRANSITION_REJECTED',
            state: currentState,
          });
          transaction.abort();
          return;
        }
        const validatedNextState = parseOriginCoordinatorDurableState(nextState);
        if (validatedNextState === null) {
          result = Object.freeze({ ok: false, code: 'INVALID_DURABLE_STATE' });
          transaction.abort();
          return;
        }
        result = Object.freeze({ ok: true, state: validatedNextState });
        store.put(validatedNextState);
      };
      transaction.oncomplete = () => {
        if (result === null) {
          reject(new Error('origin-coordinator-transition-missing-result'));
          return;
        }
        resolve(result);
      };
      transaction.onabort = () => {
        if (result !== null) {
          resolve(result);
          return;
        }
        reject(transaction.error ?? new Error('origin-coordinator-state-transition-aborted'));
      };
      transaction.onerror = () => {
        if (result === null) {
          reject(transaction.error ?? new Error('origin-coordinator-state-transition-failed'));
        }
      };
    });
  } catch {
    return Object.freeze({ ok: false, code: 'COORDINATOR_STORAGE_FAILED' });
  } finally {
    database?.close();
  }
}
