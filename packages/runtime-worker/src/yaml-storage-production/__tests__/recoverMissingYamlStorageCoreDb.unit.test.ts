import { Dexie } from 'dexie';
import { IDBFactory, IDBKeyRange } from 'fake-indexeddb';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { CoreDB } from '../../services/CoreDB.js';
import { recoverMissingYamlStorageCoreDb } from '../recoverMissingYamlStorageCoreDb.js';
import { CORE_DB_CANONICAL_NATIVE_VERSION } from '../yamlStorageCoreDbVersionConstants.js';

const DATABASE_NAME = 'hierarchidb-core';
const RECOVERY_DATABASE_NAME = 'hierarchidb-yaml-storage-recovery';
const RECOVERY_RELEASE_ID = 'incident-1388-v1';
const FINGERPRINT = 'a'.repeat(64);
const SOURCE_SHA = 'b'.repeat(40);
const ORIGINAL_DEXIE_INDEXED_DB = Dexie.dependencies.indexedDB;
const ORIGINAL_DEXIE_KEY_RANGE = Dexie.dependencies.IDBKeyRange;

function claimRecord(phase: 'claimed' | 'completed' = 'claimed') {
  return {
    key: RECOVERY_RELEASE_ID,
    protocolVersion: 1,
    phase,
    coordinatorFingerprintSha256: FINGERPRINT,
    recoveryReleaseId: RECOVERY_RELEASE_ID,
    recoveryReleaseVersion: SOURCE_SHA,
    openRequestId: 'open-1',
    interruptedCoreDatabaseStatus: 'missing',
    yamlDatabaseStatus: 'missing',
    yamlRowCount: null,
    yamlDigestSha256: null,
  } as const;
}

function seedClaim(factory: IDBFactory, includeRecord = true): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = factory.open(RECOVERY_DATABASE_NAME, 1);
    request.onupgradeneeded = () => {
      const transaction = request.transaction;
      if (transaction === null) throw new Error('claim-transaction-missing');
      const store = request.result.createObjectStore('recovery-state', { keyPath: 'key' });
      if (includeRecord) transaction.objectStore(store.name).add(claimRecord());
    };
    request.onerror = () => reject(new Error('claim-seed-failed'));
    request.onsuccess = () => resolve(request.result);
  });
}

function readClaim(factory: IDBFactory): Promise<unknown> {
  return new Promise((resolve, reject) => {
    const request = factory.open(RECOVERY_DATABASE_NAME, 1);
    request.onerror = () => reject(new Error('claim-open-failed'));
    request.onsuccess = () => {
      const database = request.result;
      const transaction = database.transaction('recovery-state', 'readonly');
      const read = transaction.objectStore('recovery-state').get(RECOVERY_RELEASE_ID);
      read.onerror = () => reject(new Error('claim-read-failed'));
      transaction.onerror = () => reject(new Error('claim-transaction-failed'));
      transaction.oncomplete = () => {
        database.close();
        resolve(read.result);
      };
    };
  });
}

function recoveryInput(
  factory: IDBFactory,
  recoveryDatabase: IDBDatabase,
  initializeCoreDb: () => Promise<void>
) {
  return {
    databaseName: DATABASE_NAME,
    recoveryDatabaseName: RECOVERY_DATABASE_NAME,
    recoveryDatabase,
    recoveryReleaseId: RECOVERY_RELEASE_ID,
    coordinatorFingerprintSha256: FINGERPRINT,
    recoveryReleaseVersion: SOURCE_SHA,
    openRequestId: 'open-1',
    interruptedCoreDatabaseStatus: 'missing' as const,
    yamlDatabaseStatus: 'missing' as const,
    yamlRowCount: null,
    yamlDigestSha256: null,
    environment: {
      indexedDB: factory,
      digestSha256Hex: async () => 'c'.repeat(64),
      initializeCoreDb,
    },
  };
}

async function initializeRealCoreDb(): Promise<void> {
  const coreDb = CoreDB.createForCanonicalRuntime(DATABASE_NAME);
  try {
    await coreDb.open();
    await coreDb.initialize();
  } finally {
    coreDb.close();
  }
}

function openBlockingCoreDb(factory: IDBFactory): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = factory.open(DATABASE_NAME, 1);
    request.onerror = () => reject(new Error('blocking-core-open-failed'));
    request.onsuccess = () => {
      request.result.onversionchange = () => undefined;
      resolve(request.result);
    };
  });
}

function openCoreDbAtVersionOne(factory: IDBFactory): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = factory.open(DATABASE_NAME, 1);
    request.onerror = () => reject(new Error('core-v1-open-failed'));
    request.onupgradeneeded = () => reject(new Error('core-v1-was-mutated'));
    request.onsuccess = () => resolve(request.result);
  });
}

describe('recoverMissingYamlStorageCoreDb', () => {
  let factory: IDBFactory;

  beforeEach(() => {
    factory = new IDBFactory();
    Dexie.dependencies.indexedDB = factory;
    Dexie.dependencies.IDBKeyRange = IDBKeyRange;
  });

  afterEach(() => {
    Dexie.dependencies.indexedDB = ORIGINAL_DEXIE_INDEXED_DB;
    Dexie.dependencies.IDBKeyRange = ORIGINAL_DEXIE_KEY_RANGE;
    vi.restoreAllMocks();
  });

  it('creates exact native-v20 CoreDB and completes the exact durable claim', async () => {
    const recoveryDatabase = await seedClaim(factory);
    const initializeCoreDb = vi.fn(initializeRealCoreDb);

    const result = await recoverMissingYamlStorageCoreDb(
      recoveryInput(factory, recoveryDatabase, initializeCoreDb)
    );

    expect(result).toEqual({ ok: true });
    expect(initializeCoreDb).toHaveBeenCalledTimes(1);
    expect(await factory.databases()).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ name: DATABASE_NAME, version: CORE_DB_CANONICAL_NATIVE_VERSION }),
      ])
    );
    await expect(readClaim(factory)).resolves.toEqual(claimRecord('completed'));
  });

  it('fails closed before target creation when the claim record is absent', async () => {
    const recoveryDatabase = await seedClaim(factory, false);
    const result = await recoverMissingYamlStorageCoreDb(
      recoveryInput(
        factory,
        recoveryDatabase,
        vi.fn(async () => undefined)
      )
    );

    expect(result).toEqual({
      ok: false,
      error: { code: 'RECOVERY_CLAIM_MISMATCH' },
    });
    expect(await factory.databases()).toEqual([
      expect.objectContaining({ name: RECOVERY_DATABASE_NAME, version: 1 }),
    ]);
  });

  it('leaves a claimed terminal record when initialization fails and never retries it', async () => {
    const recoveryDatabase = await seedClaim(factory);

    const result = await recoverMissingYamlStorageCoreDb(
      recoveryInput(factory, recoveryDatabase, async () => {
        throw new Error('initialize-failed');
      })
    );

    expect(result).toEqual({
      ok: false,
      error: { code: 'RECOVERY_CORE_DB_INITIALIZATION_FAILED' },
    });
    await expect(readClaim(factory)).resolves.toEqual(claimRecord('claimed'));
    expect(await factory.databases()).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ name: DATABASE_NAME, version: CORE_DB_CANONICAL_NATIVE_VERSION }),
      ])
    );
  });

  it('aborts a delayed versionchange after blocked instead of mutating the target', async () => {
    const recoveryDatabase = await seedClaim(factory);
    const blocker = await openBlockingCoreDb(factory);

    const result = await recoverMissingYamlStorageCoreDb(
      recoveryInput(
        factory,
        recoveryDatabase,
        vi.fn(async () => undefined)
      )
    );

    expect(result).toEqual({ ok: false, error: { code: 'RECOVERY_TARGET_OPEN_BLOCKED' } });
    blocker.close();
    const unchanged = await openCoreDbAtVersionOne(factory);
    expect(unchanged.version).toBe(1);
    expect(unchanged.objectStoreNames).toHaveLength(0);
    unchanged.close();
    await expect(readClaim(factory)).resolves.toEqual(claimRecord('claimed'));
  });

  it('does not overwrite an already initialized canonical CoreDB', async () => {
    await initializeRealCoreDb();
    const recoveryDatabase = await seedClaim(factory);
    const initializeCoreDb = vi.fn(initializeRealCoreDb);

    const result = await recoverMissingYamlStorageCoreDb(
      recoveryInput(factory, recoveryDatabase, initializeCoreDb)
    );

    expect(result).toEqual({
      ok: false,
      error: { code: 'RECOVERY_TARGET_VERSION_MISMATCH' },
    });
    expect(initializeCoreDb).not.toHaveBeenCalled();
    await expect(readClaim(factory)).resolves.toEqual(claimRecord('claimed'));
  });
});
