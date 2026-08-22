import { describe, expect, it } from 'vitest';
import { getLegacyYamlDbReadOnlyInventory } from '../src/readonly-inventory/index.js';

let databaseSerial = 0;

function nextDatabaseName(): string {
  databaseSerial += 1;
  return `hierarchidb-yaml-inventory-test-${databaseSerial}`;
}

function requestSuccess<T>(request: IDBRequest<T>): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

async function deleteDatabase(databaseName: string): Promise<void> {
  await requestSuccess(indexedDB.deleteDatabase(databaseName));
}

async function createLegacyDatabase(
  databaseName: string,
  rows: readonly unknown[],
  version = 1
): Promise<void> {
  const request = indexedDB.open(databaseName, version);
  request.onupgradeneeded = () => {
    const database = request.result;
    const nodes = database.createObjectStore('nodes', { keyPath: 'nodeId' });
    nodes.createIndex('parentId', 'parentId');
    for (const row of rows) nodes.add(row);
  };
  const database = await requestSuccess(request);
  database.close();
}

async function createMalformedDatabase(databaseName: string): Promise<void> {
  const request = indexedDB.open(databaseName, 1);
  request.onupgradeneeded = () => {
    request.result.createObjectStore('notNodes');
  };
  const database = await requestSuccess(request);
  database.close();
}

describe('getLegacyYamlDbReadOnlyInventory', () => {
  it('accounts valid legacy v1 rows without exposing raw row values', async () => {
    const databaseName = nextDatabaseName();
    await createLegacyDatabase(databaseName, [
      {
        nodeId: 'secret-node-id',
        parentId: 'secret-parent-id',
        name: 'scenario.yml',
        schemaId: 'ide-gsm/scenario',
        content: 'name: secret-scenario\n',
      },
    ]);

    const result = await getLegacyYamlDbReadOnlyInventory({ databaseName });

    expect(result).toMatchObject({
      contractVersion: 1,
      status: 'accepted',
      nativeVersion: 1,
      rowCount: 1,
      validLegacyCount: 1,
      invalidCount: 0,
      invalidCodeCounts: {},
    });
    expect(result.status).toBe('accepted');
    if (result.status !== 'accepted') throw new Error('Expected accepted inventory');
    expect(result.sourceDigest).toMatch(/^[0-9a-f]{64}$/);
    const serialized = JSON.stringify(result);
    expect(serialized).not.toContain('secret-node-id');
    expect(serialized).not.toContain('secret-parent-id');
    expect(serialized).not.toContain('secret-scenario');

    await deleteDatabase(databaseName);
  });

  it('accounts invalid rows deterministically without skipping them', async () => {
    const databaseName = nextDatabaseName();
    await createLegacyDatabase(databaseName, [
      {
        nodeId: 'valid-node',
        parentId: 'parent-node',
        name: 'scenario.yml',
        schemaId: 'ide-gsm/scenario',
        content: 'name: valid\n',
      },
      {
        nodeId: 'invalid-node',
        parentId: 'parent-node',
        name: 'scenario.yml',
        schemaId: '',
        content: 'name: invalid\n',
      },
    ]);

    const result = await getLegacyYamlDbReadOnlyInventory({ databaseName });

    expect(result).toMatchObject({
      status: 'accepted',
      rowCount: 2,
      validLegacyCount: 1,
      invalidCount: 1,
      invalidCodeCounts: { ROW_INVALID_FIELD: 1 },
    });

    await deleteDatabase(databaseName);
  });

  it('reports a missing database without creating it', async () => {
    const databaseName = nextDatabaseName();

    const result = await getLegacyYamlDbReadOnlyInventory({ databaseName });

    expect(result).toEqual({
      contractVersion: 1,
      status: 'missing',
      code: 'LEGACY_YAMLDB_MISSING',
    });
    expect((await indexedDB.databases()).some((info) => info.name === databaseName)).toBe(false);
  });

  it('fails closed on a native version mismatch before opening the database', async () => {
    const databaseName = nextDatabaseName();
    await createLegacyDatabase(databaseName, [], 2);

    const result = await getLegacyYamlDbReadOnlyInventory({ databaseName });

    expect(result).toEqual({
      contractVersion: 1,
      status: 'failed',
      code: 'LEGACY_YAMLDB_VERSION_MISMATCH',
    });

    await deleteDatabase(databaseName);
  });

  it('aborts an unexpected upgrade attempt', async () => {
    const databaseName = nextDatabaseName();
    const lyingFactory = {
      databases: async () => [{ name: databaseName, version: 1 }],
      open: (name: string, version?: number) => indexedDB.open(name, version),
    } as IDBFactory;

    const result = await getLegacyYamlDbReadOnlyInventory({
      databaseName,
      indexedDB: lyingFactory,
    });

    expect(result).toEqual({
      contractVersion: 1,
      status: 'failed',
      code: 'LEGACY_YAMLDB_UNEXPECTED_UPGRADE',
    });
  });

  it('fails closed on malformed topology without reading fallback stores', async () => {
    const databaseName = nextDatabaseName();
    await createMalformedDatabase(databaseName);

    const result = await getLegacyYamlDbReadOnlyInventory({ databaseName });

    expect(result).toEqual({
      contractVersion: 1,
      status: 'failed',
      code: 'LEGACY_YAMLDB_TOPOLOGY_MALFORMED',
    });

    await deleteDatabase(databaseName);
  });

  it('reports aggregate target comparison counts when canonical targets are supplied', async () => {
    const databaseName = nextDatabaseName();
    await createLegacyDatabase(databaseName, [
      {
        nodeId: 'equivalent-node',
        parentId: 'parent-node',
        name: 'scenario.yml',
        schemaId: 'ide-gsm/scenario',
        content: 'name: equivalent\n',
      },
      {
        nodeId: 'absent-node',
        parentId: 'parent-node',
        name: 'git.yml',
        schemaId: 'ide-gsm/git',
        content: 'url: https://example.com/repo.git\n',
      },
    ]);

    const result = await getLegacyYamlDbReadOnlyInventory({
      databaseName,
      canonicalTargets: [
        {
          nodeId: 'parent-node',
          parentId: 'root-node',
          name: 'Parent',
          schemaId: 'folder',
          content: '',
        },
        {
          nodeId: 'equivalent-node',
          parentId: 'parent-node',
          name: 'scenario.yml',
          schemaId: 'ide-gsm/scenario',
          content: 'name: equivalent\n',
        },
      ],
    });

    expect(result).toMatchObject({
      status: 'accepted',
      targetComparisonCounts: {
        equivalent: 1,
        'target-absent': 1,
        'parent-blocked': 0,
        conflict: 0,
      },
    });

    await deleteDatabase(databaseName);
  });
});
