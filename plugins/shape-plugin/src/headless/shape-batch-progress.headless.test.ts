// @vitest-environment node
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import 'fake-indexeddb/auto';
import type { NodeId, NodeType, TreeNode } from '@hierarchidb/common-types';
import { CoreDB, getStageProcessingClient, unregisterRuntimeWorkerClient } from '@hierarchidb/runtime-worker';
import type { BatchProgressEvent, BatchConfig, ShapeEntity } from '../common/types/index.js';
import { DEFAULT_PROCESSING_CONFIG } from '../common/types/index.js';
import { shapePluginAPI } from '../worker/api.js';
import { getEphemeralShapeDB, closeEphemeralShapeDB } from '../services/database/EphemeralShapeDB.js';
import { shapeDB } from '../services/database/ShapeDB.js';
import { registerShapeRuntimeWorkerClient } from '../services/batch/adapters/RuntimeWorkerClient.js';
import { GeoBoundariesStrategy } from '../services/datasources/GeoBoundariesStrategy.js';
import { geojson } from 'flatgeobuf';

const fetchedUrls: string[] = [];
let originalFetch: typeof fetch | undefined;
let originalFetchBoundaryMetadata:
  | ((
    country: string,
    adminLevel: string,
    preferredEndpoint?: string,
  ) => Promise<unknown>)
  | null = null;

const createBatchConfig = (
  overrides: Partial<BatchConfig> = {},
): BatchConfig => ({
  ...DEFAULT_PROCESSING_CONFIG,
  ...overrides,
  downloadConfig: {
    ...DEFAULT_PROCESSING_CONFIG.downloadConfig,
    ...overrides.downloadConfig,
  },
  simplificationConfig: {
    ...DEFAULT_PROCESSING_CONFIG.simplificationConfig,
    ...overrides.simplificationConfig,
  },
  tileConfig: {
    ...DEFAULT_PROCESSING_CONFIG.tileConfig,
    ...overrides.tileConfig,
  },
  cleanupConfig: {
    ...DEFAULT_PROCESSING_CONFIG.cleanupConfig,
    ...overrides.cleanupConfig,
  },
});

const decodeFeatureCollection = async (buffer: ArrayBuffer): Promise<{ features?: unknown[] } | null> => {
  const decoded = geojson.deserialize(new Uint8Array(buffer));
  if (decoded && typeof (decoded as AsyncIterable<unknown>)[Symbol.asyncIterator] === 'function') {
    const features: unknown[] = [];
    for await (const feature of decoded as AsyncIterable<unknown>) {
      features.push(feature);
    }
    return { features };
  }
  if (decoded && typeof decoded === 'object') {
    return decoded as { features?: unknown[] };
  }
  return null;
};

type BBox = [number, number, number, number];

const mergeBboxes = (left: BBox | null, right: BBox | null): BBox | null => {
  if (!left) return right;
  if (!right) return left;
  return [
    Math.min(left[0], right[0]),
    Math.min(left[1], right[1]),
    Math.max(left[2], right[2]),
    Math.max(left[3], right[3]),
  ];
};

const isBboxContained = (outer: BBox, inner: BBox): boolean => (
  outer[0] <= inner[0] && outer[1] <= inner[1] && outer[2] >= inner[2] && outer[3] >= inner[3]
);

const tileToBbox = (z: number, x: number, y: number): BBox => {
  const n = 2 ** z;
  const lonMin = (x / n) * 360 - 180;
  const lonMax = ((x + 1) / n) * 360 - 180;
  const latRadMax = Math.atan(Math.sinh(Math.PI * (1 - (2 * y) / n)));
  const latRadMin = Math.atan(Math.sinh(Math.PI * (1 - (2 * (y + 1)) / n)));
  const latMax = (latRadMax * 180) / Math.PI;
  const latMin = (latRadMin * 180) / Math.PI;
  return [lonMin, latMin, lonMax, latMax];
};

async function createDraftNode(
  core: CoreDB,
  draftData: Partial<ShapeEntity>,
): Promise<NodeId> {
  const now = Date.now();
  const nodeId = `shape-${now}-${Math.random().toString(36).slice(2, 8)}` as NodeId;
  const node: TreeNode = {
    id: nodeId,
    parentId: 'r:root' as NodeId,
    nodeType: 'shape' as NodeType,
    depth: 1,
    createdAt: now,
    updatedAt: now,
    version: 1,
    metadata: {
      name: 'Shape Draft',
      description: undefined,
      tags: [],
    },
    draftMetadata: null,
    data: null,
    draftData,
  };
  await core.createNode(node);
  return nodeId;
}

const buildCountryBboxes = async (sessionId: string): Promise<Map<string, BBox>> => {
  const tasks = await shapeDB.batchTasks.where('sessionId').equals(sessionId).toArray();
  const downloadTasks = tasks.filter((task) => task.taskType === 'download');
  const db = getEphemeralShapeDB();
  const countryBboxes = new Map<string, BBox>();

  for (const task of downloadTasks) {
    const index = task.index;
    const bufferId = `${sessionId}-download-${index}`;
    const rawBuffer = await db.rawBuffers.get(bufferId);
    if (!rawBuffer) {
      throw new Error(`Download buffer missing for task ${task.taskId}`);
    }
    const input = task.inputData ?? {};
    const country = String(input.country ?? input.countryCode ?? '').trim().toUpperCase();
    if (!country) {
      throw new Error(`Download task missing country code: ${task.taskId}`);
    }
    const bbox = rawBuffer.bbox as BBox;
    const merged = mergeBboxes(countryBboxes.get(country) ?? null, bbox);
    if (merged) {
      countryBboxes.set(country, merged);
    }
  }
  return countryBboxes;
};

const buildUnionTileBboxes = (
  tiles: Array<{ z: number; x: number; y: number }>,
): Map<number, BBox> => {
  const union = new Map<number, BBox>();
  tiles.forEach((tile) => {
    const bbox = tileToBbox(tile.z, tile.x, tile.y);
    const merged = mergeBboxes(union.get(tile.z) ?? null, bbox);
    if (merged) {
      union.set(tile.z, merged);
    }
  });
  return union;
};

const runBatchProcessing = async (
  core: CoreDB,
  config: BatchConfig,
  countries: string[],
  adminLevels: number[],
): Promise<{ sessionId: string; events: BatchProgressEvent[] }> => {
  const draftId = await createDraftNode(core, {
    dataSourceName: 'geoboundaries',
    selectedCountries: countries,
    adminLevels,
    licenseAgreement: true,
    batchConfig: config,
  });
  const urlMetadata = await shapePluginAPI.generateUrlMetadata(
    'geoboundaries',
    countries,
    adminLevels,
  );
  if (urlMetadata.length === 0) {
    throw new Error('No URL metadata generated for geoBoundaries selection.');
  }

  const sessionId = await shapePluginAPI.startBatchProcessing(
    draftId,
    config,
    urlMetadata,
  );

  const events: BatchProgressEvent[] = [];
  const completed = new Promise<void>((resolve, reject) => {
    let settled = false;
    let pollId: ReturnType<typeof setInterval> | null = null;
    const buildFailureMessage = async (reason: string) => {
      const tasks = await shapeDB.batchTasks.where('sessionId').equals(sessionId).toArray();
      const errors = tasks.map((task) => task.errorMessage).filter(Boolean);
      const urls = fetchedUrls.join(', ');
      return `${reason}. errors=${errors.join(' | ') || 'none'}; fetchedUrls=${urls || 'none'}`;
    };
    const finalizeReject = async (reason: string) => {
      if (settled) return;
      settled = true;
      reject(new Error(await buildFailureMessage(reason)));
    };
    const finalizeResolve = () => {
      if (settled) return;
      settled = true;
      resolve();
    };
    const timer = setTimeout(() => {
      void finalizeReject('Batch processing timed out');
    }, 90000);
    const unsubscribe = shapePluginAPI.subscribeToProgress(
      sessionId,
      (event: BatchProgressEvent) => {
        events.push(event);
        if (event.type === 'error' || event.status === 'failed') {
          clearTimeout(timer);
          if (pollId) clearInterval(pollId);
          unsubscribe();
          void finalizeReject('Batch processing failed');
        }
        if (event.stage === 'vectorTiles' && event.status === 'completed') {
          clearTimeout(timer);
          if (pollId) clearInterval(pollId);
          unsubscribe();
          finalizeResolve();
        }
      },
    );
    pollId = setInterval(async () => {
      const session = await shapePluginAPI.getBatchSession(sessionId);
      if (!session) return;
      if (session.status === 'completed') {
        clearTimeout(timer);
        if (pollId) clearInterval(pollId);
        unsubscribe();
        finalizeResolve();
      }
      if (session.status === 'failed' || session.status === 'cancelled') {
        clearTimeout(timer);
        if (pollId) clearInterval(pollId);
        unsubscribe();
        void finalizeReject(`Batch processing ${session.status}`);
      }
    }, 200);
  });

  await completed.catch(async (error) => {
    try {
      await shapePluginAPI.cancelBatchProcessing(draftId);
    } catch {
      // Ignore cleanup errors after failure.
    }
    throw error;
  });

  return { sessionId, events };
};

describe('Shape batch processing (headless)', () => {
  let core: CoreDB;

  beforeEach(async () => {
    CoreDB.resetInstance();
    core = await CoreDB.getSingleton(`shape-batch-${Date.now()}`);
    await shapeDB.delete();
    await shapeDB.open();
    await getEphemeralShapeDB().clearAll();
    fetchedUrls.length = 0;
    originalFetch = globalThis.fetch;
    globalThis.fetch = async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = typeof input === 'string'
        ? input
        : input instanceof Request
          ? input.url
          : String(input);
      fetchedUrls.push(url);
      if (url.includes('cors-proxy') || url.includes('corsproxy')) {
        throw new Error('cors-proxy should not be used in headless batch tests.');
      }
      const headers = new Headers(
        init?.headers ?? (input instanceof Request ? input.headers : undefined),
      );
      const authHeader = headers.get('Authorization') ?? headers.get('authorization');
      if (authHeader) {
        throw new Error('Authorization header should not be set in headless batch tests.');
      }
      if (!originalFetch) {
        throw new Error('Global fetch is not available in the test environment.');
      }
      return originalFetch(input, init);
    };
    const strategyProto = GeoBoundariesStrategy.prototype as unknown as {
      fetchBoundaryMetadata: (
        country: string,
        adminLevel: string,
        preferredEndpoint?: string,
      ) => Promise<unknown>;
    };
    if (!originalFetchBoundaryMetadata) {
      originalFetchBoundaryMetadata = strategyProto.fetchBoundaryMetadata;
    }
    strategyProto.fetchBoundaryMetadata = async function fetchBoundaryMetadata(
      country: string,
      adminLevel: string,
      preferredEndpoint?: string,
    ) {
      const releaseType = preferredEndpoint ?? 'gbOpen';
      const access = (this as GeoBoundariesStrategy).config.access;
      const endpoint = access.endpoints?.[releaseType] ?? 'gbOpen/{ISO}/{ADM}/';
      const url = `${access.baseUrl}${endpoint
        .replace('{ISO}', country)
        .replace('{ADM}', adminLevel)}`;
      const response = await fetch(url);
      if (!response.ok) {
        throw new Error(`API error ${response.status}: ${response.statusText}`);
      }
      const data = await response.json();
      return { ...data, releaseType };
    };
    expect(await shapeDB.batchSessions.count()).toBe(0);
    expect(await shapeDB.batchTasks.count()).toBe(0);
    const stats = await getEphemeralShapeDB().getStatistics();
    expect(stats.rawBuffers).toBe(0);
    expect(stats.simplifiedBuffers).toBe(0);
    expect(stats.vectorTiles).toBe(0);
    expect(stats.sessions).toBe(0);
    registerShapeRuntimeWorkerClient(async () => getStageProcessingClient());
  });

  afterEach(async () => {
    CoreDB.resetInstance();
    unregisterRuntimeWorkerClient('shape');
    await getEphemeralShapeDB().clearAll();
    await closeEphemeralShapeDB();
    await shapeDB.delete();
    if (originalFetch) {
      globalThis.fetch = originalFetch;
    }
    if (originalFetchBoundaryMetadata) {
      const strategyProto = GeoBoundariesStrategy.prototype as unknown as {
        fetchBoundaryMetadata: typeof originalFetchBoundaryMetadata;
      };
      strategyProto.fetchBoundaryMetadata = originalFetchBoundaryMetadata;
    }
  });

  it('starts batch processing and completes via progress callbacks', async () => {
    const config = createBatchConfig({
      dataSource: 'geoboundaries',
      simplificationConfig: {
        ...DEFAULT_PROCESSING_CONFIG.simplificationConfig,
        enablePerFeatureSimplification: false,
      },
      tileConfig: {
        ...DEFAULT_PROCESSING_CONFIG.tileConfig,
        minZoom: 0,
        maxZoom: 0,
      },
    });
    const { sessionId, events } = await runBatchProcessing(
      core,
      config,
      ['JP'],
      [0],
    );

    const session = await shapePluginAPI.getBatchSession(sessionId);
    expect(session?.status).toBe('completed');
    expect(events.length).toBeGreaterThan(0);
    expect(fetchedUrls.length).toBeGreaterThan(0);
    expect(
      fetchedUrls.some((url) => url.toLowerCase().includes('geoboundaries')),
    ).toBe(true);
    const tasks = await shapeDB.batchTasks.where('sessionId').equals(sessionId).toArray();
    const failedTasks = tasks.filter((task) => task.status === 'failed');
    if (failedTasks.length > 0) {
      throw new Error(
        `Batch task failures: ${failedTasks.map((task) => `${task.taskType}:${task.errorMessage ?? 'unknown'}`).join('; ')}`,
      );
    }
    const simplify2Buffer = await getEphemeralShapeDB().simplifiedBuffers
      .get(`${sessionId}-simplify2-0`);
    if (!simplify2Buffer) {
      throw new Error('Simplify2 buffer was not written.');
    }
    if (simplify2Buffer.featureCount === 0) {
      throw new Error('Simplify2 buffer has 0 features.');
    }
    const rawBuffer = await getEphemeralShapeDB().rawBuffers
      .get(`${sessionId}-download-0`);
    if (!rawBuffer) {
      throw new Error('Download buffer was not written.');
    }
    const decodedRaw = await decodeFeatureCollection(rawBuffer.data);
    const rawDecodedCount = Array.isArray(decodedRaw?.features)
      ? decodedRaw.features.length
      : 0;
    if (rawDecodedCount === 0) {
      throw new Error('Download buffer decoded to 0 features.');
    }
    const simplify1Buffer = await getEphemeralShapeDB().simplifiedBuffers
      .get(`${sessionId}-simplify1-0`);
    if (!simplify1Buffer) {
      throw new Error('Simplify1 buffer was not written.');
    }
    const decodedSimplify1 = await decodeFeatureCollection(simplify1Buffer.data);
    const simplify1DecodedCount = Array.isArray(decodedSimplify1?.features)
      ? decodedSimplify1.features.length
      : 0;
    if (simplify1DecodedCount === 0) {
      throw new Error('Simplify1 buffer decoded to 0 features.');
    }
    const decoded = await decodeFeatureCollection(simplify2Buffer.data);
    const decodedFeatureCount = Array.isArray(decoded?.features)
      ? decoded.features.length
      : 0;
    if (decodedFeatureCount === 0) {
      throw new Error('Simplify2 buffer decoded to 0 features.');
    }
    const stageClient = await getStageProcessingClient();
    const summary = await stageClient.vectortile.getSummary(sessionId);
    expect(summary.tiles).toBeGreaterThan(0);
  }, 90000);

  it('runs geoBoundaries Admin1 for JP/CN/KR and writes vector tiles', async () => {
    const config = createBatchConfig({
      dataSource: 'geoboundaries',
      downloadConfig: {
        maxConcurrent: 1,
      },
      tileConfig: {
        ...DEFAULT_PROCESSING_CONFIG.tileConfig,
        minZoom: 0,
        maxZoom: 3,
        workers: 1,
      },
    });

    const countries = ['JP', 'CN', 'KR'];
    const adminLevels = [1];
    const { sessionId } = await runBatchProcessing(
      core,
      config,
      countries,
      adminLevels,
    );

    const session = await shapePluginAPI.getBatchSession(sessionId);
    expect(session?.status).toBe('completed');
    expect(fetchedUrls.length).toBeGreaterThan(0);
    expect(
      fetchedUrls.some((url) => url.toLowerCase().includes('geoboundaries')),
    ).toBe(true);
    const stageClient = await getStageProcessingClient();
    const summary = await stageClient.vectortile.getSummary(sessionId);
    expect(summary.tiles).toBeGreaterThan(0);
    expect(summary.zoomMin).toBe(0);
    expect(summary.zoomMax).toBe(3);

    const tiles = await stageClient.vectortile.listTiles(sessionId);
    const zooms = new Set(tiles.map((tile) => tile.z));
    [0, 1, 2, 3].forEach((zoom) => {
      if (!zooms.has(zoom)) {
        throw new Error(`Missing vector tiles at zoom ${zoom}`);
      }
    });

    const countryBboxes = await buildCountryBboxes(sessionId);
    const expectedCountries = ['JPN', 'CHN', 'KOR'];
    expectedCountries.forEach((country) => {
      if (!countryBboxes.has(country)) {
        throw new Error(`Country bbox missing for ${country}`);
      }
    });
    const unionByZoom = buildUnionTileBboxes(tiles);
    const zoom3Union = unionByZoom.get(3);
    if (!zoom3Union) {
      throw new Error('Zoom 3 union bbox is missing');
    }
    expectedCountries.forEach((country) => {
      const bbox = countryBboxes.get(country);
      if (!bbox) return;
      if (!isBboxContained(zoom3Union, bbox)) {
        throw new Error(`Zoom 3 tiles do not contain bbox for ${country}`);
      }
    });
  }, 120000);

  it('fails when dataSource is missing from the batch config', async () => {
    const fullConfig = createBatchConfig({
      dataSource: 'geoboundaries',
    });
    const { dataSource: _omit, ...rest } = fullConfig;
    const invalidConfig = rest as BatchConfig;
    const draftId = await createDraftNode(core, {
      dataSourceName: 'geoboundaries',
      batchConfig: fullConfig,
    });

    await expect(
      shapePluginAPI.startBatchProcessing(draftId, invalidConfig, []),
    ).rejects.toThrow('Data source is required');
  });
});
