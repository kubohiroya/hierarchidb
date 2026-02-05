import 'fake-indexeddb/auto';
import type { BuildContinuationPolicy } from '@hierarchidb/batch-api';
import type { NodeId } from '@hierarchidb/core-types';
import type { ShapeBuildSessionRecord, ShapeMutationAPI, ShapeQueryAPI } from '@hierarchidb/shape-api';
import type { FetchTaskPayload, ShapeBuildConfig } from '../../../../../plugins/shape-plugin/src/common/types/index.js';
import { DEFAULT_BUILD_CONFIG } from '../../../../../plugins/shape-plugin/src/common/types/constants.ts';
import * as Comlink from 'comlink';
vi.mock('comlink', async () => (
  await vi.importActual('comlink')
));
import { describe, expect, it, vi } from 'vitest';
import { VtTaskQueueDb } from '@hierarchidb/vt-orchestrator';
vi.mock('@hierarchidb/gis-sdk', async () => (
  await import('../../../../../packages/features/gis-sdk/src/index.ts')
));

const mockMetadata = vi.hoisted(() => ([
  {
    countryCode: 'JP',
    countryName: 'Japan',
    continent: 'Asia',
    availableAdminLevels: [0],
    iso2: 'JP',
    iso3: 'JPN',
  },
]));

const mockEntities = vi.hoisted(() => ([
  {
    geometry: {
      type: 'Polygon',
      coordinates: [
        [
          [0, 0],
          [0, 1],
          [1, 1],
          [1, 0],
          [0, 0],
        ],
      ],
    },
    properties: {
      name: 'Test Feature',
    },
  },
]));

let strategyCreateCount = 0;

vi.mock('../../../../../plugins/shape-plugin/src/services/metadata/MetadataLoader.js', () => {
  class MetadataLoader {
    static getInstance(): MetadataLoader {
      return metadataLoader;
    }

    async loadMetadata(): Promise<typeof mockMetadata> {
      return mockMetadata;
    }

    async getCountryMetadata(): Promise<typeof mockMetadata[number] | undefined> {
      return mockMetadata[0];
    }

    async getCountriesMetadata(): Promise<typeof mockMetadata> {
      return mockMetadata;
    }

    clearCache(): void {
      // no-op for tests
    }

    getAvailableDataSources(): string[] {
      return ['geoboundaries'];
    }
  }

  const metadataLoader = new MetadataLoader();
  return { MetadataLoader, metadataLoader };
});

vi.mock('../../../../../plugins/shape-plugin/src/services/datasources/DataSourceStrategyFactory.js', () => {
  const fetchDelayMs = 50;

  class MockStrategy {
    id = 'mock-strategy';
    name = 'Mock Strategy';
    config = {
      access: {
        method: 'File',
      },
      processing: {
        inputFormat: 'geojson',
        outputFormat: 'geojson',
        filters: [],
        transformations: [],
      },
      version: 'test',
    };

    async fetchData(): Promise<typeof mockEntities> {
      await new Promise((resolve) => setTimeout(resolve, fetchDelayMs));
      return mockEntities;
    }

    async processData(raw: typeof mockEntities): Promise<typeof mockEntities> {
      return raw;
    }

    async validateData(): Promise<{ isValid: boolean; errors: string[] }> {
      return { isValid: true, errors: [] };
    }

    async saveData(): Promise<{ success: boolean }> {
      return { success: true };
    }
  }

  class DataSourceStrategyFactory {
    create(): MockStrategy {
      strategyCreateCount += 1;
      return new MockStrategy();
    }
  }

  return { DataSourceStrategyFactory };
});

import { MessageChannel, type MessagePort as NodeMessagePort } from 'worker_threads';
import { createEndpointFromMessagePort } from '../../e2e/test-utils/messagePortEndpoint.js';

type EphemeralCacheType =
  | 'fetchCache'
  | 'transformCache'
  | 'transformErrors'
  | 'tileIdToBufferRelations'
  | 'buildTasks';

type ShapeEphemeralAdminAPI = {
  clearShapeEphemeralCache(nodeId: NodeId, cacheType: EphemeralCacheType): Promise<void>;
  getShapeEphemeralCounts(nodeId: NodeId): Promise<{
    fetchCache: number;
    transformCache: number;
    transformErrors: number;
    tileIdToBufferRelations: number;
    buildTasks: number;
  }>;
};

type PipelineState = 'idle' | 'running' | 'paused' | 'completed' | 'failed';

type ShapePipelineRunParams = {
  nodeId: NodeId;
  buildConfig: ShapeBuildConfig;
  downloadTaskPayloads?: FetchTaskPayload[];
  resumeExistingTasks?: boolean;
  buildContinuationPolicy?: BuildContinuationPolicy;
  startPaused?: boolean;
};

type ShapePipelineTestAPI = {
  startPipeline(params: ShapePipelineRunParams): Promise<void>;
  pausePipeline(nodeId: NodeId): Promise<void>;
  resumePipeline(nodeId: NodeId): Promise<void>;
  waitForPipeline(nodeId: NodeId): Promise<void>;
  getPipelineState(nodeId: NodeId): Promise<PipelineState>;
};

type WorkerTestAPI = {
  getShapeQueryAPI(): Promise<ShapeQueryAPI>;
  getShapeMutationAPI(): Promise<ShapeMutationAPI>;
  getShapeEphemeralAdminAPI(): Promise<ShapeEphemeralAdminAPI>;
  getShapePipelineTestAPI(): Promise<ShapePipelineTestAPI>;
};

type WorkerSetup = {
  client: Comlink.Remote<WorkerTestAPI>;
  port1: NodeMessagePort;
  port2: NodeMessagePort;
  terminateAll: () => void;
  closed?: boolean;
};

const setupWorker = async (): Promise<WorkerSetup> => {
  vi.resetModules();
  const [{ SingletonMixin }, { exposeShapeTestAPI }] = await Promise.all([
    import('@hierarchidb/util'),
    import('../../e2e/shape-test-worker.entry.js'),
  ]);
  SingletonMixin.terminateAll();
  const { port1, port2 } = new MessageChannel();
  await exposeShapeTestAPI(createEndpointFromMessagePort(port1));
  const client = Comlink.wrap<WorkerTestAPI>(createEndpointFromMessagePort(port2));
  return {
    client,
    port1,
    port2,
    terminateAll: () => SingletonMixin.terminateAll(),
  };
};

const setupAdditionalClient = async (): Promise<WorkerSetup> => {
  const { exposeShapeTestAPI } = await import('../../e2e/shape-test-worker.entry.js');
  const { port1, port2 } = new MessageChannel();
  await exposeShapeTestAPI(createEndpointFromMessagePort(port1));
  const client = Comlink.wrap<WorkerTestAPI>(createEndpointFromMessagePort(port2));
  return {
    client,
    port1,
    port2,
    terminateAll: () => {},
  };
};

const closeClientPorts = async (setup: WorkerSetup): Promise<void> => {
  const release = (setup.client as { [Comlink.releaseProxy]?: () => Promise<void> })[
    Comlink.releaseProxy
  ];
  if (release) {
    await release.call(setup.client);
  }
  setup.port1.close();
  setup.port2.close();
  setup.closed = true;
};

const cleanupWorker = async (setup: WorkerSetup): Promise<void> => {
  if (!setup.closed) {
    const release = (setup.client as { [Comlink.releaseProxy]?: () => Promise<void> })[
      Comlink.releaseProxy
    ];
    if (release) {
      await release.call(setup.client);
    }
    setup.port1.close();
    setup.port2.close();
  }
  setup.terminateAll();
};

const createBaseSession = (nodeId: NodeId, timestamp: number): ShapeBuildSessionRecord => ({
  nodeId,
  status: 'running',
  config: {
    download: {},
    extract1: {},
    extract2: {},
    vectorTiles: {},
  },
  startedAt: timestamp,
  updatedAt: timestamp,
  progress: {
    total: 3,
    completed: 0,
    failed: 0,
    skipped: 0,
    percentage: 0,
    taskType: 'fetch',
  },
  stages: {
    fetch: { status: 'queued', progress: 0, tasksTotal: 1, tasksCompleted: 0, tasksFailed: 0 },
    transform: { status: 'queued', progress: 0, tasksTotal: 1, tasksCompleted: 0, tasksFailed: 0 },
    vt: { status: 'queued', progress: 0, tasksTotal: 1, tasksCompleted: 0, tasksFailed: 0 },
  },
});

const createTestBuildConfig = (): ShapeBuildConfig => {
  const dynamicBase = DEFAULT_BUILD_CONFIG.vtConfig.dynamicConcurrency;
  return {
    ...DEFAULT_BUILD_CONFIG,
    dataSourceName: 'geoboundaries',
    fetchConfig: {
      ...DEFAULT_BUILD_CONFIG.fetchConfig,
      maxConcurrent: 1,
      retryAttempts: 0,
      retryLimit: 0,
    },
    transformConfig: {
      ...DEFAULT_BUILD_CONFIG.transformConfig,
      zoomBandBoundaries: [2, 3],
      maxConcurrent: 1,
      enableFeatureFiltering: false,
    },
    vtConfig: {
      ...DEFAULT_BUILD_CONFIG.vtConfig,
      maxConcurrent: 1,
      dynamicConcurrency: dynamicBase
        ? { ...dynamicBase, enabled: false }
        : undefined,
    },
  };
};

const downloadTaskPayloads: FetchTaskPayload[] = [
  {
    url: 'mock://geoboundaries/jp/admin0',
    countryCode: 'JP',
    countryName: 'Japan',
    adminLevel: 0,
    dataSource: 'geoboundaries',
  },
];

const completeSession = async (
  mutation: ShapeMutationAPI,
  nodeId: NodeId,
  timestamp: number
): Promise<void> => {
  await mutation.updateBuildSession(nodeId, {
    status: 'completed',
    stopReason: 'completed',
    updatedAt: timestamp,
    completedAt: timestamp,
    progress: {
      total: 3,
      completed: 3,
      failed: 0,
      skipped: 0,
      percentage: 100,
      taskType: 'vt',
    },
    stages: {
      fetch: { status: 'completed', progress: 100, tasksTotal: 1, tasksCompleted: 1, tasksFailed: 0 },
      transform: { status: 'completed', progress: 100, tasksTotal: 1, tasksCompleted: 1, tasksFailed: 0 },
      vt: { status: 'completed', progress: 100, tasksTotal: 1, tasksCompleted: 1, tasksFailed: 0 },
    },
  });
};

const waitFor = async (
  check: () => Promise<boolean>,
  { timeoutMs = 20000, intervalMs = 50, label = 'condition' }: {
    timeoutMs?: number;
    intervalMs?: number;
    label?: string;
  } = {}
): Promise<void> => {
  const startedAt = Date.now();
  while (Date.now() - startedAt < timeoutMs) {
    if (await check()) return;
    await new Promise((resolve) => setTimeout(resolve, intervalMs));
  }
  throw new Error(`Timed out waiting for ${label}`);
};


const ensureCompressionStreams = async (): Promise<void> => {
  const needsCompression = typeof CompressionStream !== 'function';
  const needsDecompression = typeof DecompressionStream !== 'function';
  if (!needsCompression && !needsDecompression) return;
  const streamWeb = await import('node:stream/web');
  if (needsCompression) {
    (globalThis as { CompressionStream?: typeof streamWeb.CompressionStream }).CompressionStream = streamWeb.CompressionStream;
  }
  if (needsDecompression) {
    (globalThis as { DecompressionStream?: typeof streamWeb.DecompressionStream }).DecompressionStream = streamWeb.DecompressionStream;
  }
};

describe('Comlink + fake-indexeddb integration: shape build background (real pipeline)', () => {
  it('keeps pipeline running after UI disconnect and writes vector tiles', async () => {
    await ensureCompressionStreams();
    const nodeId = 'shape-build-pipeline-background-real' as NodeId;
    const setup = await setupWorker();

    try {
      const mutation = await setup.client.getShapeMutationAPI();
      const query = await setup.client.getShapeQueryAPI();
      const admin = await setup.client.getShapeEphemeralAdminAPI();
      const pipeline = await setup.client.getShapePipelineTestAPI();

      await mutation.deleteBuildSession(nodeId);
      await mutation.deleteBuildTasks(nodeId);
      await admin.clearShapeEphemeralCache(nodeId, 'fetchCache');
      await admin.clearShapeEphemeralCache(nodeId, 'transformCache');
      await admin.clearShapeEphemeralCache(nodeId, 'transformErrors');
      await admin.clearShapeEphemeralCache(nodeId, 'tileIdToBufferRelations');

      await mutation.upsertBuildSession(createBaseSession(nodeId, Date.now()));

      await pipeline.startPipeline({
        nodeId,
        buildConfig: createTestBuildConfig(),
        downloadTaskPayloads,
        resumeExistingTasks: false,
      });

      await waitFor(async () => {
        const tasks = await query.listBuildTaskRecordsByStage(nodeId, 'fetch');
        return tasks.length > 0;
      }, { label: 'fetch task creation' });

      const observer = await setupAdditionalClient();
      try {
        await closeClientPorts(setup);
        const observerQuery = await observer.client.getShapeQueryAPI();
        const observerPipeline = await observer.client.getShapePipelineTestAPI();
        const observerAdmin = await observer.client.getShapeEphemeralAdminAPI();
        await observerPipeline.waitForPipeline(nodeId);
        const taskQueue = new VtTaskQueueDb();
        const queueTasks = await taskQueue.tasks.where('nodeId').equals(nodeId).toArray();
        if (queueTasks.length === 0) {
          throw new Error('taskQueue tasks missing');
        }
        const stageOf = (task: { taskType?: string; stage?: string }) => task.taskType ?? task.stage ?? 'unknown';
        const fetchTasks = queueTasks.filter((task) => stageOf(task) === 'fetch');
        const transformTasks = queueTasks.filter((task) => stageOf(task) === 'transform');
        const vtTasks = queueTasks.filter((task) => stageOf(task) === 'vt');
        if (fetchTasks.length === 0 || transformTasks.length === 0 || vtTasks.length === 0) {
          const fetchSummary = fetchTasks.map((task) => (
            `${task.taskId}:${task.status}:${task.errorMessage ?? 'ok'}`
          ));
          throw new Error(
            `taskQueue stage counts: fetch=${fetchTasks.length}, transform=${transformTasks.length}, vt=${vtTasks.length} (fetch=${fetchSummary.join(', ')})`
          );
        }
        const failedFetch = fetchTasks.filter((task) => task.status === 'failed');
        if (failedFetch.length > 0) {
          throw new Error(`fetch tasks failed: ${failedFetch.map((task) => task.errorMessage ?? 'unknown').join('; ')}`);
        }
        const failedTransform = transformTasks.filter((task) => task.status === 'failed');
        if (failedTransform.length > 0) {
          throw new Error(`transform tasks failed: ${failedTransform.map((task) => task.errorMessage ?? 'unknown').join('; ')}`);
        }
        const failedVt = vtTasks.filter((task) => task.status === 'failed');
        if (failedVt.length > 0) {
          throw new Error(`vt tasks failed: ${failedVt.map((task) => task.errorMessage ?? 'unknown').join('; ')}`);
        }
        expect(strategyCreateCount).toBeGreaterThan(0);
        const counts = await observerAdmin.getShapeEphemeralCounts(nodeId);
        expect(counts.buildTasks).toBeGreaterThan(0);
        expect(counts.fetchCache).toBeGreaterThan(0);
        expect(counts.transformCache).toBeGreaterThan(0);
        expect(counts.tileIdToBufferRelations).toBeGreaterThan(0);
        await completeSession(await observer.client.getShapeMutationAPI(), nodeId, Date.now());
        const record = await observerQuery.getBuildSessionRecord(nodeId);
        expect(record?.status).toBe('completed');
        const tiles = await observerQuery.getVectorTileSummary(nodeId);
        expect(tiles.tiles).toBeGreaterThan(0);
      } finally {
        await closeClientPorts(observer);
      }
    } finally {
      await cleanupWorker(setup);
    }
  }, 120_000);
});
