import 'fake-indexeddb/auto';
import type { BuildContinuationPolicy } from '@hierarchidb/build-api';
import type { NodeId } from '@hierarchidb/core-types';
import type { ShapeBuildSessionRecord, ShapeMutationAPI, ShapeQueryAPI } from '@hierarchidb/shape-api';
import type { FetchTaskPayload, ShapeBuildConfig } from '../../common/types/index';
import { DEFAULT_BUILD_CONFIG } from '../../common/types/constants';
import { ephemeralDB } from '@hierarchidb/gis-sdk';
import * as Comlink from 'comlink';
vi.mock('comlink', async () => (
  await vi.importActual('comlink')
));
import { describe, expect, it, vi } from 'vitest';
import { VtTaskQueueDb } from '@hierarchidb/vt-orchestrator';
vi.mock('@hierarchidb/gis-sdk', async () => (
  await import('@hierarchidb/gis-sdk')
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
import { createEndpointFromMessagePort } from '../../e2e/test-utils/messagePortEndpoint';

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
  console.info('[test][setup] setupWorker: resetModules start');
  vi.resetModules();
  console.info('[test][setup] setupWorker: resetModules done');
  console.info('[test][setup] setupWorker: import start');
  const [{ SingletonMixin }, { exposeShapeTestAPI }] = await Promise.all([
    import('@hierarchidb/util'),
    import('../../e2e/shape-test-worker.entry'),
  ]);
  console.info('[test][setup] setupWorker: import done');
  console.info('[test][setup] setupWorker: terminateAll start');
  SingletonMixin.terminateAll();
  console.info('[test][setup] setupWorker: terminateAll done');
  console.info('[test][setup] setupWorker: MessageChannel start');
  const { port1, port2 } = new MessageChannel();
  console.info('[test][setup] setupWorker: MessageChannel done');
  console.info('[test][setup] setupWorker: expose start');
  await exposeShapeTestAPI(createEndpointFromMessagePort(port1));
  console.info('[test][setup] setupWorker: expose done');
  console.info('[test][setup] setupWorker: wrap start');
  const client = Comlink.wrap<WorkerTestAPI>(createEndpointFromMessagePort(port2));
  console.info('[test][setup] setupWorker: wrap done');
  return {
    client,
    port1,
    port2,
    terminateAll: () => SingletonMixin.terminateAll(),
  };
};

const setupAdditionalClient = async (): Promise<WorkerSetup> => {
  console.info('[test][setup] setupAdditionalClient: import start');
  const { exposeShapeTestAPI } = await import('../../e2e/shape-test-worker.entry');
  console.info('[test][setup] setupAdditionalClient: import done');
  console.info('[test][setup] setupAdditionalClient: MessageChannel start');
  const { port1, port2 } = new MessageChannel();
  console.info('[test][setup] setupAdditionalClient: MessageChannel done');
  console.info('[test][setup] setupAdditionalClient: expose start');
  await exposeShapeTestAPI(createEndpointFromMessagePort(port1));
  console.info('[test][setup] setupAdditionalClient: expose done');
  console.info('[test][setup] setupAdditionalClient: wrap start');
  const client = Comlink.wrap<WorkerTestAPI>(createEndpointFromMessagePort(port2));
  console.info('[test][setup] setupAdditionalClient: wrap done');
  return {
    client,
    port1,
    port2,
    terminateAll: () => {},
  };
};

const closeClientPorts = async (setup: WorkerSetup): Promise<void> => {
  const release = (setup.client)[
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
    const release = (setup.client)[
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
  const deadline = Date.now() + timeoutMs;
  while (Date.now() <= deadline) {
    if (await check()) return;
    if (Date.now() > deadline) {
      break;
    }
    await new Promise((resolve) => setTimeout(resolve, intervalMs));
  }
  throw new Error(`Timed out waiting for ${label} after ${timeoutMs}ms`);
};

const debugTransformCacheAccess = async (nodeId: NodeId): Promise<void> => {
  const relations = await ephemeralDB.tileIdToBufferRelations.where('nodeId').equals(nodeId).toArray();
  const bufferIds = Array.from(new Set(relations.map((relation) => relation.bufferId)));
  console.info('[test][debug] transformCache buffers', JSON.stringify({
    nodeId,
    relationCount: relations.length,
    bufferCount: bufferIds.length,
    bufferSample: bufferIds.slice(0, 3),
  }));
  if (bufferIds.length === 0) return;
  const sampleId = bufferIds[0];
  const getStartedAt = Date.now();
  const record = await ephemeralDB.transformCache.get(sampleId);
  const recordData = record?.data;
  const recordDataKeys = recordData && typeof recordData === 'object'
    ? Object.keys(recordData as Record<string, unknown>).slice(0, 8)
    : null;
  const isBuffer = typeof Buffer !== 'undefined' && typeof Buffer.isBuffer === 'function'
    ? Buffer.isBuffer(recordData)
    : false;
  console.info('[test][debug] transformCache get done', JSON.stringify({
    nodeId,
    bufferId: sampleId,
    hasRecord: Boolean(record),
    durationMs: Date.now() - getStartedAt,
    dataType: recordData ? typeof recordData : null,
    dataConstructorName: recordData && typeof recordData === 'object'
      ? (recordData as { constructor?: { name?: string } }).constructor?.name ?? null
      : null,
    dataKeys: recordDataKeys,
    isArrayBuffer: recordData instanceof ArrayBuffer,
    isArrayBufferView: recordData ? ArrayBuffer.isView(recordData as ArrayBufferView) : false,
    isUint8Array: recordData instanceof Uint8Array,
    isBuffer,
    byteLength: recordData && typeof recordData === 'object'
      ? (recordData as { byteLength?: number }).byteLength ?? null
      : null,
    length: recordData && typeof recordData === 'object'
      ? (recordData as { length?: number }).length ?? null
      : null,
  }));
  const bulkStartedAt = Date.now();
  const bulk = await ephemeralDB.transformCache.bulkGet([sampleId]);
  const bulkCount = bulk.filter((item) => Boolean(item)).length;
  const bulkRecord = bulk.find((item) => Boolean(item));
  const bulkData = bulkRecord?.data;
  const bulkKeys = bulkData && typeof bulkData === 'object'
    ? Object.keys(bulkData as Record<string, unknown>).slice(0, 8)
    : null;
  const bulkIsBuffer = typeof Buffer !== 'undefined' && typeof Buffer.isBuffer === 'function'
    ? Buffer.isBuffer(bulkData)
    : false;
  console.info('[test][debug] transformCache bulkGet done', JSON.stringify({
    nodeId,
    bufferId: sampleId,
    recordCount: bulkCount,
    durationMs: Date.now() - bulkStartedAt,
    dataType: bulkData ? typeof bulkData : null,
    dataConstructorName: bulkData && typeof bulkData === 'object'
      ? (bulkData as { constructor?: { name?: string } }).constructor?.name ?? null
      : null,
    dataKeys: bulkKeys,
    isArrayBuffer: bulkData instanceof ArrayBuffer,
    isArrayBufferView: bulkData ? ArrayBuffer.isView(bulkData as ArrayBufferView) : false,
    isUint8Array: bulkData instanceof Uint8Array,
    isBuffer: bulkIsBuffer,
    byteLength: bulkData && typeof bulkData === 'object'
      ? (bulkData as { byteLength?: number }).byteLength ?? null
      : null,
    length: bulkData && typeof bulkData === 'object'
      ? (bulkData as { length?: number }).length ?? null
      : null,
  }));
};

const logStructuredCloneSanity = async (): Promise<void> => {
  let utilClone: typeof structuredClone | null = null;
  try {
    const utilModule = await import('node:util');
    if (typeof utilModule.structuredClone === 'function') {
      utilClone = utilModule.structuredClone;
    }
  } catch {
    utilClone = null;
  }
  if (typeof structuredClone !== 'function') {
    console.info('[test][debug] structuredClone sanity', {
      available: false,
      utilAvailable: Boolean(utilClone),
    });
    return;
  }
  const payload = new ArrayBuffer(8);
  const cloned = structuredClone(payload);
  const isBuffer = typeof Buffer !== 'undefined' && typeof Buffer.isBuffer === 'function'
    ? Buffer.isBuffer(cloned)
    : false;
  const clonedConstructor = cloned && typeof cloned === 'object'
    ? (cloned as { constructor?: { name?: string } }).constructor?.name ?? null
    : null;
  const clonedConstructorEquals = cloned && typeof cloned === 'object'
    ? (cloned as { constructor?: unknown }).constructor === ArrayBuffer
    : null;
  const toStringTag = cloned && typeof cloned === 'object'
    ? Object.prototype.toString.call(cloned)
    : null;
  console.info('[test][debug] structuredClone sanity', {
    available: true,
    utilAvailable: Boolean(utilClone),
    utilSameRef: utilClone ? utilClone === structuredClone : null,
    originalConstructor: payload.constructor.name,
    clonedType: typeof cloned,
    clonedConstructor,
    clonedConstructorEquals,
    toStringTag,
    isArrayBuffer: cloned instanceof ArrayBuffer,
    isArrayBufferView: cloned ? ArrayBuffer.isView(cloned as ArrayBufferView) : false,
    isUint8Array: cloned instanceof Uint8Array,
    isBuffer,
    byteLength: cloned && typeof cloned === 'object'
      ? (cloned as { byteLength?: number }).byteLength ?? null
      : null,
  });
};


const ensureCompressionStreams = async (): Promise<void> => {
  const needsCompression = typeof CompressionStream !== 'function';
  const needsDecompression = typeof DecompressionStream !== 'function';
  if (!needsCompression && !needsDecompression) return;
  const streamWeb = await import('node:stream/web');
  if (needsCompression) {
    (globalThis).CompressionStream = streamWeb.CompressionStream;
  }
  if (needsDecompression) {
    (globalThis).DecompressionStream = streamWeb.DecompressionStream;
  }
};

const logProgress = (label: string, details?: Record<string, unknown>): void => {
  if (details) {
    console.info('[test][progress]', label, details);
  } else {
    console.info('[test][progress]', label);
  }
};

const withTimeout = async <T>(
  promise: Promise<T>,
  { label, timeoutMs }: { label: string; timeoutMs: number },
): Promise<T> => {
  let timeoutId: ReturnType<typeof setTimeout> | undefined;
  const timeoutPromise = new Promise<never>((_, reject) => {
    timeoutId = setTimeout(() => {
      reject(new Error(`[test][timeout] ${label} after ${timeoutMs}ms`));
    }, timeoutMs);
  });
  try {
    return await Promise.race([promise, timeoutPromise]);
  } finally {
    if (timeoutId) {
      clearTimeout(timeoutId);
    }
  }
};

type RealPipelineStep = 1 | 2 | 3 | 4;
const runRealPipeline = process.env.HDB_WFL_REAL_PIPELINE === '1';
const realPipelineIt = runRealPipeline ? it : it.skip;

describe('Comlink + fake-indexeddb integration: shape build background (real pipeline)', () => {
  it('keeps pipeline running after UI disconnect (smoke)', async () => {
    await ensureCompressionStreams();
    const nodeId = 'shape-build-pipeline-background-smoke' as NodeId;
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
        const observerPipeline = await observer.client.getShapePipelineTestAPI();
        await waitFor(async () => {
          const state = await observerPipeline.getPipelineState(nodeId);
          return state === 'running' || state === 'completed';
        }, { label: 'pipeline running after disconnect', timeoutMs: 5000 });
      } finally {
        await closeClientPorts(observer);
      }
    } finally {
      await cleanupWorker(setup);
    }
  }, 30_000);

  const runRealPipelineSteps = async (step: RealPipelineStep): Promise<void> => {
    await ensureCompressionStreams();
    const label = `real pipeline step ${step}`;
    logProgress(`${label}: start`);
    (globalThis as { __HDB_VT_COLLECT_TIMEOUT_MS?: number }).__HDB_VT_COLLECT_TIMEOUT_MS = 15000;
    (globalThis as { __HDB_VT_ASYNC_ITER_TIMEOUT_MS?: number }).__HDB_VT_ASYNC_ITER_TIMEOUT_MS = 15000;
    (globalThis as { __HDB_VT_DEBUG_COLLECT?: boolean }).__HDB_VT_DEBUG_COLLECT = true;
    (globalThis as { __HDB_VT_COLLECT_BULKGET?: boolean }).__HDB_VT_COLLECT_BULKGET = true;
    (globalThis as { __HDB_VT_COLLECT_GET_EACH?: boolean }).__HDB_VT_COLLECT_GET_EACH = true;
    const nodeId = `shape-build-pipeline-background-real-step${step}` as NodeId;
    const setup = await setupWorker();

    try {
      logProgress(`${label}: setup complete`);
      const mutation = await setup.client.getShapeMutationAPI();
      const query = await setup.client.getShapeQueryAPI();
      const admin = await setup.client.getShapeEphemeralAdminAPI();
      const pipeline = await setup.client.getShapePipelineTestAPI();

      logProgress(`${label}: cleanup start`);
      await mutation.deleteBuildSession(nodeId);
      await mutation.deleteBuildTasks(nodeId);
      await admin.clearShapeEphemeralCache(nodeId, 'fetchCache');
      await admin.clearShapeEphemeralCache(nodeId, 'transformCache');
      await admin.clearShapeEphemeralCache(nodeId, 'transformErrors');
      await admin.clearShapeEphemeralCache(nodeId, 'tileIdToBufferRelations');
      logProgress(`${label}: cleanup done`);


      await mutation.upsertBuildSession(createBaseSession(nodeId, Date.now()));
      logProgress(`${label}: base session created`);

      await pipeline.startPipeline({
        nodeId,
        buildConfig: createTestBuildConfig(),
        downloadTaskPayloads,
        resumeExistingTasks: false,
      });
      logProgress(`${label}: pipeline started`);

      await waitFor(async () => {
        const tasks = await query.listBuildTaskRecordsByStage(nodeId, 'fetch');
        return tasks.length > 0;
      }, { label: 'fetch task creation' });
      logProgress(`${label}: fetch tasks created`);

      const observer = await setupAdditionalClient();
      try {
        await closeClientPorts(setup);
        logProgress(`${label}: UI client disconnected`);
        const observerQuery = await observer.client.getShapeQueryAPI();
        const observerPipeline = await observer.client.getShapePipelineTestAPI();
        const observerAdmin = await observer.client.getShapeEphemeralAdminAPI();
        await logStructuredCloneSanity();
        logProgress(`${label}: wait for tile relations`);
        const preRelationCount = await ephemeralDB.tileIdToBufferRelations
          .where('nodeId')
          .equals(nodeId)
          .count();
        logProgress(`${label}: pre tile relations count`, { count: preRelationCount });
        await withTimeout(
          waitFor(async () => (
            (await ephemeralDB.tileIdToBufferRelations.where('nodeId').equals(nodeId).count()) > 0
          ), { label: 'tile relation creation' }),
          { label: 'waitFor tile relations', timeoutMs: 12000 },
        );
        logProgress(`${label}: tile relations created`);
        await debugTransformCacheAccess(nodeId);
        logProgress(`${label}: debug transform cache done`);
        if (step === 1) return;
        logProgress(`${label}: wait for pipeline completion`);
        await withTimeout(
          observerPipeline.waitForPipeline(nodeId),
          { label: 'waitForPipeline', timeoutMs: 24000 },
        );
        logProgress(`${label}: pipeline completed`);
        if (step === 2) return;
        const taskQueue = new VtTaskQueueDb();
        const queueTasks = await withTimeout(
          taskQueue.tasks.where('nodeId').equals(nodeId).toArray(),
          { label: 'load taskQueue tasks', timeoutMs: 6000 },
        );
        if (queueTasks.length === 0) {
          throw new Error('taskQueue tasks missing');
        }
        logProgress(`${label}: taskQueue tasks loaded`, { count: queueTasks.length });
        if (step === 3) return;
        const stageOf = (task: { stage?: string }) => task.stage ?? 'unknown';
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
        logProgress(`${label}: ephemeral counts ok`, counts);
        await completeSession(await observer.client.getShapeMutationAPI(), nodeId, Date.now());
        const record = await observerQuery.getBuildSessionRecord(nodeId);
        expect(record?.status).toBe('completed');
        const tiles = await withTimeout(
          observerQuery.getVectorTileSummary(nodeId),
          { label: 'getVectorTileSummary', timeoutMs: 6000 },
        );
        expect(tiles.tiles).toBeGreaterThan(0);
        logProgress(`${label}: vector tiles ok`, { tiles: tiles.tiles });
      } finally {
        await closeClientPorts(observer);
      }
    } finally {
      delete (globalThis as { __HDB_VT_COLLECT_TIMEOUT_MS?: number }).__HDB_VT_COLLECT_TIMEOUT_MS;
      delete (globalThis as { __HDB_VT_ASYNC_ITER_TIMEOUT_MS?: number }).__HDB_VT_ASYNC_ITER_TIMEOUT_MS;
      delete (globalThis as { __HDB_VT_DEBUG_COLLECT?: boolean }).__HDB_VT_DEBUG_COLLECT;
      delete (globalThis as { __HDB_VT_COLLECT_BULKGET?: boolean }).__HDB_VT_COLLECT_BULKGET;
      delete (globalThis as { __HDB_VT_COLLECT_GET_EACH?: boolean }).__HDB_VT_COLLECT_GET_EACH;
      await cleanupWorker(setup);
    }
  };

  realPipelineIt('real pipeline step 1 (tile relations)', async () => {
    await runRealPipelineSteps(1);
  }, 120_000);

  realPipelineIt('real pipeline step 1+2 (wait for pipeline)', async () => {
    await runRealPipelineSteps(2);
  }, 120_000);

  realPipelineIt('real pipeline step 1+2+3 (task queue)', async () => {
    await runRealPipelineSteps(3);
  }, 120_000);

  realPipelineIt('real pipeline step 1+2+3+4 (vector tiles)', async () => {
    await runRealPipelineSteps(4);
  }, 120_000);
});
