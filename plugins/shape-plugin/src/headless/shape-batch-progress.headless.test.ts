// @vitest-environment node

import 'fake-indexeddb/auto';
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import type { NodeId, NodeType, TreeNode } from '@hierarchidb/common-types';
import { toNodeId, toNodeType } from '@hierarchidb/common-types';
import { CoreDB } from '@hierarchidb/runtime-worker';
import { registerShapeWorkerStores } from '../worker/factory/registerShapeWorkerStores.js';
import { shapeBatchAPI } from '../worker/api.js';
import { getShapeDbApiClient } from '../services/batch/ShapeBatchApiClient.js';
import { DEFAULT_PROCESSING_CONFIG, type BatchConfig, type DownloadTaskPayload } from '../common/types/index.js';
import type { ShapeEntity } from '../common/types/ShapeEntity.js';
import { defaultDataSourceFactory } from '../services/datasources/DataSourceStrategyFactory.js';

vi.mock('@hierarchidb/runtime-worker', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@hierarchidb/runtime-worker')>();
  return {
    ...actual,
    createStageWorkerClient: async () => actual.getStageProcessingClient(),
  };
});

vi.mock('../services/batch/adapters/ShapeWorkerPool.js', async () => {
  const { shapeStageWorker } = await import('../services/batch/workers/shapeStageWorker.js');
  class HeadlessShapeWorkerPool {
    size: number;

    private constructor(size: number) {
      this.size = size;
    }

    static async create(size: number): Promise<HeadlessShapeWorkerPool> {
      return new HeadlessShapeWorkerPool(Math.max(1, size));
    }

    async run<T>(runner: (api: typeof shapeStageWorker) => Promise<T>): Promise<T> {
      return runner(shapeStageWorker);
    }

    async shutdown(): Promise<void> {
      // no-op for headless tests
    }
  }

  return {
    ShapeWorkerPool: HeadlessShapeWorkerPool,
  };
});

const installPassThroughCompression = (): void => {
  if (typeof ReadableStream !== 'function' || typeof WritableStream !== 'function') {
    return;
  }

  class PassThroughStream {
    readable: ReadableStream<Uint8Array>;
    writable: WritableStream<Uint8Array>;

    constructor() {
      const chunks: Uint8Array[] = [];
      let controller: ReadableStreamDefaultController<Uint8Array> | null = null;
      this.readable = new ReadableStream({
        start(ctrl) {
          controller = ctrl;
        },
      });
      this.writable = new WritableStream({
        write(chunk) {
          chunks.push(chunk);
        },
        close() {
          const total = chunks.reduce((sum, chunk) => sum + chunk.length, 0);
          const merged = new Uint8Array(total);
          let offset = 0;
          for (const chunk of chunks) {
            merged.set(chunk, offset);
            offset += chunk.length;
          }
          if (controller) {
            controller.enqueue(merged);
            controller.close();
          }
        },
      });
    }
  }

  (globalThis as unknown as { CompressionStream?: typeof PassThroughStream }).CompressionStream = PassThroughStream;
  (globalThis as unknown as { DecompressionStream?: typeof PassThroughStream }).DecompressionStream = PassThroughStream;
};

const waitForSessionCompletion = async (nodeId: NodeId, timeoutMs = 15000) => {
  const started = Date.now();
  while (Date.now() - started < timeoutMs) {
    const session = await getShapeDbApiClient().query.getBatchSessionRecord(nodeId);
    if (session && (session.status === 'completed' || session.status === 'failed')) {
      return session;
    }
    await new Promise((resolve) => setTimeout(resolve, 100));
  }
  throw new Error('Timed out waiting for shape batch session completion');
};

const buildBatchConfig = (): BatchConfig => ({
  ...DEFAULT_PROCESSING_CONFIG,
  dataSource: 'naturalearth',
  downloadConfig: {
    ...DEFAULT_PROCESSING_CONFIG.downloadConfig,
    maxConcurrent: 1,
    retryAttempts: 0,
    timeoutMs: 3000,
  },
  extract1Config: {
    ...DEFAULT_PROCESSING_CONFIG.extract1Config,
    workers: 1,
  },
  extract2Config: {
    ...DEFAULT_PROCESSING_CONFIG.extract2Config,
    workers: 1,
    quantize: 1,
    tolerance: 0.1,
  },
  tileConfig: {
    ...DEFAULT_PROCESSING_CONFIG.tileConfig,
    minZoom: 0,
    maxZoom: 0,
    workers: 1,
  },
});

const buildDownloadPayloads = (): DownloadTaskPayload[] => ([
  {
    url: 'https://example.com/shape-test.geojson',
    countryCode: 'JP',
    countryName: 'Japan',
    adminLevel: 0,
    dataSource: 'naturalearth',
  },
]);

const buildFakeStrategyEntities = (): ShapeEntity[] => ([
  {
    geometry: {
      type: 'Polygon',
      coordinates: [[
        [139.6917, 35.6895],
        [139.7, 35.6895],
        [139.7, 35.695],
        [139.6917, 35.695],
        [139.6917, 35.6895],
      ]],
    },
    properties: {
      shapeName: 'Japan',
      shapeISO: 'JPN',
      shapeID: 'JPN-ADM0-TEST',
      shapeGroup: 'JPN',
      shapeType: 'ADM0',
    },
  },
]);

describe('Shape batch processing (headless)', () => {
  const nodeId = toNodeId('shape-headless-node');
  let coreDB: CoreDB;

  beforeAll(async () => {
    installPassThroughCompression();
    await registerShapeWorkerStores();
    coreDB = await CoreDB.getSingleton();
  });

  beforeEach(async () => {
    await getShapeDbApiClient().mutation.clearShapeArtifacts(nodeId);
    await coreDB.nodes.delete(nodeId);

    const trees = await coreDB.getTrees();
    const parentId = (trees[0]?.rootId ?? toNodeId('root')) as NodeId;
    const now = Date.now();
    const draftData: ShapeEntity = {
      batchConfig: buildBatchConfig(),
    };
    const node: TreeNode = {
      id: nodeId,
      parentId,
      nodeType: toNodeType('shape') as NodeType,
      depth: 1,
      createdAt: now,
      updatedAt: now,
      version: 1,
      metadata: { name: 'Headless Shape', description: '', tags: [] },
      draftMetadata: { name: 'Headless Shape', description: '', tags: [] },
      data: null,
      draftData,
      visible: true,
    };
    await coreDB.createNode(node);

    const fakeEntities = buildFakeStrategyEntities();
    vi.spyOn(defaultDataSourceFactory, 'create').mockReturnValue({
      id: 'natural-earth-shapes',
      name: 'Fake Natural Earth',
      config: {
        id: 'fake-natural-earth',
        name: 'Fake Natural Earth',
        version: 'test',
        access: { method: 'Custom' },
        processing: { inputFormat: 'geojson', outputFormat: 'geojson' },
      },
      fetchData: async () => fakeEntities,
      processData: async (raw) => raw as ShapeEntity[],
      validateData: async () => ({ isValid: true }),
      saveData: async () => ({ success: true }),
    });
  });

  afterEach(async () => {
    vi.restoreAllMocks();
    await getShapeDbApiClient().mutation.clearShapeArtifacts(nodeId);
    await coreDB.nodes.delete(nodeId);
  });

  it('runs a full headless batch session with real adapters', async () => {
    const batchConfig = buildBatchConfig();
    const payloads = buildDownloadPayloads();
    const progressEvents: Array<{ stage?: string; payload?: { total?: number } }> = [];

    await shapeBatchAPI.startBatchProcess(nodeId, batchConfig, payloads, (event) => {
      progressEvents.push(event);
    });

    const session = await waitForSessionCompletion(nodeId);
    expect(session.status).toBe('completed');
    expect(progressEvents.length).toBeGreaterThan(0);

    const completedTasks = await getShapeDbApiClient().ephemeral
      .listBatchTasksByStatus(nodeId, 'completed')
      .then((rows) => rows.length);
    expect(completedTasks).toBeGreaterThan(0);
  }, { timeout: 20000 });
});
