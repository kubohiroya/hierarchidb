import '../utils/skip-if-disabled';
import { test, expect } from '@playwright/test';
import {
  dismissGuidedTour,
  waitForTreeTableLoad,
  setupConsoleErrorTracking,
  clearTestData,
  buildAppUrl,
} from '../utils/test-helpers';

type TreeRecord = {
  id: string;
  rootId: string;
};

type MutationResult = {
  success: boolean;
  nodeId?: string;
  error?: string;
};

type ShapeWorkerQueryAPI = {
  listTrees: () => Promise<TreeRecord[]>;
  getNode: (nodeId: string) => Promise<{ draftData?: { processingStatus?: string } | null; data?: { processingStatus?: string } | null }>;
};

type ShapeVectorSummary = {
  tiles?: number;
};

type ShapeQueryAPI = {
  getBuildSessionRecord: (nodeId: string) => Promise<{ status?: string } | null>;
  getVectorTileSummary: (nodeId: string) => Promise<ShapeVectorSummary | null>;
};

type ShapeWorkerAPI = {
  setCorsProxyBaseURL?: (value: string) => Promise<void> | void;
  setAuthToken?: (token: string, scheme?: string) => Promise<void> | void;
  getQueryAPI?: () => Promise<ShapeWorkerQueryAPI>;
  getMutationAPI?: () => Promise<{
    createNode: (input: {
      nodeType: string;
      treeId: string;
      parentId: string;
      name: string;
    }) => Promise<MutationResult>;
  }>;
  getTreeNodeUpdaterAPI?: () => Promise<{
    updateTreeNode: (nodeId: string, payload: Record<string, unknown>) => Promise<void>;
  }>;
  generateShapeDownloadTaskPayloadsFromSelection?: (
    nodeId: string,
    dataSourceName: string,
    selectedArrayByCountries: Record<string, boolean[]>,
  ) => Promise<unknown[]>;
  startBuildSession?: (
    nodeType: string,
    nodeId: string,
    payloads?: unknown[],
  ) => Promise<{ status?: string }>;
  getBuildTasks?: (nodeType: string, nodeId: string) => Promise<Array<{ status?: string; [key: string]: unknown }>>;
  initialize?: () => Promise<void> | void;
  getShapeQueryAPI?: () => Promise<ShapeQueryAPI>;
};

type ShapeWorkerClientRef = {
  client?: ShapeWorkerAPI;
  getAPI?: () => ShapeWorkerAPI | undefined;
  initialize?: () => Promise<void> | void;
};

type ShapeBackgroundWindow = Window & {
  __HDB_WORKER_CLIENT_REF__?: ShapeWorkerClientRef;
  __shapeWorkerClient?: ShapeWorkerAPI;
};

test.describe('Shape build background (real pipeline)', () => {
  test.beforeEach(async ({ page }) => {
    setupConsoleErrorTracking(page);
    await clearTestData(page);
  });

  test('continues build after leaving step and persists tiles', async ({ page }) => {
    test.setTimeout(120000);


    await page.goto(buildAppUrl('t/r'), { waitUntil: 'networkidle' });
    await dismissGuidedTour(page);
    await waitForTreeTableLoad(page);
    await page.waitForFunction(
      () => Boolean((window as ShapeBackgroundWindow).__HDB_WORKER_CLIENT_REF__?.client),
      null,
      { timeout: 15000 },
    );

    await page.evaluate(async () => {
      const ref = (window as ShapeBackgroundWindow).__HDB_WORKER_CLIENT_REF__;
      const api = ref?.client ?? ref?.getAPI?.();
      if (api?.setCorsProxyBaseURL) {
        await api.setCorsProxyBaseURL('');
      }
      if (api?.setAuthToken) {
        await api.setAuthToken('e2e-test-token', 'Bearer');
      }
    });

    const buildConfig = {
      dataSourceName: 'geoboundaries',
      sourceConfig: {
        maxConcurrent: 1,
        deleteOnComplete: false,
        timeoutMs: 300000,
        retryAttempts: 3,
        retryDelay: 1000,
        retryLimit: 3,
        retryBackoff: 'linear',
      },
      geometryConfig: {
        zoomBandBoundaries: [1, 2, 3, 6],
        maxConcurrent: 1,
        enableFeatureFiltering: true,
        featureAreaThreshold: 1.0,
        minVertexCountForAreaFilter: 10,
        aspectRatioThreshold: 5,
        featureFilterMethod: 'hybrid',
        hybridFilterConfig: {
          quickRejectThreshold: 0.002,
          regularShapeMinRatio: 0.5,
          regularShapeMaxRatio: 2.0,
          simpleShapeVertexThreshold: 10,
          elongatedShapeCorrectionFactor: 1.3,
        },
        deleteOnComplete: false,
        tolerance: 0.2,
        areaThreshold: 1.0,
        excludePolygonAreaCoefficient: 1,
        omitDetailsConfig: {
          level: 'strong',
        },
        minRingVertices: 4,
        boundaryDisableAtZoomOrAbove: 3,
      },
      tileEmitConfig: {
        enableTopojsonSimplify: true,
        maxConcurrent: 1,
        dynamicConcurrency: {
          enabled: true,
          minConcurrent: 1,
          highWatermark: 0.85,
          lowWatermark: 0.6,
          adjustStep: 1,
          sampleMs: 2000,
        },
        tolerance: 0,
        extent: 4096,
        bufferSize: 256,
        boundaryDedupe: true,
        indexMaxPoints: 100000,
        layerSetName: 'shape',
        promoteId: 'id',
        tileSize: 256,
        inputFormat: 'geojson',
        inputCompression: 'none',
        tileExpandFactor: 1,
        tileExpandMargin: 0,
        format: 'mvt',
        compression: 'gzip',
      },
      cleanupConfig: {
        deleteFetchApiCache: false,
        deleteFetchFilteredCache: false,
        deleteGeometryCache: false,
        deleteVTCache: false,
      },
    };
    const selectedArrayByCountries = { JP: [true] };

    const shapeNode = await page.evaluate(async ({ buildConfig, selectedArrayByCountries, nodeType }) => {
      const client = (window as ShapeBackgroundWindow).__HDB_WORKER_CLIENT_REF__?.client;
      if (!client) {
        throw new Error('Worker client not ready');
      }
      const queryAPI = await client.getQueryAPI();
      const mutationAPI = await client.getMutationAPI();
      const updaterAPI = await client.getTreeNodeUpdaterAPI();

      const trees = await queryAPI.listTrees();
      const tree = trees.find((t) => t.id === 'r') ?? trees[0];
      if (!tree) throw new Error('No console available');
      const rootId = tree.rootId;

      const name = `Shape Build ${Date.now()}`;
      const createResult = await mutationAPI.createNode({
        nodeType,
        treeId: tree.id,
        parentId: rootId,
        name,
      });
      if (!createResult.success) {
        throw new Error(`Failed to create shape node: ${createResult ?? 'unknown error'}`);
      }

      const nodeId = createResult.nodeId;
      const now = Date.now();
      const draftPayload = {
        name,
        description: 'E2E shape build background test',
        buildConfig,
        selectedArrayByCountries,
        processingStatus: 'idle',
        licenseAgreement: true,
        licenseAgreedAt: new Date(now).toISOString(),
      };

      await updaterAPI.updateTreeNode(nodeId, {
        mode: 'save-draft',
        data: draftPayload,
        draftData: draftPayload,
      });

      return {
        treeId: tree.id,
        pageNodeId: rootId,
        nodeId,
        name,
      };
    }, { buildConfig, selectedArrayByCountries, nodeType: 'shape' });

    const startResult = await page.evaluate(async ({ nodeId, selectedArrayByCountries, dataSourceName }) => {
      const ref = (window as ShapeBackgroundWindow).__HDB_WORKER_CLIENT_REF__;
        const api = ref?.client ?? ref?.getAPI?.();
      if (!api) {
        throw new Error('Worker client not ready');
      }
      if (ref?.initialize) {
        await ref.initialize();
      } else if (api.initialize) {
        await api.initialize();
      }
      const payloads = await api.generateShapeDownloadTaskPayloadsFromSelection(
        nodeId,
        dataSourceName,
        selectedArrayByCountries,
      );
      const result = await api.startBuildSession('shape', nodeId, payloads);
      const tasks = await api.getBuildTasks('shape', nodeId).catch(() => []);
      return {
        status: result?.status ?? null,
        taskCount: Array.isArray(tasks) ? tasks.length : 0,
      };
    }, {
      nodeId: shapeNode.nodeId,
      selectedArrayByCountries,
      dataSourceName: buildConfig.dataSourceName,
    });

    if (!startResult) {
      throw new Error('startBuildSession returned null');
    }

    await page.goto(buildAppUrl(`t/${shapeNode.treeId}/${shapeNode.pageNodeId}`), { waitUntil: 'networkidle' });
    await waitForTreeTableLoad(page);

    const waitForCompletion = async () => {
      const deadline = Date.now() + 90000;
      let lastStatus: { status: string | null; tiles: number; taskSummary: Record<string, number> | null; runningStages: string[]; runningTask: { taskId: string | null; stage: string | null; status: string | null; progress: number | null; message: string | null } | null; failedTask: { taskId: string | null; stage: string | null; status: string | null; progress: number | null; message: string | null } | null } | null = null;
      while (Date.now() < deadline) {
        const status = await page.evaluate(async (nodeId) => {
        const ref = (window as ShapeBackgroundWindow).__HDB_WORKER_CLIENT_REF__;
          const api = ref?.client ?? ref?.getAPI?.();
          if (!api) {
            return {
              status: null,
              tiles: 0,
              taskSummary: null,
              runningStages: [],
              runningTask: null,
              failedTask: null,
            };
          }
          const treeAPI = await api.getQueryAPI();
          const node = await treeAPI.getNode(nodeId);
          const data = (node?.draftData ?? node?.data) as { processingStatus?: string } | null;
          const queryAPI = await api.getShapeQueryAPI();
          const summary = await queryAPI.getVectorTileSummary(nodeId);
          const tasks = await api.getBuildTasks('shape', nodeId).catch(() => []);
          const summaryCounts = Array.isArray(tasks)
            ? tasks.reduce((acc: Record<string, number>, task: { status?: string }) => {
                const key = task.status ?? 'unknown';
                acc[key] = (acc[key] ?? 0) + 1;
                return acc;
              }, {})
            : null;
          const runningTasks = Array.isArray(tasks)
            ? tasks.filter((task: { status?: string }) => task.status === 'running')
            : [];
          const runningStages = runningTasks.map((task: { stage?: string }) => task.stage ?? 'unknown');
          const failedTasks = Array.isArray(tasks)
            ? tasks.filter((task: { status?: string }) => task.status === 'failed')
            : [];
          const firstRunning = runningTasks[0] as {
            taskId?: string;
            stage?: string;
            status?: string;
            progress?: number;
            message?: string;
          } | undefined;
          const firstFailed = failedTasks[0] as {
            taskId?: string;
            stage?: string;
            status?: string;
            progress?: number;
            message?: string;
          } | undefined;
          return {
            status: data?.processingStatus ?? null,
            tiles: summary?.tiles ?? 0,
            taskSummary: summaryCounts,
            runningStages,
            runningTask: firstRunning
              ? {
                  taskId: firstRunning.taskId ?? null,
                  stage: firstRunning.stage ?? null,
                  status: firstRunning.status ?? null,
                  progress: typeof firstRunning.progress === 'number' ? firstRunning.progress : null,
                  message: firstRunning.message ?? null,
                }
              : null,
            failedTask: firstFailed
              ? {
                  taskId: firstFailed.taskId ?? null,
                  stage: firstFailed.stage ?? null,
                  status: firstFailed.status ?? null,
                  progress: typeof firstFailed.progress === 'number' ? firstFailed.progress : null,
                  message: firstFailed.message ?? null,
                }
              : null,
          };
        }, shapeNode.nodeId);

        lastStatus = status;
        if (status.taskSummary?.failed) {
          throw new Error(`Shape build failed (task=${JSON.stringify(status.failedTask ?? {})})`);
        }
        if (status.status === 'completed' && status.tiles > 0) return;
        if (status.status === 'failed') {
          throw new Error('Shape build failed');
        }
        await page.waitForTimeout(1000);
      }
      const statusText = lastStatus
        ? `status=${lastStatus.status ?? 'null'} tiles=${lastStatus.tiles} tasks=${JSON.stringify(lastStatus.taskSummary ?? {})} runningStages=${JSON.stringify(lastStatus.runningStages ?? [])} runningTask=${JSON.stringify(lastStatus.runningTask ?? {})} failedTask=${JSON.stringify(lastStatus.failedTask ?? {})}`
        : 'status=unknown';
      throw new Error(`Timed out waiting for shape build completion (${statusText})`);
    };

    await waitForCompletion();

    await page.goto(buildAppUrl(`t/${shapeNode.treeId}/${shapeNode.pageNodeId}`), { waitUntil: 'networkidle' });
    await waitForTreeTableLoad(page);
    const nodeLinkAfter = page.getByRole('link', { name: new RegExp(shapeNode.name) });
    await expect(nodeLinkAfter).toBeVisible({ timeout: 10000 });
    await nodeLinkAfter.click();
    const launchBuildButtonAfter = page.getByRole('button', { name: /ビルドを開始|ビルド開始|Build/i });
    await expect(launchBuildButtonAfter).toBeVisible({ timeout: 10000 });
    await launchBuildButtonAfter.click();
    const summaryCard = page.locator('[data-testid="shape-plugin-build-progress-summary"]');
    await expect(summaryCard).toBeVisible({ timeout: 20000 });

    const completion = await page.evaluate(async (nodeId) => {
      const global = window as ShapeBackgroundWindow;
      if (!global.__shapeWorkerClient) {
        const ref = (window as ShapeBackgroundWindow).__HDB_WORKER_CLIENT_REF__?.client;
        if (!ref) {
          return { status: null, tiles: 0 };
        }
        global.__shapeWorkerClient = ref;
      }
      const client = global.__shapeWorkerClient;
      const queryAPI = await client.getShapeQueryAPI();
      const session = await queryAPI.getBuildSessionRecord(nodeId);
      const summary = await queryAPI.getVectorTileSummary(nodeId);
      return {
        status: session?.status ?? null,
        tiles: summary?.tiles ?? 0,
      };
    }, shapeNode.nodeId);

    expect(completion.status).toBe('completed');
    expect(completion.tiles).toBeGreaterThan(0);
  });
});
