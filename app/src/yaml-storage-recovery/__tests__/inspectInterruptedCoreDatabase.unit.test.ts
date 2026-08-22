import { IDBFactory } from 'fake-indexeddb';
import { describe, expect, it, vi } from 'vitest';
import { inspectInterruptedCoreDatabase } from '../inspectInterruptedCoreDatabase.js';

const RELEASE_VERSION = 'a'.repeat(40);
const TIMESTAMP = '2026-08-21T00:00:00.000Z';
const DATABASE_NAME = 'hidb-core';

function createCoreV2Stores(database: IDBDatabase): void {
  const trees = database.createObjectStore('trees', { keyPath: 'id' });
  trees.createIndex('rootId', 'rootId');
  trees.createIndex('archiveRootId', 'archiveRootId');
  trees.createIndex('superRootId', 'superRootId');
  const nodes = database.createObjectStore('nodes', { keyPath: 'id' });
  nodes.createIndex('parentId', 'parentId');
  nodes.createIndex('[parentId+metadata.name]', ['parentId', 'metadata.name'], { unique: true });
  nodes.createIndex('[parentId+updatedAt]', ['parentId', 'updatedAt']);
  nodes.createIndex('depth', 'depth');
  nodes.createIndex('references', 'references', { multiEntry: true });
  database.createObjectStore('rootStates', { keyPath: 'rootNodeId' });
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
  const journal = database.createObjectStore('yamlMigrationJournal', {
    keyPath: ['migrationId', 'nodeId', 'slot'],
  });
  journal.createIndex('[migrationId+fromCoreDbVersion+toCoreDbVersion]', [
    'migrationId',
    'fromCoreDbVersion',
    'toCoreDbVersion',
  ]);
}

function seedExactDatabase(
  factory: IDBFactory,
  nativeVersion: number,
  recordCount: number
): Promise<void> {
  return new Promise((resolve, reject) => {
    const request = factory.open(DATABASE_NAME, nativeVersion);
    request.onupgradeneeded = () => {
      createCoreV2Stores(request.result);
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

describe('inspectInterruptedCoreDatabase', () => {
  it.each([2, 20])('accepts exact empty logical-v2 topology at native v%s', async (version) => {
    const factory = new IDBFactory();
    await seedExactDatabase(factory, version, 0);
    const databasesSpy = vi.spyOn(factory, 'databases');

    const result = await inspectInterruptedCoreDatabase(input(factory));

    expect(databasesSpy).toHaveBeenCalledTimes(1);
    expect(result).toEqual({
      mode: 'recovery-interrupted-core',
      status: 'accepted',
      code: 'INTERRUPTED_CORE_DIAGNOSTIC_ACCEPTED',
      timestamp: TIMESTAMP,
      releaseVersion: RELEASE_VERSION,
      interruptedCoreDb: {
        nativeVersion: version,
        topologyStatus: 'exact-logical-v2',
        recordCount: 0,
      },
    });
  });

  it('reports a nonempty exact database without exposing records', async () => {
    const factory = new IDBFactory();
    await seedExactDatabase(factory, 20, 2);

    const result = await inspectInterruptedCoreDatabase(input(factory));

    expect(result).toMatchObject({
      status: 'accepted',
      interruptedCoreDb: {
        nativeVersion: 20,
        topologyStatus: 'exact-logical-v2',
        recordCount: 2,
      },
    });
    expect(JSON.stringify(result)).not.toContain('node-0');
  });

  it('rejects a topology mismatch with only a sanitized summary', async () => {
    const factory = new IDBFactory();
    await new Promise<void>((resolve, reject) => {
      const request = factory.open(DATABASE_NAME, 20);
      request.onupgradeneeded = () => request.result.createObjectStore('unexpected');
      request.onerror = () => reject(new Error('seed-failed'));
      request.onsuccess = () => {
        request.result.close();
        resolve();
      };
    });

    const result = await inspectInterruptedCoreDatabase(input(factory));

    expect(result).toMatchObject({
      status: 'rejected',
      code: 'INTERRUPTED_CORE_DIAGNOSTIC_TOPOLOGY_MISMATCH',
      interruptedCoreDb: {
        nativeVersion: 20,
        topologyStatus: 'mismatch',
        recordCount: null,
      },
    });
  });

  it('rejects a blocked open without retrying it', async () => {
    const request = { onblocked: null } as unknown as IDBOpenDBRequest;
    const factory = {
      databases: vi.fn(async () => [{ name: DATABASE_NAME, version: 20 }]),
      open: vi.fn(() => {
        queueMicrotask(() => request.onblocked?.call(request, new Event('blocked')));
        return request;
      }),
    } as unknown as IDBFactory;

    const result = await inspectInterruptedCoreDatabase(input(factory));

    expect(result).toMatchObject({
      status: 'rejected',
      code: 'INTERRUPTED_CORE_DIAGNOSTIC_OPEN_BLOCKED',
    });
    expect(factory.open).toHaveBeenCalledTimes(1);
  });

  it('rejects a missing database without opening or creating it', async () => {
    const factory = new IDBFactory();
    const openSpy = vi.spyOn(factory, 'open');

    const result = await inspectInterruptedCoreDatabase(input(factory));

    expect(result).toMatchObject({
      status: 'rejected',
      code: 'INTERRUPTED_CORE_DIAGNOSTIC_DATABASE_MISSING',
    });
    expect(openSpy).not.toHaveBeenCalled();
    expect(await factory.databases()).toEqual([]);
  });
});
