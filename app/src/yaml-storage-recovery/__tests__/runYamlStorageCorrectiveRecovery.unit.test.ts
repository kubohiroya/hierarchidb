import { IDBFactory } from 'fake-indexeddb';
import { describe, expect, it, vi } from 'vitest';
import { createYamlStorageCorrectiveRecoveryClaim } from '../createYamlStorageCorrectiveRecoveryClaim.js';
import { inspectYamlStorageCorrectiveRecovery } from '../inspectYamlStorageCorrectiveRecovery.js';
import { runYamlStorageCorrectiveRecovery } from '../runYamlStorageCorrectiveRecovery.js';

const RELEASE_VERSION = 'a'.repeat(40);
const FINGERPRINT = 'b'.repeat(64);
const TIMESTAMP = '2026-08-21T00:00:00.000Z';
const DATABASE_NAMES = Object.freeze({
  coordinator: 'hierarchidb-origin-coordinator',
  canonicalCore: 'hierarchidb-core',
  interruptedCore: 'hidb-core',
  yaml: 'hierarchidb-yaml',
  recovery: 'hierarchidb-yaml-storage-recovery',
});

const readyState = Object.freeze({
  key: 'yaml-storage',
  protocolVersion: 2,
  phase: 'revoked',
  status: 'ready-for-preflight',
  activationId: 'activation-1',
  quiescenceRequestId: 'quiescence-1',
  participants: Object.freeze([
    Object.freeze({ participantKind: 'tab', participantId: 'window-1' }),
  ]),
  evidence: Object.freeze([
    Object.freeze({
      participantKind: 'tab',
      participantId: 'window-1',
      outcome: 'acknowledged',
    }),
  ]),
});

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

function seedInterruptedCore(factory: IDBFactory, withRecord: boolean): Promise<void> {
  return new Promise((resolve, reject) => {
    const request = factory.open(DATABASE_NAMES.interruptedCore, 2);
    request.onupgradeneeded = () => {
      createCoreV2Stores(request.result);
      if (withRecord) {
        const transaction = request.transaction;
        if (transaction === null) throw new Error('interrupted-transaction-missing');
        transaction.objectStore('nodes').add({ id: 'unexpected-record' });
      }
    };
    request.onerror = () => reject(new Error('interrupted-seed-failed'));
    request.onsuccess = () => {
      request.result.close();
      resolve();
    };
  });
}

function seedYaml(factory: IDBFactory): Promise<void> {
  return new Promise((resolve, reject) => {
    const request = factory.open(DATABASE_NAMES.yaml, 1);
    request.onupgradeneeded = () => {
      const transaction = request.transaction;
      if (transaction === null) throw new Error('yaml-transaction-missing');
      const store = request.result.createObjectStore('nodes', { keyPath: 'nodeId' });
      store.createIndex('parentId', 'parentId');
      transaction.objectStore(store.name).add({
        nodeId: 'yaml-1',
        parentId: 'folder-1',
        name: 'scenario.yml',
        schemaId: 'ide-gsm/scenario',
        content: 'name: demo\n',
      });
    };
    request.onerror = () => reject(new Error('yaml-seed-failed'));
    request.onsuccess = () => {
      request.result.close();
      resolve();
    };
  });
}

function seedCoordinator(factory: IDBFactory): Promise<void> {
  return new Promise((resolve, reject) => {
    const request = factory.open(DATABASE_NAMES.coordinator, 2);
    request.onupgradeneeded = () => {
      const transaction = request.transaction;
      if (transaction === null) throw new Error('coordinator-transaction-missing');
      const store = request.result.createObjectStore('coordinator-state', { keyPath: 'key' });
      transaction.objectStore(store.name).add(readyState);
    };
    request.onerror = () => reject(new Error('coordinator-seed-failed'));
    request.onsuccess = () => {
      request.result.close();
      resolve();
    };
  });
}

function input(factory: IDBFactory, expectedFingerprint = FINGERPRINT) {
  return {
    factory,
    databaseNames: DATABASE_NAMES,
    recoveryReleaseId: 'incident-1388-v1',
    expectedCoordinatorFingerprintSha256: expectedFingerprint,
    recoveryReleaseVersion: RELEASE_VERSION,
    timestamp: TIMESTAMP,
    openRequestId: 'open-1',
    digestSha256Hex: vi.fn(async () => FINGERPRINT),
    initializeCoreDb: vi.fn(async () => undefined),
  } as const;
}

function claimInput(factory: IDBFactory, openRequestId: string) {
  return {
    factory,
    recoveryDatabaseName: DATABASE_NAMES.recovery,
    recoveryReleaseId: 'incident-1388-v1',
    coordinatorFingerprintSha256: FINGERPRINT,
    recoveryReleaseVersion: RELEASE_VERSION,
    openRequestId,
    interruptedCoreDatabaseStatus: 'missing' as const,
    yamlDatabaseStatus: 'missing' as const,
    yamlRowCount: null,
    yamlDigestSha256: null,
  };
}

describe('runYamlStorageCorrectiveRecovery', () => {
  it('runs once from exact revoked evidence and accepts exact post-state', async () => {
    const factory = new IDBFactory();
    await seedCoordinator(factory);
    await seedInterruptedCore(factory, false);
    await seedYaml(factory);
    const databasesSpy = vi.spyOn(factory, 'databases');

    const result = await runYamlStorageCorrectiveRecovery(input(factory));
    expect(databasesSpy).toHaveBeenCalledTimes(1);
    const post = await inspectYamlStorageCorrectiveRecovery({
      stage: 'recovery-post',
      factory,
      databaseNames: DATABASE_NAMES,
      releaseVersion: RELEASE_VERSION,
      timestamp: TIMESTAMP,
      digestSha256Hex: async () => FINGERPRINT,
    });

    expect(result).toEqual({ ok: true, status: 'recovered' });
    expect(post).toMatchObject({
      mode: 'recovery-post',
      status: 'accepted',
      code: 'RECOVERY_INVENTORY_ACCEPTED',
      canonicalCoreDb: { status: 'exact-v2', logicalVersion: 2, nativeVersion: 20 },
      interruptedCoreDb: { status: 'empty-native-v2' },
      yamlDb: { status: 'exact-v1', rowCount: 1, digestSha256: FINGERPRINT },
      recoveryClaim: { status: 'completed', recoveryReleaseId: 'incident-1388-v1' },
    });
  });

  it('rejects a nonempty interrupted hidb-core before creating the durable claim', async () => {
    const factory = new IDBFactory();
    await seedCoordinator(factory);
    await seedInterruptedCore(factory, true);

    const result = await runYamlStorageCorrectiveRecovery(input(factory));

    expect(result).toEqual({ ok: false, code: 'RECOVERY_INTERRUPTED_CORE_UNSAFE' });
    expect(await factory.databases()).not.toEqual(
      expect.arrayContaining([expect.objectContaining({ name: DATABASE_NAMES.recovery })])
    );
  });

  it('does not create a claim or target on coordinator fingerprint mismatch', async () => {
    const factory = new IDBFactory();
    await seedCoordinator(factory);

    const result = await runYamlStorageCorrectiveRecovery(input(factory, 'c'.repeat(64)));

    expect(result).toEqual({ ok: false, code: 'RECOVERY_COORDINATOR_FINGERPRINT_MISMATCH' });
    expect(await factory.databases()).toEqual([
      expect.objectContaining({ name: DATABASE_NAMES.coordinator, version: 2 }),
    ]);
  });

  it('selects exactly one claimant across concurrent origin contexts', async () => {
    const factory = new IDBFactory();

    const results = await Promise.all([
      createYamlStorageCorrectiveRecoveryClaim(claimInput(factory, 'open-a')),
      createYamlStorageCorrectiveRecoveryClaim(claimInput(factory, 'open-b')),
    ]);

    expect(results.filter((result) => result.ok)).toHaveLength(1);
    expect(results.filter((result) => !result.ok)).toEqual([
      { ok: false, code: 'RECOVERY_CLAIM_ALREADY_EXISTS' },
    ]);
    const winner = results.find((result) => result.ok);
    if (winner?.ok) winner.database.close();
  });

  it('rejects any database-name authority divergence before storage access', async () => {
    const factory = new IDBFactory();
    const invalidInput = {
      ...input(factory),
      databaseNames: Object.freeze({
        ...DATABASE_NAMES,
        canonicalCore: 'hidb-core',
      }),
    };

    const result = await runYamlStorageCorrectiveRecovery(invalidInput);

    expect(result).toEqual({ ok: false, code: 'RECOVERY_CONFIGURATION_INVALID' });
    expect(await factory.databases()).toEqual([]);
  });
});
