import { createHash } from 'node:crypto';
import {
  CORE_DB_CANONICAL_LOGICAL_VERSION,
  CORE_DB_CANONICAL_NATIVE_VERSION,
  CORE_DB_LEGACY_LOGICAL_VERSION,
  CORE_DB_LEGACY_NATIVE_VERSION,
} from '@hierarchidb/runtime-worker/yaml-storage-production';
import { IDBFactory } from 'fake-indexeddb';
import { describe, expect, it, vi } from 'vitest';
import { runYamlStorageProductionPreflight } from '../runYamlStorageProductionPreflight.js';

const DATABASE_PREFIX = 'hierarchidb';
const RELEASE_VERSION = 'a'.repeat(40);
const TIMESTAMP = '2026-08-21T00:00:00.000Z';
const FIXED_DIGEST = 'b'.repeat(64);

function createCoreV1Stores(database: IDBDatabase): void {
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

function createJournalStore(database: IDBDatabase): IDBObjectStore {
  const store = database.createObjectStore('yamlMigrationJournal', {
    keyPath: ['migrationId', 'nodeId', 'slot'],
  });
  store.createIndex('[migrationId+fromCoreDbVersion+toCoreDbVersion]', [
    'migrationId',
    'fromCoreDbVersion',
    'toCoreDbVersion',
  ]);
  return store;
}

function createDatabase(
  factory: IDBFactory,
  name: string,
  version: number,
  upgrade: (database: IDBDatabase, transaction: IDBTransaction) => void
): Promise<void> {
  return new Promise((resolve, reject) => {
    const request = factory.open(name, version);
    request.onupgradeneeded = () => {
      const transaction = request.transaction;
      if (transaction === null) throw new Error('seed-transaction-missing');
      upgrade(request.result, transaction);
    };
    request.onerror = () => reject(new Error('seed-open-failed'));
    request.onsuccess = () => {
      request.result.close();
      resolve();
    };
  });
}

function seedCoordinator(factory: IDBFactory, state: unknown): Promise<void> {
  return createDatabase(
    factory,
    `${DATABASE_PREFIX}-origin-coordinator`,
    2,
    (database, transaction) => {
      const store = database.createObjectStore('coordinator-state', { keyPath: 'key' });
      transaction.objectStore(store.name).add(state);
    }
  );
}

function seedCore(
  factory: IDBFactory,
  version: 1 | 2,
  includeJournalRecord = false
): Promise<void> {
  const nativeVersion =
    version === CORE_DB_LEGACY_LOGICAL_VERSION
      ? CORE_DB_LEGACY_NATIVE_VERSION
      : CORE_DB_CANONICAL_NATIVE_VERSION;
  return createDatabase(factory, `${DATABASE_PREFIX}-core`, nativeVersion, (database) => {
    createCoreV1Stores(database);
    if (version === 2) {
      const journal = createJournalStore(database);
      if (includeJournalRecord) {
        journal.add({
          migrationId: 'migration-1',
          fromCoreDbVersion: 1,
          toCoreDbVersion: 2,
          nodeId: 'node-1',
          slot: 'committed',
          preimageRepresentation: 'legacy-with-name',
          legacyName: 'scenario.yml',
          canonicalPostimageDigest: FIXED_DIGEST,
        });
      }
    }
  });
}

function seedYaml(
  factory: IDBFactory,
  rows: readonly Record<string, unknown>[] = [
    {
      nodeId: 'yaml-1',
      parentId: 'folder-1',
      name: 'scenario.yml',
      schemaId: 'ide-gsm/scenario',
      content: 'name: demo\n',
    },
  ],
  version = 1
): Promise<void> {
  return createDatabase(factory, `${DATABASE_PREFIX}-yaml`, version, (database) => {
    const store = database.createObjectStore('nodes', { keyPath: 'nodeId' });
    store.createIndex('parentId', 'parentId');
    for (const row of rows) store.add(row);
  });
}

const allowedState = Object.freeze({
  key: 'yaml-storage',
  protocolVersion: 2,
  phase: 'allowed',
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
    Object.freeze({ participantKind: 'worker', participantId: 'worker-1' }),
  ]),
  evidence: Object.freeze([
    Object.freeze({
      participantKind: 'tab',
      participantId: 'window-1',
      outcome: 'acknowledged',
    }),
    Object.freeze({
      participantKind: 'worker',
      participantId: 'worker-1',
      outcome: 'discarded',
    }),
  ]),
});

function input(factory: IDBFactory, mode: 'pre' | 'post') {
  return {
    mode,
    factory,
    databasePrefix: DATABASE_PREFIX,
    releaseVersion: RELEASE_VERSION,
    timestamp: TIMESTAMP,
    digestSha256Hex: vi.fn(async () => FIXED_DIGEST),
  } as const;
}

async function seedPreDatabases(factory: IDBFactory): Promise<void> {
  await seedCoordinator(factory, allowedState);
  await seedCore(factory, 1);
  await seedYaml(factory);
}

async function seedPostDatabases(factory: IDBFactory): Promise<void> {
  await seedCoordinator(factory, readyState);
  await seedCore(factory, 2, true);
  await seedYaml(factory);
}

describe('runYamlStorageProductionPreflight', () => {
  it('accepts only the exact pre-activation topology and allowed state', async () => {
    const factory = new IDBFactory();
    await seedPreDatabases(factory);

    const result = await runYamlStorageProductionPreflight(input(factory, 'pre'));

    expect(result).toEqual({
      mode: 'pre',
      status: 'accepted',
      code: 'PREFLIGHT_ACCEPTED',
      timestamp: TIMESTAMP,
      releaseVersion: RELEASE_VERSION,
      coordinator: {
        databaseVersion: 2,
        protocolVersion: 2,
        phase: 'allowed',
        topologyStatus: 'exact',
        participantCount: 0,
        evidenceCount: 0,
      },
      coreDb: {
        logicalVersion: CORE_DB_LEGACY_LOGICAL_VERSION,
        nativeVersion: CORE_DB_LEGACY_NATIVE_VERSION,
        topologyStatus: 'exact',
        journalTopologyStatus: 'absent',
      },
      yamlDb: {
        databaseVersion: 1,
        topologyStatus: 'exact',
        rowCount: 1,
        digestSha256: FIXED_DIGEST,
      },
    });
  });

  it('accepts only the exact post-activation topology and revoked-ready state', async () => {
    const factory = new IDBFactory();
    await seedPostDatabases(factory);

    const result = await runYamlStorageProductionPreflight(input(factory, 'post'));

    expect(result).toMatchObject({
      mode: 'post',
      status: 'accepted',
      code: 'PREFLIGHT_ACCEPTED',
      coordinator: {
        phase: 'revoked',
        stateStatus: 'ready-for-preflight',
        participantCount: 2,
        evidenceCount: 2,
      },
      coreDb: {
        logicalVersion: CORE_DB_CANONICAL_LOGICAL_VERSION,
        nativeVersion: CORE_DB_CANONICAL_NATIVE_VERSION,
        topologyStatus: 'exact',
        journalTopologyStatus: 'exact',
        journalRecordCount: 1,
      },
      yamlDb: { rowCount: 1, digestSha256: FIXED_DIGEST },
    });
  });

  it('does not call open when any required database is missing', async () => {
    const factory = new IDBFactory();
    await seedCoordinator(factory, allowedState);
    await seedCore(factory, 1);
    const open = vi.spyOn(factory, 'open');

    const result = await runYamlStorageProductionPreflight(input(factory, 'pre'));

    expect(result).toMatchObject({ status: 'rejected', code: 'YAML_DATABASE_NOT_FOUND' });
    expect(open).not.toHaveBeenCalled();
    expect(
      (await factory.databases()).some((entry) => entry.name === `${DATABASE_PREFIX}-yaml`)
    ).toBe(false);
  });

  it('does not call open or upgrade when a required database version differs', async () => {
    const factory = new IDBFactory();
    await seedCoordinator(factory, allowedState);
    await seedCore(factory, 1);
    await seedYaml(factory, [], 2);
    const open = vi.spyOn(factory, 'open');

    const result = await runYamlStorageProductionPreflight(input(factory, 'pre'));

    expect(result).toMatchObject({
      status: 'rejected',
      code: 'YAML_DATABASE_VERSION_MISMATCH',
    });
    expect(open).not.toHaveBeenCalled();
    expect(await factory.databases()).toContainEqual({
      name: `${DATABASE_PREFIX}-yaml`,
      version: 2,
    });
  });

  it('rejects a logical CoreDB version encoded as the native database version', async () => {
    const factory = new IDBFactory();
    await seedCoordinator(factory, allowedState);
    await createDatabase(
      factory,
      `${DATABASE_PREFIX}-core`,
      CORE_DB_LEGACY_LOGICAL_VERSION,
      (database) => createCoreV1Stores(database)
    );
    await seedYaml(factory);
    const open = vi.spyOn(factory, 'open');

    const result = await runYamlStorageProductionPreflight(input(factory, 'pre'));

    expect(result).toMatchObject({
      status: 'rejected',
      code: 'CORE_DATABASE_VERSION_MISMATCH',
    });
    expect(open).not.toHaveBeenCalled();
    expect(await factory.databases()).toContainEqual({
      name: `${DATABASE_PREFIX}-core`,
      version: CORE_DB_LEGACY_LOGICAL_VERSION,
    });
  });

  it('rejects an invalid build-time prefix before discovery or open', async () => {
    const factory = new IDBFactory();
    const databases = vi.spyOn(factory, 'databases');
    const open = vi.spyOn(factory, 'open');

    const result = await runYamlStorageProductionPreflight({
      ...input(factory, 'pre'),
      databasePrefix: ' hidb ',
    });

    expect(result).toEqual({ mode: 'pre', status: 'rejected', code: 'CONFIGURATION_INVALID' });
    expect(databases).not.toHaveBeenCalled();
    expect(open).not.toHaveBeenCalled();
  });

  it('sanitizes database discovery exceptions and does not proceed to open', async () => {
    const factory = new IDBFactory();
    vi.spyOn(factory, 'databases').mockRejectedValue(new Error('native-secret-database-name'));
    const open = vi.spyOn(factory, 'open');

    const result = await runYamlStorageProductionPreflight(input(factory, 'pre'));

    expect(result).toMatchObject({ status: 'rejected', code: 'DATABASE_DISCOVERY_FAILED' });
    expect(JSON.stringify(result)).not.toContain('native-secret-database-name');
    expect(open).not.toHaveBeenCalled();
  });

  it('rejects a coordinator record with any extra property', async () => {
    const factory = new IDBFactory();
    await seedCoordinator(factory, { ...allowedState, legacyName: 'yaml-storage' });
    await seedCore(factory, 1);
    await seedYaml(factory);

    await expect(runYamlStorageProductionPreflight(input(factory, 'pre'))).resolves.toMatchObject({
      status: 'rejected',
      code: 'COORDINATOR_STATE_MISMATCH',
    });
  });

  it('rejects duplicate post-activation participant identities', async () => {
    const factory = new IDBFactory();
    await seedCoordinator(factory, {
      ...readyState,
      participants: [
        { participantKind: 'tab', participantId: 'duplicate' },
        { participantKind: 'worker', participantId: 'duplicate' },
      ],
      evidence: [
        { participantKind: 'tab', participantId: 'duplicate', outcome: 'acknowledged' },
        { participantKind: 'worker', participantId: 'duplicate', outcome: 'discarded' },
      ],
    });
    await seedCore(factory, 2);
    await seedYaml(factory);

    await expect(runYamlStorageProductionPreflight(input(factory, 'post'))).resolves.toMatchObject({
      status: 'rejected',
      code: 'COORDINATOR_STATE_MISMATCH',
    });
  });

  it('rejects an inexact CoreDB topology instead of accepting extra stores', async () => {
    const factory = new IDBFactory();
    await seedCoordinator(factory, allowedState);
    await createDatabase(
      factory,
      `${DATABASE_PREFIX}-core`,
      CORE_DB_LEGACY_NATIVE_VERSION,
      (database) => {
        createCoreV1Stores(database);
        database.createObjectStore('legacyFallback', { keyPath: 'id' });
      }
    );
    await seedYaml(factory);

    await expect(runYamlStorageProductionPreflight(input(factory, 'pre'))).resolves.toMatchObject({
      status: 'rejected',
      code: 'CORE_SCHEMA_MISMATCH',
    });
  });

  it('rejects an inexact YamlDB topology instead of reading rows', async () => {
    const factory = new IDBFactory();
    await seedCoordinator(factory, allowedState);
    await seedCore(factory, 1);
    await createDatabase(factory, `${DATABASE_PREFIX}-yaml`, 1, (database) => {
      const store = database.createObjectStore('nodes', { keyPath: 'nodeId' });
      store.createIndex('parentId', 'parentId');
      store.createIndex('legacyName', 'name');
    });

    await expect(runYamlStorageProductionPreflight(input(factory, 'pre'))).resolves.toMatchObject({
      status: 'rejected',
      code: 'YAML_SCHEMA_MISMATCH',
    });
  });

  it('sanitizes digest failures without exposing rows or native errors', async () => {
    const factory = new IDBFactory();
    await seedPreDatabases(factory);
    const testInput = input(factory, 'pre');
    const result = await runYamlStorageProductionPreflight({
      ...testInput,
      digestSha256Hex: async () => {
        throw new Error('name: secret-content');
      },
    });
    const serialized = JSON.stringify(result);

    expect(result).toMatchObject({ status: 'rejected', code: 'YAML_DIGEST_FAILED' });
    expect(serialized).not.toContain('secret-content');
    expect(serialized).not.toContain('scenario.yml');
    expect(serialized).not.toContain('yaml-1');
  });

  it('rejects a non-SHA-256 digest without exposing partial evidence', async () => {
    const factory = new IDBFactory();
    await seedPreDatabases(factory);
    const result = await runYamlStorageProductionPreflight({
      ...input(factory, 'pre'),
      digestSha256Hex: async () => 'not-a-digest',
    });

    expect(result).toMatchObject({ status: 'rejected', code: 'YAML_DIGEST_FAILED' });
    expect(result).not.toHaveProperty('coordinator');
    expect(result).not.toHaveProperty('coreDb');
    expect(result).not.toHaveProperty('yamlDb');
  });

  it('produces the same digest for equivalent rows with different object insertion order', async () => {
    const firstFactory = new IDBFactory();
    const secondFactory = new IDBFactory();
    await seedCoordinator(firstFactory, allowedState);
    await seedCore(firstFactory, 1);
    await seedYaml(firstFactory, [
      {
        nodeId: 'yaml-1',
        parentId: 'folder-1',
        name: 'scenario.yml',
        schemaId: 'schema',
        content: 'x',
      },
    ]);
    await seedCoordinator(secondFactory, allowedState);
    await seedCore(secondFactory, 1);
    await seedYaml(secondFactory, [
      {
        content: 'x',
        schemaId: 'schema',
        name: 'scenario.yml',
        parentId: 'folder-1',
        nodeId: 'yaml-1',
      },
    ]);
    const digestSha256Hex = async (bytes: Uint8Array): Promise<string> =>
      createHash('sha256').update(bytes).digest('hex');

    const first = await runYamlStorageProductionPreflight({
      ...input(firstFactory, 'pre'),
      digestSha256Hex,
    });
    const second = await runYamlStorageProductionPreflight({
      ...input(secondFactory, 'pre'),
      digestSha256Hex,
    });

    expect(first.status).toBe('accepted');
    expect(second.status).toBe('accepted');
    if (first.status !== 'accepted' || second.status !== 'accepted') {
      throw new Error('digest-preflight-rejected');
    }
    expect(first.yamlDb.digestSha256).toBe(second.yamlDb.digestSha256);
  });
});
