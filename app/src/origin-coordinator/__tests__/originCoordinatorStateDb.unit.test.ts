import {
  ORIGIN_COORDINATOR_DATABASE_NAME,
  ORIGIN_COORDINATOR_DATABASE_VERSION,
  ORIGIN_COORDINATOR_PROTOCOL_VERSION,
  ORIGIN_COORDINATOR_STATE_STORE_NAME,
  ORIGIN_COORDINATOR_YAML_STATE_KEY,
} from '@hierarchidb/origin-coordinator';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import {
  initializeOriginCoordinatorStateDb,
  readOriginCoordinatorStateDb,
} from '../originCoordinatorStateDbUtils.js';

function awaitRequest<T>(request: IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    request.onerror = () => reject(request.error ?? new Error('indexeddb-request-failed'));
    request.onsuccess = () => resolve(request.result);
  });
}

async function deleteCoordinatorDatabase(): Promise<void> {
  await awaitRequest(indexedDB.deleteDatabase(ORIGIN_COORDINATOR_DATABASE_NAME));
}

async function replaceState(records: readonly Record<string, unknown>[]): Promise<void> {
  const database = await awaitRequest(
    indexedDB.open(ORIGIN_COORDINATOR_DATABASE_NAME, ORIGIN_COORDINATOR_DATABASE_VERSION)
  );
  try {
    const transaction = database.transaction(ORIGIN_COORDINATOR_STATE_STORE_NAME, 'readwrite');
    const store = transaction.objectStore(ORIGIN_COORDINATOR_STATE_STORE_NAME);
    await awaitRequest(store.clear());
    for (const record of records) {
      await awaitRequest(store.add(record));
    }
  } finally {
    database.close();
  }
}

async function createVersionOneDatabase(record: Record<string, unknown>): Promise<void> {
  await new Promise<void>((resolve, reject) => {
    const request = indexedDB.open(ORIGIN_COORDINATOR_DATABASE_NAME, 1);
    request.onupgradeneeded = () => {
      const store = request.result.createObjectStore(ORIGIN_COORDINATOR_STATE_STORE_NAME, {
        keyPath: 'key',
      });
      store.add(record);
    };
    request.onerror = () => reject(request.error ?? new Error('version-one-create-failed'));
    request.onsuccess = () => {
      request.result.close();
      resolve();
    };
  });
}

describe('origin coordinator state database', () => {
  beforeEach(deleteCoordinatorDatabase);
  afterEach(deleteCoordinatorDatabase);

  it('creates the exact allowed record only on first installation', async () => {
    const initialized = await initializeOriginCoordinatorStateDb(indexedDB);
    const reread = await readOriginCoordinatorStateDb(indexedDB);
    const secondInitialization = await initializeOriginCoordinatorStateDb(indexedDB);

    expect(initialized).toEqual({
      ok: true,
      state: {
        key: ORIGIN_COORDINATOR_YAML_STATE_KEY,
        protocolVersion: ORIGIN_COORDINATOR_PROTOCOL_VERSION,
        phase: 'allowed',
      },
    });
    expect(reread).toEqual(initialized);
    expect(secondInitialization).toEqual(initialized);
  });

  it('upgrades only the exact version 1 allowed record to version 2 allowed', async () => {
    await createVersionOneDatabase({
      key: ORIGIN_COORDINATOR_YAML_STATE_KEY,
      protocolVersion: 1,
      phase: 'allowed',
    });

    expect(await initializeOriginCoordinatorStateDb(indexedDB)).toEqual({
      ok: true,
      state: {
        key: ORIGIN_COORDINATOR_YAML_STATE_KEY,
        protocolVersion: ORIGIN_COORDINATOR_PROTOCOL_VERSION,
        phase: 'allowed',
      },
    });
  });

  it('aborts version 1 upgrade instead of repairing malformed durable state', async () => {
    await createVersionOneDatabase({
      key: ORIGIN_COORDINATOR_YAML_STATE_KEY,
      protocolVersion: 1,
      phase: 'allowed',
      legacyName: 'yaml-storage',
    });

    expect(await initializeOriginCoordinatorStateDb(indexedDB)).toEqual({
      ok: false,
      code: 'INVALID_DURABLE_STATE',
    });
    const databases = await indexedDB.databases();
    expect(
      databases.find((database) => database.name === ORIGIN_COORDINATOR_DATABASE_NAME)?.version
    ).toBe(1);
  });

  it.each(['revoked', 'unknown'])(
    'rejects a version 1 %s phase without upgrading it',
    async (phase) => {
      await createVersionOneDatabase({
        key: ORIGIN_COORDINATOR_YAML_STATE_KEY,
        protocolVersion: 1,
        phase,
      });

      expect(await initializeOriginCoordinatorStateDb(indexedDB)).toEqual({
        ok: false,
        code: 'INVALID_DURABLE_STATE',
      });
      const databases = await indexedDB.databases();
      expect(
        databases.find((database) => database.name === ORIGIN_COORDINATOR_DATABASE_NAME)?.version
      ).toBe(1);
    }
  );

  it('does not recreate a missing record in an existing store', async () => {
    expect((await initializeOriginCoordinatorStateDb(indexedDB)).ok).toBe(true);
    await replaceState([]);

    expect(await initializeOriginCoordinatorStateDb(indexedDB)).toEqual({
      ok: false,
      code: 'INVALID_DURABLE_STATE',
    });
    expect(await readOriginCoordinatorStateDb(indexedDB)).toEqual({
      ok: false,
      code: 'INVALID_DURABLE_STATE',
    });
  });

  it('rejects extra record properties and does not normalize them', async () => {
    expect((await initializeOriginCoordinatorStateDb(indexedDB)).ok).toBe(true);
    await replaceState([
      {
        key: ORIGIN_COORDINATOR_YAML_STATE_KEY,
        protocolVersion: ORIGIN_COORDINATOR_PROTOCOL_VERSION,
        phase: 'allowed',
        legacyName: 'yaml-storage',
      },
    ]);

    expect(await readOriginCoordinatorStateDb(indexedDB)).toEqual({
      ok: false,
      code: 'INVALID_DURABLE_STATE',
    });
  });

  it('rejects an additional durable record', async () => {
    expect((await initializeOriginCoordinatorStateDb(indexedDB)).ok).toBe(true);
    await replaceState([
      {
        key: ORIGIN_COORDINATOR_YAML_STATE_KEY,
        protocolVersion: ORIGIN_COORDINATOR_PROTOCOL_VERSION,
        phase: 'allowed',
      },
      {
        key: 'unexpected',
        protocolVersion: ORIGIN_COORDINATOR_PROTOCOL_VERSION,
        phase: 'allowed',
      },
    ]);

    expect(await readOriginCoordinatorStateDb(indexedDB)).toEqual({
      ok: false,
      code: 'INVALID_DURABLE_STATE',
    });
  });
});
