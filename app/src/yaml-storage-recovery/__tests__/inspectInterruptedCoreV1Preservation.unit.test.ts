import { IDBFactory, IDBObjectStore } from 'fake-indexeddb';
import { describe, expect, it, vi } from 'vitest';
import { inspectInterruptedCoreV1Preservation } from '../inspectInterruptedCoreV1Preservation.js';

const RELEASE_VERSION = 'c'.repeat(40);
const TIMESTAMP = '2026-08-22T00:00:00.000Z';
const DATABASE_NAME = 'hidb-core';
const NATIVE_VERSION = 10;
const VALID_DIGEST = '0123456789abcdef'.repeat(4);
const ZERO_ADDITIONAL_NODE_TYPE_COUNTS = {
  yamlFile: 0,
  yaml: 0,
  file: 0,
  folder: 0,
  otherString: 0,
};
const ZERO_ADDITIONAL_NODE_PAYLOAD_SHAPE_COUNTS = {
  legacyYamlPayload: 0,
  hostSplitYamlPayload: 0,
  canonicalYamlPayload: 0,
  mixedYamlPayload: 0,
  incompleteYamlPayload: 0,
  otherPayload: 0,
  noPayload: 0,
};

function createCoreV1Stores(database: IDBDatabase, extraStore = false): void {
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
  if (extraStore) database.createObjectStore('unexpected', { keyPath: 'id' });
}

function seedExact15(
  factory: IDBFactory,
  extraStore = false,
  invalidYamlMetadata = false
): Promise<void> {
  return new Promise((resolve, reject) => {
    const request = factory.open(DATABASE_NAME, NATIVE_VERSION);
    request.onupgradeneeded = () => {
      createCoreV1Stores(request.result, extraStore);
      if (extraStore) return;
      const transaction = request.transaction;
      if (transaction === null) throw new Error('seed-transaction-missing');
      const trees = transaction.objectStore('trees');
      const nodes = transaction.objectStore('nodes');
      const rootStates = transaction.objectStore('rootStates');
      for (const treeId of ['r', 'p'] as const) {
        const treeName = treeId === 'r' ? 'Resources' : 'Projects';
        trees.add({
          id: treeId,
          name: treeName,
          superRootId: `${treeId}:superRoot`,
          rootId: `${treeId}:root`,
          archiveRootId: `${treeId}:archive`,
        });
        for (const kind of ['root', 'archive'] as const) {
          nodes.add({
            parentId: `${treeId}:superRoot`,
            id: `${treeId}:${kind}`,
            nodeType: kind === 'root' ? 'folder' : 'archive',
            depth: 0,
            createdAt: 1,
            updatedAt: 1,
            version: 1,
            metadata: {
              name: kind === 'root' ? treeName : 'Archive',
              description: undefined,
              tags: [],
            },
            draftMetadata: null,
            data: null,
            draftData: undefined,
          });
        }
        for (const kind of ['root', 'archive', 'draft'] as const) {
          rootStates.add({ treeId, rootNodeId: `${treeId}:${kind}`, expanded: {} });
        }
      }
      nodes.add({
        id: 'yaml-1',
        parentId: 'p:root',
        nodeType: 'yaml-file',
        depth: 1,
        createdAt: 2,
        updatedAt: 2,
        version: 1,
        metadata: invalidYamlMetadata
          ? { description: 'sensitive-invalid-description', tags: ['important'] }
          : { name: 'scenario.yml', description: '', tags: ['important'] },
        draftMetadata: null,
        data: {
          name: 'scenario.yml',
          schemaId: 'ide-gsm/scenario',
          content: 'name: demo\n',
        },
        draftData: undefined,
      });
      transaction.objectStore('tags').add({
        id: 'tag-1',
        name: 'Important',
        color: '#ff0000',
        description: undefined,
        createdAt: 2,
      });
      transaction.objectStore('tagAssociations').add({
        id: 'yaml-1_tag-1_published',
        nodeId: 'yaml-1',
        tagId: 'tag-1',
        scope: 'published',
        assignedAt: 2,
      });
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
    digestSha256Hex: async () => VALID_DIGEST,
  });
}

describe('inspectInterruptedCoreV1Preservation', () => {
  it('reads all five stores once and emits only sanitized aggregate evidence', async () => {
    const factory = new IDBFactory();
    await seedExact15(factory);
    const databasesSpy = vi.spyOn(factory, 'databases');
    const getAllSpy = vi.spyOn(IDBObjectStore.prototype, 'getAll');

    try {
      const result = await inspectInterruptedCoreV1Preservation(input(factory));

      expect(databasesSpy).toHaveBeenCalledTimes(1);
      expect(getAllSpy).toHaveBeenCalledTimes(5);
      expect(result).toEqual({
        mode: 'recovery-interrupted-core-preservation',
        status: 'accepted',
        code: 'INTERRUPTED_CORE_V1_PRESERVATION_ACCEPTED',
        timestamp: TIMESTAMP,
        releaseVersion: RELEASE_VERSION,
        interruptedCoreDb: {
          nativeVersion: NATIVE_VERSION,
          topologyStatus: 'exact-logical-v1',
          preservation: {
            storeCounts: {
              trees: 2,
              nodes: 5,
              rootStates: 6,
              tags: 1,
              tagAssociations: 1,
              total: 15,
            },
            recordClassification: {
              exactDefault: 12,
              modifiedDefaultIdentity: 0,
              additional: 3,
              invalid: 0,
            },
            invalidDiagnostics: {
              byStore: {
                trees: 0,
                nodes: 0,
                rootStates: 0,
                tags: 0,
                tagAssociations: 0,
                total: 0,
              },
              byReason: {
                'record-shape': 0,
                'required-identity': 0,
                'required-field-contract': 0,
                'metadata-contract': 0,
                'relationship-contract': 0,
                'duplicate-identity': 0,
                'yaml-contract': 0,
              },
              byIdentityClass: {
                defaultIdentity: 0,
                additionalIdentity: 0,
                unavailableIdentity: 0,
              },
            },
            additionalNodeCounts: { yaml: 1, nonYaml: 0 },
            additionalNodeTypeCounts: {
              ...ZERO_ADDITIONAL_NODE_TYPE_COUNTS,
              yamlFile: 1,
            },
            additionalNodePayloadShapeCounts: {
              ...ZERO_ADDITIONAL_NODE_PAYLOAD_SHAPE_COUNTS,
              legacyYamlPayload: 1,
            },
            graphStatus: 'exact',
            yamlPlanningStatus: 'valid',
            yamlSlotCounts: {
              canonical: 0,
              legacyWithName: 1,
              hostSplitLegacy: 0,
              temporaryPlaceholder: 0,
              metadataOnlyDraft: 0,
            },
          },
        },
      });
      const serialized = JSON.stringify(result);
      expect(serialized).not.toContain('yaml-1');
      expect(serialized).not.toContain('scenario.yml');
      expect(serialized).not.toContain('Important');
      expect(serialized).not.toContain('name: demo');
    } finally {
      getAllSpy.mockRestore();
    }
  });

  it('preserves only the sanitized invalid-diagnostic allowlist at the app boundary', async () => {
    const factory = new IDBFactory();
    await seedExact15(factory, false, true);

    const result = await inspectInterruptedCoreV1Preservation(input(factory));

    expect(result).toEqual({
      mode: 'recovery-interrupted-core-preservation',
      status: 'rejected',
      code: 'INTERRUPTED_CORE_V1_PRESERVATION_SNAPSHOT_INVALID',
      timestamp: TIMESTAMP,
      releaseVersion: RELEASE_VERSION,
      interruptedCoreDb: {
        nativeVersion: NATIVE_VERSION,
        topologyStatus: 'exact-logical-v1',
        preservation: {
          storeCounts: {
            trees: 2,
            nodes: 5,
            rootStates: 6,
            tags: 1,
            tagAssociations: 1,
            total: 15,
          },
          recordClassification: {
            exactDefault: 12,
            modifiedDefaultIdentity: 0,
            additional: 2,
            invalid: 1,
          },
          invalidDiagnostics: {
            byStore: {
              trees: 0,
              nodes: 1,
              rootStates: 0,
              tags: 0,
              tagAssociations: 0,
              total: 1,
            },
            byReason: {
              'record-shape': 0,
              'required-identity': 0,
              'required-field-contract': 0,
              'metadata-contract': 1,
              'relationship-contract': 0,
              'duplicate-identity': 0,
              'yaml-contract': 0,
            },
            byIdentityClass: {
              defaultIdentity: 0,
              additionalIdentity: 1,
              unavailableIdentity: 0,
            },
          },
          additionalNodeCounts: { yaml: 0, nonYaml: 0 },
          additionalNodeTypeCounts: ZERO_ADDITIONAL_NODE_TYPE_COUNTS,
          additionalNodePayloadShapeCounts: ZERO_ADDITIONAL_NODE_PAYLOAD_SHAPE_COUNTS,
          graphStatus: 'not-evaluated',
          yamlPlanningStatus: 'not-run',
          yamlSlotCounts: null,
        },
      },
    });
    const serialized = JSON.stringify(result);
    expect(serialized).not.toContain('yaml-1');
    expect(serialized).not.toContain('sensitive-invalid-description');
    expect(serialized).not.toContain('name: demo');
  });

  it('rejects a topology mismatch before reading records', async () => {
    const factory = new IDBFactory();
    await seedExact15(factory, true);
    const getAllSpy = vi.spyOn(IDBObjectStore.prototype, 'getAll');

    try {
      const result = await inspectInterruptedCoreV1Preservation(input(factory));

      expect(result).toMatchObject({
        status: 'rejected',
        code: 'INTERRUPTED_CORE_V1_PRESERVATION_TOPOLOGY_MISMATCH',
        interruptedCoreDb: { nativeVersion: NATIVE_VERSION, topologyStatus: 'mismatch' },
      });
      expect(getAllSpy).not.toHaveBeenCalled();
    } finally {
      getAllSpy.mockRestore();
    }
  });

  it('rejects a blocked open without retrying', async () => {
    const request = { onblocked: null } as unknown as IDBOpenDBRequest;
    const factory = {
      databases: vi.fn(async () => [{ name: DATABASE_NAME, version: NATIVE_VERSION }]),
      open: vi.fn(() => {
        queueMicrotask(() => request.onblocked?.call(request, new Event('blocked')));
        return request;
      }),
    } as unknown as IDBFactory;

    const result = await inspectInterruptedCoreV1Preservation(input(factory));

    expect(result).toMatchObject({
      status: 'rejected',
      code: 'INTERRUPTED_CORE_V1_PRESERVATION_OPEN_BLOCKED',
    });
    expect(factory.open).toHaveBeenCalledTimes(1);
  });

  it('rejects missing and wrong-version catalogs without opening a database', async () => {
    const missingFactory = new IDBFactory();
    const missingOpen = vi.spyOn(missingFactory, 'open');
    const wrongFactory = {
      databases: vi.fn(async () => [{ name: DATABASE_NAME, version: 20 }]),
      open: vi.fn(),
    } as unknown as IDBFactory;

    const missing = await inspectInterruptedCoreV1Preservation(input(missingFactory));
    const wrong = await inspectInterruptedCoreV1Preservation(input(wrongFactory));

    expect(missing.code).toBe('INTERRUPTED_CORE_V1_PRESERVATION_DATABASE_MISSING');
    expect(wrong.code).toBe('INTERRUPTED_CORE_V1_PRESERVATION_CATALOG_MISMATCH');
    expect(missingOpen).not.toHaveBeenCalled();
    expect(wrongFactory.open).not.toHaveBeenCalled();
  });

  it('rejects duplicate exact catalog entries without opening a database', async () => {
    const factory = {
      databases: vi.fn(async () => [
        { name: DATABASE_NAME, version: NATIVE_VERSION },
        { name: DATABASE_NAME, version: NATIVE_VERSION },
      ]),
      open: vi.fn(),
    } as unknown as IDBFactory;

    const result = await inspectInterruptedCoreV1Preservation(input(factory));

    expect(factory.databases).toHaveBeenCalledTimes(1);
    expect(result).toMatchObject({
      status: 'rejected',
      code: 'INTERRUPTED_CORE_V1_PRESERVATION_CATALOG_MISMATCH',
    });
    expect(factory.open).not.toHaveBeenCalled();
  });

  it('rejects a snapshot read failure without retrying or exposing the native error', async () => {
    const factory = new IDBFactory();
    await seedExact15(factory);
    const getAllSpy = vi.spyOn(IDBObjectStore.prototype, 'getAll').mockImplementationOnce(() => {
      throw new Error('sensitive-native-read-error');
    });

    try {
      const result = await inspectInterruptedCoreV1Preservation(input(factory));

      expect(result).toMatchObject({
        status: 'rejected',
        code: 'INTERRUPTED_CORE_V1_PRESERVATION_SNAPSHOT_READ_FAILED',
        interruptedCoreDb: {
          nativeVersion: NATIVE_VERSION,
          topologyStatus: 'exact-logical-v1',
        },
      });
      expect(getAllSpy).toHaveBeenCalledTimes(1);
      expect(JSON.stringify(result)).not.toContain('sensitive-native-read-error');
    } finally {
      getAllSpy.mockRestore();
    }
  });
});
