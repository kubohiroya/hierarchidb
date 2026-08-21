import { IDBFactory, IDBObjectStore } from 'fake-indexeddb';
import { describe, expect, it, vi } from 'vitest';
import { inspectInterruptedCoreV1Database } from '../inspectInterruptedCoreV1Database.js';

const RELEASE_VERSION = 'b'.repeat(40);
const TIMESTAMP = '2026-08-22T00:00:00.000Z';
const DATABASE_NAME = 'hidb-core';
const NATIVE_VERSION = 10;

type TopologyMutation =
  | 'none'
  | 'extra-store'
  | 'missing-store'
  | 'index-mismatch'
  | 'keypath-mismatch';

function createCoreV1Stores(database: IDBDatabase, mutation: TopologyMutation): void {
  const trees = database.createObjectStore('trees', { keyPath: 'id' });
  trees.createIndex('rootId', 'rootId');
  trees.createIndex('archiveRootId', 'archiveRootId');
  trees.createIndex('superRootId', 'superRootId');

  const nodes = database.createObjectStore('nodes', {
    keyPath: mutation === 'keypath-mismatch' ? 'nodeId' : 'id',
  });
  nodes.createIndex('parentId', 'parentId');
  nodes.createIndex('[parentId+metadata.name]', ['parentId', 'metadata.name'], { unique: true });
  nodes.createIndex('[parentId+updatedAt]', ['parentId', 'updatedAt']);
  nodes.createIndex('depth', 'depth');
  nodes.createIndex('references', 'references', {
    multiEntry: true,
    unique: mutation === 'index-mismatch',
  });

  if (mutation !== 'missing-store') {
    database.createObjectStore('rootStates', { keyPath: 'rootNodeId' });
  }

  const tags = database.createObjectStore('tags', { keyPath: 'id' });
  tags.createIndex('name', 'name');
  tags.createIndex('createdAt', 'createdAt');

  const associations = database.createObjectStore('tagAssociations', { keyPath: 'id' });
  associations.createIndex('nodeId', 'nodeId');
  associations.createIndex('tagId', 'tagId');
  associations.createIndex('scope', 'scope');
  associations.createIndex('createdAt', 'createdAt');
  associations.createIndex('[nodeId+tagId+scope]', ['nodeId', 'tagId', 'scope'], {
    unique: true,
  });

  if (mutation === 'extra-store') {
    database.createObjectStore('unexpected', { keyPath: 'id' });
  }
}

function seedDatabase(
  factory: IDBFactory,
  mutation: TopologyMutation,
  recordCount: number
): Promise<void> {
  return new Promise((resolve, reject) => {
    const request = factory.open(DATABASE_NAME, NATIVE_VERSION);
    request.onupgradeneeded = () => {
      createCoreV1Stores(request.result, mutation);
      if (mutation !== 'none') return;
      const transaction = request.transaction;
      if (transaction === null) throw new Error('seed-transaction-missing');
      for (let index = 0; index < recordCount; index += 1) {
        transaction.objectStore('nodes').add({ id: `node-${index}` });
      }
    };
    request.onerror = () => reject(new Error('seed-failed'));
    request.onsuccess = () => {
      request.result.close();
      resolve();
    };
  });
}

function input(factory: IDBFactory) {
  return Object.freeze({
    factory,
    releaseVersion: RELEASE_VERSION,
    timestamp: TIMESTAMP,
  });
}

describe('inspectInterruptedCoreV1Database', () => {
  it('accepts an exact empty logical-v1 database at native version 10', async () => {
    const factory = new IDBFactory();
    await seedDatabase(factory, 'none', 0);
    const databasesSpy = vi.spyOn(factory, 'databases');

    const result = await inspectInterruptedCoreV1Database(input(factory));

    expect(databasesSpy).toHaveBeenCalledTimes(1);
    expect(result).toEqual({
      mode: 'recovery-interrupted-core-v1',
      status: 'accepted',
      code: 'INTERRUPTED_CORE_V1_DIAGNOSTIC_ACCEPTED',
      timestamp: TIMESTAMP,
      releaseVersion: RELEASE_VERSION,
      interruptedCoreDb: {
        nativeVersion: NATIVE_VERSION,
        topologyStatus: 'exact-logical-v1',
        recordCount: 0,
      },
    });
  });

  it('reports only the aggregate count for a nonempty exact logical-v1 database', async () => {
    const factory = new IDBFactory();
    await seedDatabase(factory, 'none', 2);

    const result = await inspectInterruptedCoreV1Database(input(factory));

    expect(result).toMatchObject({
      status: 'accepted',
      interruptedCoreDb: {
        nativeVersion: NATIVE_VERSION,
        topologyStatus: 'exact-logical-v1',
        recordCount: 2,
      },
    });
    expect(JSON.stringify(result)).not.toContain('node-0');
  });

  it.each(['extra-store', 'missing-store', 'index-mismatch', 'keypath-mismatch'] as const)(
    'rejects %s without counting records',
    async (mutation) => {
      const factory = new IDBFactory();
      await seedDatabase(factory, mutation, 0);
      const countSpy = vi.spyOn(IDBObjectStore.prototype, 'count');

      try {
        const result = await inspectInterruptedCoreV1Database(input(factory));

        expect(result).toMatchObject({
          status: 'rejected',
          code: 'INTERRUPTED_CORE_V1_DIAGNOSTIC_TOPOLOGY_MISMATCH',
          interruptedCoreDb: {
            nativeVersion: NATIVE_VERSION,
            topologyStatus: 'mismatch',
            recordCount: null,
          },
        });
        expect(countSpy).not.toHaveBeenCalled();
      } finally {
        countSpy.mockRestore();
      }
    }
  );

  it('rejects a blocked exact-native-version open without retrying', async () => {
    const request = { onblocked: null } as unknown as IDBOpenDBRequest;
    const factory = {
      databases: vi.fn(async () => [{ name: DATABASE_NAME, version: NATIVE_VERSION }]),
      open: vi.fn(() => {
        queueMicrotask(() => request.onblocked?.call(request, new Event('blocked')));
        return request;
      }),
    } as unknown as IDBFactory;

    const result = await inspectInterruptedCoreV1Database(input(factory));

    expect(result).toMatchObject({
      status: 'rejected',
      code: 'INTERRUPTED_CORE_V1_DIAGNOSTIC_OPEN_BLOCKED',
    });
    expect(factory.open).toHaveBeenCalledTimes(1);
  });

  it('rejects a missing database without opening or creating it', async () => {
    const factory = new IDBFactory();
    const openSpy = vi.spyOn(factory, 'open');

    const result = await inspectInterruptedCoreV1Database(input(factory));

    expect(result).toMatchObject({
      status: 'rejected',
      code: 'INTERRUPTED_CORE_V1_DIAGNOSTIC_DATABASE_MISSING',
    });
    expect(openSpy).not.toHaveBeenCalled();
    expect(await factory.databases()).toEqual([]);
  });

  it('rejects a wrong native version without opening it', async () => {
    const factory = {
      databases: vi.fn(async () => [{ name: DATABASE_NAME, version: 20 }]),
      open: vi.fn(),
    } as unknown as IDBFactory;

    const result = await inspectInterruptedCoreV1Database(input(factory));

    expect(result).toMatchObject({
      status: 'rejected',
      code: 'INTERRUPTED_CORE_V1_DIAGNOSTIC_CATALOG_MISMATCH',
    });
    expect(factory.open).not.toHaveBeenCalled();
  });

  it('rejects duplicate exact catalog entries without opening the database', async () => {
    const factory = {
      databases: vi.fn(async () => [
        { name: DATABASE_NAME, version: NATIVE_VERSION },
        { name: DATABASE_NAME, version: NATIVE_VERSION },
      ]),
      open: vi.fn(),
    } as unknown as IDBFactory;

    const result = await inspectInterruptedCoreV1Database(input(factory));

    expect(factory.databases).toHaveBeenCalledTimes(1);
    expect(result).toMatchObject({
      status: 'rejected',
      code: 'INTERRUPTED_CORE_V1_DIAGNOSTIC_CATALOG_MISMATCH',
    });
    expect(factory.open).not.toHaveBeenCalled();
  });
});
