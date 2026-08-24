import { describe, expect, it } from 'vitest';
import { getLegacyYamlDbReadOnlyInventory } from '../src/readonly-inventory/getLegacyYamlDbReadOnlyInventory.js';

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
      accountingCounts: {
        'duplicate/no-op': 0,
        recoverable: 0,
        'orphan/blocked': 1,
        conflict: 0,
        invalid: 0,
        'explicitly-discarded': 0,
      },
    });
    expect(result.status).toBe('accepted');
    if (result.status !== 'accepted') throw new Error('Expected accepted inventory');
    expect(result.sourceDigest).toMatch(/^[0-9a-f]{64}$/);
    expect(result.accountingEvidence).toEqual([
      {
        stableIdentifier: expect.stringMatching(/^[0-9a-f]{64}$/),
        classification: 'orphan/blocked',
      },
    ]);
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
      accountingCounts: {
        'duplicate/no-op': 0,
        recoverable: 0,
        'orphan/blocked': 1,
        conflict: 0,
        invalid: 1,
        'explicitly-discarded': 0,
      },
    });
    expect(result.status).toBe('accepted');
    if (result.status !== 'accepted') throw new Error('Expected accepted inventory');
    expect(result.accountingEvidence.map((entry) => entry.classification).sort()).toEqual([
      'invalid',
      'orphan/blocked',
    ]);
    for (const entry of result.accountingEvidence) {
      expect(entry.stableIdentifier).toMatch(/^[0-9a-f]{64}$/);
    }

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
          nodeType: 'folder',
          parentId: 'root-node',
          name: 'Parent',
          schemaId: 'folder',
          content: '',
        },
        {
          nodeId: 'equivalent-node',
          nodeType: 'yaml-file',
          parentId: 'parent-node',
          name: 'scenario.yml',
          subtype: 'scenario',
          schemaId: 'ide-gsm/scenario',
          content: 'name: equivalent\n',
        },
      ],
    });

    expect(result).toMatchObject({
      status: 'accepted',
      accountingCounts: {
        'duplicate/no-op': 1,
        recoverable: 1,
        'orphan/blocked': 0,
        conflict: 0,
        invalid: 0,
        'explicitly-discarded': 0,
      },
      targetComparisonCounts: {
        equivalent: 1,
        'target-absent': 1,
        'parent-blocked': 0,
        conflict: 0,
      },
    });
    expect(result.status).toBe('accepted');
    if (result.status !== 'accepted') throw new Error('Expected accepted inventory');
    expect(result.accountingEvidence.map((entry) => entry.classification).sort()).toEqual([
      'duplicate/no-op',
      'recoverable',
    ]);
    for (const entry of result.accountingEvidence) {
      expect(entry.stableIdentifier).toMatch(/^[0-9a-f]{64}$/);
    }

    await deleteDatabase(databaseName);
  });

  it('classifies target collisions and non-folder parents without recovering rows', async () => {
    const databaseName = nextDatabaseName();
    await createLegacyDatabase(databaseName, [
      {
        nodeId: 'node-id-conflict',
        parentId: 'parent-node',
        name: 'scenario.yml',
        schemaId: 'ide-gsm/scenario',
        content: 'name: legacy\n',
      },
      {
        nodeId: 'sibling-conflict',
        parentId: 'parent-node',
        name: 'git.yml',
        schemaId: 'ide-gsm/git',
        content: 'url: https://example.com/repo.git\n',
      },
      {
        nodeId: 'blocked-node',
        parentId: 'file-parent',
        name: 'git.yml',
        schemaId: 'ide-gsm/git',
        content: 'url: https://example.com/blocked.git\n',
      },
    ]);

    const result = await getLegacyYamlDbReadOnlyInventory({
      databaseName,
      canonicalTargets: [
        {
          nodeId: 'node-id-conflict',
          nodeType: 'yaml-file',
          parentId: 'parent-node',
          name: 'scenario.yml',
          subtype: 'scenario',
          schemaId: 'ide-gsm/scenario',
          content: 'name: canonical\n',
        },
        {
          nodeId: 'parent-node',
          nodeType: 'folder',
          parentId: 'root-node',
          name: 'Parent',
          schemaId: 'folder',
          content: '',
        },
        {
          nodeId: 'different-node',
          nodeType: 'yaml-file',
          parentId: 'parent-node',
          name: 'git.yml',
          subtype: 'git',
          schemaId: 'ide-gsm/git',
          content: 'url: https://example.com/repo.git\n',
        },
        {
          nodeId: 'file-parent',
          nodeType: 'yaml-file',
          parentId: 'parent-node',
          name: 'remote.yml',
          subtype: 'remote',
          schemaId: 'ide-gsm/remote',
          content: 'url: https://example.com/remote\n',
        },
      ],
    });

    expect(result).toMatchObject({
      status: 'accepted',
      accountingCounts: {
        'duplicate/no-op': 0,
        recoverable: 0,
        'orphan/blocked': 1,
        conflict: 2,
        invalid: 0,
        'explicitly-discarded': 0,
      },
    });
    expect(result.status).toBe('accepted');
    if (result.status !== 'accepted') throw new Error('Expected accepted inventory');
    expect(result.accountingEvidence.map((entry) => entry.classification).sort()).toEqual([
      'conflict',
      'conflict',
      'orphan/blocked',
    ]);
    for (const entry of result.accountingEvidence) {
      expect(entry.stableIdentifier).toMatch(/^[0-9a-f]{64}$/);
    }

    await deleteDatabase(databaseName);
  });

  it('accounts explicitly discarded rows only from approval records', async () => {
    const databaseName = nextDatabaseName();
    await createLegacyDatabase(databaseName, [
      {
        nodeId: 'discarded-node',
        parentId: 'parent-node',
        name: 'scenario.yml',
        schemaId: 'ide-gsm/scenario',
        content: 'name: discarded\n',
      },
    ]);

    const baseline = await getLegacyYamlDbReadOnlyInventory({ databaseName });
    expect(baseline.status).toBe('accepted');
    if (baseline.status !== 'accepted') throw new Error('Expected accepted inventory');
    const stableIdentifier = baseline.accountingEvidence[0]?.stableIdentifier;
    if (stableIdentifier === undefined) throw new Error('Expected accounting evidence');

    const result = await getLegacyYamlDbReadOnlyInventory({
      databaseName,
      explicitDiscardApprovals: [{ stableIdentifier, reason: 'user-approved' }],
    });

    expect(result).toMatchObject({
      status: 'accepted',
      accountingCounts: {
        'duplicate/no-op': 0,
        recoverable: 0,
        'orphan/blocked': 0,
        conflict: 0,
        invalid: 0,
        'explicitly-discarded': 1,
      },
      accountingEvidence: [
        {
          stableIdentifier: expect.stringMatching(/^[0-9a-f]{64}$/),
          classification: 'explicitly-discarded',
        },
      ],
    });
    expect(result.status).toBe('accepted');
    if (result.status !== 'accepted') throw new Error('Expected accepted inventory');
    expect(result.accountingEvidence[0]?.stableIdentifier).toBe(stableIdentifier);

    await deleteDatabase(databaseName);
  });

  it('keeps stable identifiers independent from accounting classification', async () => {
    const databaseName = nextDatabaseName();
    await createLegacyDatabase(databaseName, [
      {
        nodeId: 'stable-node',
        parentId: 'parent-node',
        name: 'scenario.yml',
        schemaId: 'ide-gsm/scenario',
        content: 'name: stable\n',
      },
    ]);

    const baseline = await getLegacyYamlDbReadOnlyInventory({ databaseName });
    expect(baseline.status).toBe('accepted');
    if (baseline.status !== 'accepted') throw new Error('Expected accepted inventory');
    const stableIdentifier = baseline.accountingEvidence[0]?.stableIdentifier;
    if (stableIdentifier === undefined) throw new Error('Expected accounting evidence');

    const compared = await getLegacyYamlDbReadOnlyInventory({
      databaseName,
      canonicalTargets: [
        {
          nodeId: 'parent-node',
          nodeType: 'folder',
          parentId: 'root-node',
          name: 'Parent',
          schemaId: 'folder',
          content: '',
        },
      ],
    });

    expect(compared.status).toBe('accepted');
    if (compared.status !== 'accepted') throw new Error('Expected accepted inventory');
    expect(compared.accountingEvidence).toEqual([
      {
        stableIdentifier,
        classification: 'recoverable',
      },
    ]);

    await deleteDatabase(databaseName);
  });

  it('fails closed on malformed discard approvals', async () => {
    const databaseName = nextDatabaseName();
    await createLegacyDatabase(databaseName, [
      {
        nodeId: 'approval-node',
        parentId: 'parent-node',
        name: 'scenario.yml',
        schemaId: 'ide-gsm/scenario',
        content: 'name: approval\n',
      },
    ]);

    const result = await getLegacyYamlDbReadOnlyInventory({
      databaseName,
      explicitDiscardApprovals: [{ stableIdentifier: 'approval-node', reason: '' }],
    });

    expect(result).toEqual({
      contractVersion: 1,
      status: 'failed',
      code: 'LEGACY_YAMLDB_DISCARD_APPROVAL_MALFORMED',
    });

    await deleteDatabase(databaseName);
  });

  it('fails closed on ambiguous canonical target snapshots', async () => {
    const databaseName = nextDatabaseName();
    await createLegacyDatabase(databaseName, [
      {
        nodeId: 'target-node',
        parentId: 'parent-node',
        name: 'scenario.yml',
        schemaId: 'ide-gsm/scenario',
        content: 'name: target\n',
      },
    ]);

    const result = await getLegacyYamlDbReadOnlyInventory({
      databaseName,
      canonicalTargets: [
        {
          nodeId: 'parent-node',
          nodeType: 'folder',
          parentId: 'root-node',
          name: 'Parent',
          schemaId: 'folder',
          content: '',
        },
        {
          nodeId: 'parent-node',
          nodeType: 'folder',
          parentId: 'root-node',
          name: 'Duplicate Parent',
          schemaId: 'folder',
          content: '',
        },
      ],
    });

    expect(result).toEqual({
      contractVersion: 1,
      status: 'failed',
      code: 'LEGACY_YAMLDB_CANONICAL_TARGETS_MALFORMED',
    });

    await deleteDatabase(databaseName);
  });
});
