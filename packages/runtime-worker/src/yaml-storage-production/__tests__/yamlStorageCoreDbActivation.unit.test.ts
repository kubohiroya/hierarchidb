import { IDBFactory, IDBObjectStore } from 'fake-indexeddb';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  createYamlStorageActivation,
  reduceYamlStorageActivation,
  type YamlStoragePreflightState,
} from '../../yaml-storage-activation/index.js';
import { activateYamlStorageCoreDb } from '../activateYamlStorageCoreDb.js';
import { inspectCanonicalYamlStorageCoreDb } from '../inspectCanonicalYamlStorageCoreDb.js';
import { selectYamlStorageRawNodes } from '../yamlStorageRawSnapshotUtils.js';

const DATABASE_NAME = 'yaml-storage-activation-test';
const VALID_DIGEST = '0123456789abcdef'.repeat(4);

function legacyNode(id = 'yaml-1'): Record<string, unknown> {
  return {
    id,
    parentId: 'p:root',
    nodeType: 'yaml-file',
    depth: 1,
    createdAt: 1,
    updatedAt: 1,
    version: 1,
    metadata: { name: 'scenario.yml' },
    draftMetadata: null,
    data: {
      name: 'scenario.yml',
      schemaId: 'ide-gsm/scenario',
      content: 'name: demo\n',
    },
  };
}

function canonicalNode(id = 'yaml-canonical'): Record<string, unknown> {
  return {
    ...legacyNode(id),
    data: {
      subtype: 'scenario',
      schemaId: 'ide-gsm/scenario',
      content: 'name: demo\n',
    },
  };
}

function createV1Schema(database: IDBDatabase): void {
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
  const tagAssociations = database.createObjectStore('tagAssociations', { keyPath: 'id' });
  tagAssociations.createIndex('nodeId', 'nodeId');
  tagAssociations.createIndex('tagId', 'tagId');
  tagAssociations.createIndex('scope', 'scope');
  tagAssociations.createIndex('createdAt', 'createdAt');
  tagAssociations.createIndex('[nodeId+tagId+scope]', ['nodeId', 'tagId', 'scope'], {
    unique: true,
  });
}

function seedV1Database(
  factory: IDBFactory,
  rawNodes: readonly Record<string, unknown>[] = [legacyNode()]
): Promise<void> {
  return new Promise((resolve, reject) => {
    const request = factory.open(DATABASE_NAME, 1);
    request.onerror = () => reject(new Error('seed-open-failed'));
    request.onupgradeneeded = () => {
      createV1Schema(request.result);
      const nodes = request.transaction?.objectStore('nodes');
      if (nodes === undefined) throw new Error('seed-transaction-missing');
      for (const rawNode of rawNodes) nodes.add(rawNode);
    };
    request.onsuccess = () => {
      request.result.close();
      resolve();
    };
  });
}

function openDatabase(factory: IDBFactory): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = factory.open(DATABASE_NAME);
    request.onerror = () => reject(new Error('open-failed'));
    request.onsuccess = () => resolve(request.result);
  });
}

function readAll(store: IDBObjectStore): Promise<readonly unknown[]> {
  return new Promise((resolve, reject) => {
    const request = store.getAll();
    request.onerror = () => reject(new Error('read-failed'));
    request.onsuccess = () => resolve(request.result);
  });
}

async function readDatabaseSnapshot(factory: IDBFactory): Promise<{
  readonly version: number;
  readonly nodes: readonly unknown[];
  readonly journal: readonly unknown[];
}> {
  const database = await openDatabase(factory);
  try {
    const transaction = database.transaction(['nodes', 'yamlMigrationJournal'], 'readonly');
    const [nodes, journal] = await Promise.all([
      readAll(transaction.objectStore('nodes')),
      readAll(transaction.objectStore('yamlMigrationJournal')),
    ]);
    return { version: database.version, nodes, journal };
  } finally {
    database.close();
  }
}

async function overwriteNode(factory: IDBFactory, rawNode: Record<string, unknown>): Promise<void> {
  const database = await openDatabase(factory);
  await new Promise<void>((resolve, reject) => {
    const transaction = database.transaction('nodes', 'readwrite');
    transaction.objectStore('nodes').put(rawNode);
    transaction.onerror = () => reject(new Error('overwrite-failed'));
    transaction.onabort = () => reject(new Error('overwrite-aborted'));
    transaction.oncomplete = () => resolve();
  });
  database.close();
}

function preflightState(activationId: string): YamlStoragePreflightState {
  const created = createYamlStorageActivation({
    activationId,
    currentVersion: 1,
    targetVersion: 2,
  });
  if (!created.ok) throw new Error('activation-create-failed');
  const state = reduceYamlStorageActivation(created.state, {
    type: 'quiescing-completed',
    activationId,
  });
  if (state.phase !== 'preflight') throw new Error('preflight-state-failed');
  return state;
}

function activationInput(factory: IDBFactory, activationId: string, initializeCoreDb = vi.fn()) {
  return {
    state: preflightState(activationId),
    databaseName: DATABASE_NAME,
    migrationId: `migration-${activationId}`,
    openRequestId: `open-${activationId}`,
    environment: {
      indexedDB: factory,
      digestSha256Hex: async () => VALID_DIGEST,
      initializeCoreDb,
    },
  };
}

describe('single CoreDB YAML storage activation', () => {
  let factory: IDBFactory;

  beforeEach(() => {
    factory = new IDBFactory();
  });

  it('upgrades v1 exactly once and publishes canonical-ready only after initialization', async () => {
    await seedV1Database(factory);
    const initializeCoreDb = vi.fn(async () => undefined);

    const result = await activateYamlStorageCoreDb(
      activationInput(factory, 'activation-1', initializeCoreDb)
    );

    expect(result.ok).toBe(true);
    if (!result.ok) throw new Error('activation-failed');
    expect(result.state).toMatchObject({
      phase: 'canonical-ready',
      readinessProof: 'same-activation-upgrade',
      initializationSucceeded: true,
    });
    expect(initializeCoreDb).toHaveBeenCalledTimes(1);
    const snapshot = await readDatabaseSnapshot(factory);
    expect(snapshot.version).toBe(2);
    expect(snapshot.journal).toHaveLength(1);
    expect(snapshot.nodes).toHaveLength(1);
    expect(snapshot.nodes[0]).toMatchObject({
      id: 'yaml-1',
      data: {
        subtype: 'scenario',
        schemaId: 'ide-gsm/scenario',
        content: 'name: demo\n',
      },
    });
    expect((snapshot.nodes[0] as { data?: { name?: unknown } }).data?.name).toBeUndefined();
  });

  it('creates an absent CoreDB directly at canonical v2 without migration journal rows', async () => {
    const initializeCoreDb = vi.fn(async () => undefined);

    const result = await activateYamlStorageCoreDb(
      activationInput(factory, 'fresh-install', initializeCoreDb)
    );

    expect(result.ok).toBe(true);
    if (!result.ok) throw new Error('fresh-activation-failed');
    expect(result.state).toMatchObject({
      phase: 'canonical-ready',
      currentVersion: 0,
      targetVersion: 2,
      readinessProof: 'same-activation-fresh-create',
    });
    expect(initializeCoreDb).toHaveBeenCalledTimes(1);
    const snapshot = await readDatabaseSnapshot(factory);
    expect(snapshot).toEqual({ version: 2, nodes: [], journal: [] });
  });

  it.each([
    ['an empty v1 database', []],
    ['an already-canonical v1 cohort', [canonicalNode()]],
  ] as const)('upgrades %s with zero migration journal rows', async (_label, rawNodes) => {
    await seedV1Database(factory, rawNodes);

    const result = await activateYamlStorageCoreDb(activationInput(factory, 'zero-write'));

    expect(result.ok).toBe(true);
    if (!result.ok) throw new Error('zero-write-activation-failed');
    expect(result.state.readinessProof).toBe('same-activation-upgrade');
    const snapshot = await readDatabaseSnapshot(factory);
    expect(snapshot.version).toBe(2);
    expect(snapshot.journal).toEqual([]);
  });

  it('does not issue the v2 target open when migration preflight rejects the cohort', async () => {
    const invalid = legacyNode();
    invalid.data = {
      name: 'scenario.yml',
      schemaId: 'ide-gsm/scenario',
      content: 'invalid: [\n',
    };
    await seedV1Database(factory, [invalid]);
    const open = vi.spyOn(factory, 'open');

    const result = await activateYamlStorageCoreDb(activationInput(factory, 'invalid-preflight'));

    expect(result).toMatchObject({
      ok: false,
      error: { code: 'MIGRATION_PREFLIGHT_FAILED' },
    });
    expect(open.mock.calls).toEqual([[DATABASE_NAME]]);
    const database = await openDatabase(factory);
    expect(database.version).toBe(1);
    expect(Array.from(database.objectStoreNames)).not.toContain('yamlMigrationJournal');
    database.close();
  });

  it('aborts all node and schema changes when a journal write throws', async () => {
    await seedV1Database(factory);
    const originalAdd = IDBObjectStore.prototype.add;
    const add = vi.spyOn(IDBObjectStore.prototype, 'add').mockImplementation(function (
      this: IDBObjectStore,
      value: unknown,
      key?: IDBValidKey
    ) {
      if (this.name === 'yamlMigrationJournal') throw new Error('journal-write-failed');
      return key === undefined ? originalAdd.call(this, value) : originalAdd.call(this, value, key);
    });

    try {
      const result = await activateYamlStorageCoreDb(activationInput(factory, 'journal-failure'));

      expect(result).toMatchObject({
        ok: false,
        error: { code: 'MIGRATION_UPGRADE_FAILED' },
      });
    } finally {
      add.mockRestore();
    }
    const database = await openDatabase(factory);
    expect(database.version).toBe(1);
    expect(Array.from(database.objectStoreNames)).not.toContain('yamlMigrationJournal');
    expect(await readAll(database.transaction('nodes', 'readonly').objectStore('nodes'))).toEqual([
      legacyNode(),
    ]);
    database.close();
  });

  it('allows revoked successor boots only after exact v2 canonical validation', async () => {
    await seedV1Database(factory);
    const activated = await activateYamlStorageCoreDb(activationInput(factory, 'winner'));
    expect(activated.ok).toBe(true);

    for (const successorId of ['reload', 'new-tab']) {
      const initializeCoreDb = vi.fn(async () => undefined);
      const result = await inspectCanonicalYamlStorageCoreDb({
        activationId: successorId,
        databaseName: DATABASE_NAME,
        targetVersion: 2,
        openRequestId: `open-${successorId}`,
        coordinatorGate: 'revoked-ready-for-preflight',
        environment: {
          indexedDB: factory,
          digestSha256Hex: async () => VALID_DIGEST,
          initializeCoreDb,
        },
      });
      expect(result.ok).toBe(true);
      if (!result.ok) throw new Error('successor-validation-failed');
      expect(result.state.readinessProof).toBe('post-activation-boot');
      expect(initializeCoreDb).toHaveBeenCalledTimes(1);
    }
  });

  it('does not create CoreDB while a revoked successor inspects an absent database', async () => {
    const result = await inspectCanonicalYamlStorageCoreDb({
      activationId: 'missing-successor',
      databaseName: DATABASE_NAME,
      targetVersion: 2,
      openRequestId: 'open-missing-successor',
      coordinatorGate: 'revoked-ready-for-preflight',
      environment: {
        indexedDB: factory,
        digestSha256Hex: async () => VALID_DIGEST,
        initializeCoreDb: vi.fn(),
      },
    });

    expect(result).toMatchObject({ ok: false, error: { code: 'CORE_DB_NOT_FOUND' } });
    expect(await factory.databases()).toEqual([]);
  });

  it('aborts the versionchange transaction when the raw YAML cohort changes after preflight', async () => {
    await seedV1Database(factory);
    const input = activationInput(factory, 'snapshot-race');
    let changed = false;
    const result = await activateYamlStorageCoreDb({
      ...input,
      environment: {
        ...input.environment,
        digestSha256Hex: async () => {
          if (!changed) {
            changed = true;
            const changedNode = legacyNode();
            changedNode.version = 2;
            await overwriteNode(factory, changedNode);
          }
          return VALID_DIGEST;
        },
      },
    });

    expect(result.ok).toBe(false);
    if (result.ok === true) throw new Error('snapshot-race-was-accepted');
    expect(result.error.code).toBe('MIGRATION_SNAPSHOT_MISMATCH');
    expect(result.state.phase).toBe('rejected');
    const database = await openDatabase(factory);
    expect(database.version).toBe(1);
    expect(Array.from(database.objectStoreNames)).not.toContain('yamlMigrationJournal');
    database.close();
  });

  it('elects one storage executor when two distinct contenders race', async () => {
    await seedV1Database(factory);

    const results = await Promise.all([
      activateYamlStorageCoreDb(activationInput(factory, 'contender-a')),
      activateYamlStorageCoreDb(activationInput(factory, 'contender-b')),
    ]);

    expect(results.filter((result) => result.ok)).toHaveLength(1);
    expect(results.filter((result) => !result.ok)).toHaveLength(1);
    const snapshot = await readDatabaseSnapshot(factory);
    expect(snapshot.version).toBe(2);
    expect(snapshot.journal).toHaveLength(1);
  });

  it('keeps one blocked target request alive until the stale v1 connection closes', async () => {
    await seedV1Database(factory);
    const blocker = await openDatabase(factory);
    blocker.onversionchange = () => {
      setTimeout(() => blocker.close(), 0);
    };

    const result = await activateYamlStorageCoreDb(activationInput(factory, 'blocked'));

    expect(result.ok).toBe(true);
    if (!result.ok) throw new Error('blocked-request-failed');
    expect(result.state.phase).toBe('canonical-ready');
  });

  it('rejects post-activation boot when v2 still contains a legacy YAML payload', async () => {
    await seedV1Database(factory);
    const database = await openDatabase(factory);
    database.close();
    await new Promise<void>((resolve, reject) => {
      const request = factory.open(DATABASE_NAME, 2);
      request.onerror = () => reject(new Error('manual-v2-open-failed'));
      request.onupgradeneeded = () => {
        const journal = request.result.createObjectStore('yamlMigrationJournal', {
          keyPath: ['migrationId', 'nodeId', 'slot'],
        });
        journal.createIndex('[migrationId+fromCoreDbVersion+toCoreDbVersion]', [
          'migrationId',
          'fromCoreDbVersion',
          'toCoreDbVersion',
        ]);
      };
      request.onsuccess = () => {
        request.result.close();
        resolve();
      };
    });

    const result = await inspectCanonicalYamlStorageCoreDb({
      activationId: 'interrupted',
      databaseName: DATABASE_NAME,
      targetVersion: 2,
      openRequestId: 'open-interrupted',
      coordinatorGate: 'revoked-ready-for-preflight',
      environment: {
        indexedDB: factory,
        digestSha256Hex: async () => VALID_DIGEST,
        initializeCoreDb: vi.fn(),
      },
    });

    expect(result.ok).toBe(false);
    if (result.ok === true) throw new Error('legacy-v2-was-accepted');
    expect(result.error.code).toBe('POST_ACTIVATION_CANONICAL_VALIDATION_FAILED');
  });

  it('rejects accessor-backed raw records without invoking the accessor', () => {
    const getter = vi.fn(() => 'yaml-file');
    const rawNode = { id: 'unsafe' };
    Object.defineProperty(rawNode, 'nodeType', { get: getter, enumerable: true });

    expect(selectYamlStorageRawNodes([rawNode])).toEqual({ ok: false });
    expect(getter).not.toHaveBeenCalled();
  });
});
