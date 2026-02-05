import 'fake-indexeddb/auto';
import type { BuildContinuationPolicy } from '@hierarchidb/batch-api';
import type { NodeId } from '@hierarchidb/core-types';
import type { ShapeBuildSessionRecord, ShapeMutationAPI, ShapeQueryAPI } from '@hierarchidb/shape-api';
import type { FetchTaskPayload, ShapeBuildConfig } from '../../../../../plugins/shape-plugin/src/common/types/index.js';
import { DEFAULT_BUILD_CONFIG } from '../../../../../plugins/shape-plugin/src/common/types/constants.ts';
import * as Comlink from 'comlink';
import { describe, expect, it, vi } from 'vitest';
vi.mock('@hierarchidb/gis-sdk', async () => (
  await import('../../../../packages/features/gis-sdk/dist/index.js')
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

vi.mock('../../../../../plugins/shape-plugin/src/services/metadata/MetadataLoader.ts', () => {
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
      return ['naturalearth'];
    }
  }

  const metadataLoader = new MetadataLoader();
  return { MetadataLoader, metadataLoader };
});

vi.mock('../../../../../plugins/shape-plugin/src/services/datasources/DataSourceStrategyFactory.ts', () => {
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

type EphemeralCacheCounts = {
  fetchCache: number;
  transformCache: number;
  transformErrors: number;
  tileIdToBufferRelations: number;
  buildTasks: number;
};

type ShapeEphemeralAdminAPI = {
  seedShapeEphemeralCaches(nodeId: NodeId): Promise<void>;
  clearShapeEphemeralCache(nodeId: NodeId, cacheType: EphemeralCacheType): Promise<void>;
  getShapeEphemeralCounts(nodeId: NodeId): Promise<EphemeralCacheCounts>;
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

const cleanupWorker = async (setup: WorkerSetup): Promise<void> => {
  const release = (setup.client as { [Comlink.releaseProxy]?: () => Promise<void> })[
    Comlink.releaseProxy
  ];
  if (release) {
    await release.call(setup.client);
  }
  setup.port1.close();
  setup.port2.close();
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
    dataSourceName: 'naturalearth',
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
    url: 'mock://naturalearth/jp/admin0',
    countryCode: 'JP',
    countryName: 'Japan',
    adminLevel: 0,
    dataSource: 'naturalearth',
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
  { timeoutMs = 5000, intervalMs = 50, label = 'condition' }: {
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

const shouldAutoResume = (record: ShapeBuildSessionRecord | null): boolean => {
  if (!record) return false;
  if (record.status === 'completed' || record.status === 'failed') return false;
  if (record.status === 'paused') return record.stopReason === 'route-leave';
  if (record.stopReason && record.stopReason !== 'route-leave') return false;
  return true;
};

describe('Comlink + fake-indexeddb integration: shape build pause/resume (pipeline)', () => {
  it('pauses and resumes a pipeline run to completion', async () => {
    const nodeId = 'shape-build-pipeline-pause' as NodeId;
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

      await pipeline.pausePipeline(nodeId);
      await waitFor(
        async () => (await pipeline.getPipelineState(nodeId)) === 'paused',
        { label: 'pipeline pause' }
      );

      await pipeline.resumePipeline(nodeId);
      await pipeline.waitForPipeline(nodeId);

      await completeSession(mutation, nodeId, Date.now());

      const record = await query.getBuildSessionRecord(nodeId);
      expect(record?.status).toBe('completed');
      expect(record?.stopReason).toBe('completed');

      const tiles = await query.getVectorTileSummary(nodeId);
      expect(tiles.tiles).toBeGreaterThan(0);
    } finally {
      await cleanupWorker(setup);
    }
  }, 20_000);

  it('keeps pipeline paused until explicit resume', async () => {
    const nodeId = 'shape-build-pipeline-stays-paused' as NodeId;
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

      await pipeline.pausePipeline(nodeId);
      await waitFor(
        async () => (await pipeline.getPipelineState(nodeId)) === 'paused',
        { label: 'pipeline pause' }
      );

      await new Promise((resolve) => setTimeout(resolve, 250));
      const pausedState = await pipeline.getPipelineState(nodeId);
      expect(pausedState).toBe('paused');
      const recordBefore = await query.getBuildSessionRecord(nodeId);
      expect(recordBefore?.status).not.toBe('completed');

      await pipeline.resumePipeline(nodeId);
      await pipeline.waitForPipeline(nodeId);

      await completeSession(mutation, nodeId, Date.now());

      const record = await query.getBuildSessionRecord(nodeId);
      expect(record?.status).toBe('completed');
    } finally {
      await cleanupWorker(setup);
    }
  }, 20_000);

  it('auto-resumes when stopReason is route-leave', async () => {
    const nodeId = 'shape-build-pipeline-auto-resume' as NodeId;
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

      await pipeline.pausePipeline(nodeId);
      await mutation.updateBuildSession(nodeId, {
        status: 'paused',
        stopReason: 'route-leave',
        updatedAt: Date.now(),
      });

      await waitFor(
        async () => (await pipeline.getPipelineState(nodeId)) === 'paused',
        { label: 'pipeline pause' }
      );

      const session = await query.getBuildSessionRecord(nodeId);
      if (shouldAutoResume(session)) {
        await pipeline.resumePipeline(nodeId);
      }

      await pipeline.waitForPipeline(nodeId);
      await completeSession(mutation, nodeId, Date.now());

      const record = await query.getBuildSessionRecord(nodeId);
      expect(record?.status).toBe('completed');
      expect(record?.stopReason).toBe('completed');
    } finally {
      await cleanupWorker(setup);
    }
  }, 20_000);

  it('does not auto-resume when stopReason is user-pause', async () => {
    const nodeId = 'shape-build-pipeline-no-auto-resume' as NodeId;
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

      await pipeline.pausePipeline(nodeId);
      await mutation.updateBuildSession(nodeId, {
        status: 'paused',
        stopReason: 'user-pause',
        updatedAt: Date.now(),
      });

      await waitFor(
        async () => (await pipeline.getPipelineState(nodeId)) === 'paused',
        { label: 'pipeline pause' }
      );

      const session = await query.getBuildSessionRecord(nodeId);
      if (shouldAutoResume(session)) {
        await pipeline.resumePipeline(nodeId);
      }

      await new Promise((resolve) => setTimeout(resolve, 300));
      const state = await pipeline.getPipelineState(nodeId);
      expect(state).toBe('paused');

      await pipeline.resumePipeline(nodeId);
      await pipeline.waitForPipeline(nodeId);
      await completeSession(mutation, nodeId, Date.now());

      const record = await query.getBuildSessionRecord(nodeId);
      expect(record?.status).toBe('completed');
    } finally {
      await cleanupWorker(setup);
    }
  }, 20_000);

  it.each<[
    string,
    EphemeralCacheType,
  ]>([
    ['fetch cache', 'fetchCache'],
    ['transform cache', 'transformCache'],
    ['transform errors', 'transformErrors'],
    ['tile buffer relations', 'tileIdToBufferRelations'],
    ['build tasks', 'buildTasks'],
  ])('resumes after deleting %s and completes pipeline', async (_label, cacheType) => {
    const nodeId = `shape-build-pipeline-${cacheType}` as NodeId;
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
      await admin.seedShapeEphemeralCaches(nodeId);

      if (cacheType === 'buildTasks') {
        await pipeline.startPipeline({
          nodeId,
          buildConfig: createTestBuildConfig(),
          downloadTaskPayloads,
          resumeExistingTasks: false,
        });

        await waitFor(async () => {
          const counts = await admin.getShapeEphemeralCounts(nodeId);
          return counts.buildTasks > 0;
        }, { label: 'build task creation' });

        await pipeline.pausePipeline(nodeId);
      } else {
        await waitFor(async () => {
          const counts = await admin.getShapeEphemeralCounts(nodeId);
          return counts[cacheType] > 0;
        }, { label: `seeded ${cacheType}` });

        await pipeline.startPipeline({
          nodeId,
          buildConfig: createTestBuildConfig(),
          downloadTaskPayloads,
          resumeExistingTasks: false,
          startPaused: true,
        });
      }

      await waitFor(
        async () => (await pipeline.getPipelineState(nodeId)) === 'paused',
        { label: 'pipeline pause' }
      );

      if (cacheType === 'buildTasks') {
        await mutation.deleteBuildTasks(nodeId);
      } else {
        await admin.clearShapeEphemeralCache(nodeId, cacheType);
      }

      await waitFor(async () => {
        const counts = await admin.getShapeEphemeralCounts(nodeId);
        if (cacheType === 'buildTasks') {
          return counts.buildTasks === 0;
        }
        return counts[cacheType] === 0;
      }, { label: `deleted ${cacheType}` });

      await pipeline.resumePipeline(nodeId);
      await pipeline.waitForPipeline(nodeId);

      await completeSession(mutation, nodeId, Date.now());

      const record = await query.getBuildSessionRecord(nodeId);
      expect(record?.status).toBe('completed');

      const tiles = await query.getVectorTileSummary(nodeId);
      expect(tiles.tiles).toBeGreaterThan(0);
    } finally {
      await cleanupWorker(setup);
    }
  }, 25_000);
});
