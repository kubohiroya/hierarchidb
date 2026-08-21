import '../utils/skip-if-disabled';
import type { ConsoleMessage, Page, Worker } from '@playwright/test';
import { expect, test } from '../fixtures/canonicalAuthFixture';
import {
  buildAppUrl,
  clearTestData,
  dismissGuidedTour,
  setupConsoleErrorTracking,
  waitForTreeTableLoad,
} from '../utils/test-helpers';

type SelectedArrayByCountries = Record<string, boolean[]>;

type ConsolePayload = Record<string, unknown>;
type WorkerDiagnostics = Record<string, unknown>;

type TreeSummary = {
  id: string;
  rootId: string;
};

type CreateNodeResult = {
  success: boolean;
  nodeId: string;
  error?: unknown;
};

type TreeQueryAPI = {
  listTrees: () => Promise<TreeSummary[]>;
};

type TreeMutationAPI = {
  createNode: (input: {
    nodeType: string;
    treeId: string;
    parentId: string;
    name: string;
  }) => Promise<CreateNodeResult>;
};

type TreeNodeUpdaterAPI = {
  updateTreeNode: (nodeId: string, payload: {
    mode: string;
    data: unknown;
    draftData: unknown;
  }) => Promise<void>;
};

type BuildSessionRecord = {
  status?: unknown;
  stopReason?: unknown;
  progress?: {
    total?: unknown;
    completed?: unknown;
    failed?: unknown;
  };
  stageId?: unknown;
  stageHeartbeatAt?: unknown;
  updatedAt?: unknown;
};

type ShapeQueryAPI = {
  getBuildSessionRecord: (nodeId: string) => Promise<BuildSessionRecord | null>;
};

type WorkerAPI = {
  getBuildTasks?: (nodeType: string, nodeId: string) => Promise<unknown>;
  getBuildSessionStatus?: (nodeType: string, nodeId: string) => Promise<unknown>;
  getShapeQueryAPI?: () => Promise<ShapeQueryAPI>;
  getQueryAPI?: () => Promise<TreeQueryAPI>;
  getMutationAPI?: () => Promise<TreeMutationAPI>;
  getTreeNodeUpdaterAPI?: () => Promise<TreeNodeUpdaterAPI>;
  setCorsProxyBaseURL?: (value: string) => Promise<void> | void;
};

type WorkerClientRef = {
  isInitialized?: boolean;
  initialize?: () => Promise<void> | void;
  client?: WorkerAPI;
  getAPI?: () => WorkerAPI | undefined;
};

type WindowWithWorkerRef = Window & {
  __HDB_WORKER_CLIENT_REF__?: WorkerClientRef;
};

const readConsolePayload = async (msg: ConsoleMessage): Promise<ConsolePayload | null> => {
  const args = msg.args();
  if (args.length < 2) return null;
  try {
    const value = await args[1]?.jsonValue();
    if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
    return value as ConsolePayload;
  } catch {
    return null;
  }
};

const readString = (payload: ConsolePayload | null, key: string): string | null => {
  const value = payload?.[key];
  return typeof value === 'string' ? value : null;
};

const appendWorkerTraceLog = (
  workerStartupLogs: string[],
  source: string,
  text: string,
): void => {
  workerStartupLogs.push(`[${source}] ${text}`);
  if (workerStartupLogs.length > 200) {
    workerStartupLogs.splice(0, workerStartupLogs.length - 200);
  }
};

const collectWorkerDiagnostics = async (page: Page, nodeId: string): Promise<WorkerDiagnostics> => {
  return page.evaluate(async (targetNodeId) => {
    const ref = (window as WindowWithWorkerRef).__HDB_WORKER_CLIENT_REF__;
    if (!ref) {
      return { error: 'worker-ref-missing' };
    }
    try {
      if (!ref.isInitialized && typeof ref.initialize === 'function') {
        await ref.initialize();
      }
      const api = ref.client ?? ref.getAPI?.();
      if (!api?.getBuildTasks || !api?.getBuildSessionStatus || !api?.getShapeQueryAPI) {
        return { error: 'worker-api-missing' };
      }
      const [tasksResult, statusResult, sessionRecordResult] = await Promise.all([
        (async () => {
          try {
            const tasks = await api.getBuildTasks('shape', targetNodeId);
            return { ok: true, tasks };
          } catch (error) {
            return { ok: false, error: error instanceof Error ? error.message : String(error) };
          }
        })(),
        (async () => {
          try {
            const status = await api.getBuildSessionStatus('shape', targetNodeId);
            return { ok: true, status };
          } catch (error) {
            return { ok: false, error: error instanceof Error ? error.message : String(error) };
          }
        })(),
        (async () => {
          try {
            const queryApi = await api.getShapeQueryAPI();
            const sessionRecord = await queryApi.getBuildSessionRecord(targetNodeId);
            return { ok: true, sessionRecord };
          } catch (error) {
            return { ok: false, error: error instanceof Error ? error.message : String(error) };
          }
        })(),
      ]);
      const tasks = tasksResult.ok && Array.isArray(tasksResult.tasks) ? tasksResult.tasks : [];
      const status = statusResult.ok ? statusResult.status : null;
      const sessionRecord = sessionRecordResult.ok ? sessionRecordResult.sessionRecord : null;
      return {
        taskCount: tasks.length,
        taskHead: tasks.slice(0, 5).map((task: Record<string, unknown>) => ({
          taskId: task.taskId,
          type: task.type ?? task.stage,
          status: task.status,
          progress: task.progress,
        })),
        batchStatus: status,
        sessionStatus: sessionRecord?.status ?? null,
        sessionStopReason: sessionRecord?.stopReason ?? null,
        sessionProgressTotal: sessionRecord?.progress?.total ?? null,
        sessionProgressCompleted: sessionRecord?.progress?.completed ?? null,
        sessionProgressFailed: sessionRecord?.progress?.failed ?? null,
        sessionStageId: sessionRecord?.stageId ?? null,
        sessionStageHeartbeatAt: sessionRecord?.stageHeartbeatAt ?? null,
        sessionUpdatedAt: sessionRecord?.updatedAt ?? null,
        taskQueryError: tasksResult.ok ? null : tasksResult.error,
        statusQueryError: statusResult.ok ? null : statusResult.error,
        sessionQueryError: sessionRecordResult.ok ? null : sessionRecordResult.error,
      };
    } catch (error) {
      return { error: error instanceof Error ? error.message : String(error) };
    }
  }, nodeId);
};

test.describe('Shape build startup receiving-task-snapshot UX', () => {
  test.beforeEach(async ({ page }) => {
    setupConsoleErrorTracking(page);
    await clearTestData(page);
  });

  test('does not hit receiving-task-snapshot timeout after build start and observes receiving-task-snapshot evidence', async ({
    page,
    canonicalAuth,
  }) => {
    test.setTimeout(180000);
    await canonicalAuth.signIn();

    await page.goto(buildAppUrl('t/r'), { waitUntil: 'domcontentloaded', timeout: 120000 });
    await dismissGuidedTour(page);
    await waitForTreeTableLoad(page);
    await page.waitForFunction(() => Boolean((window as WindowWithWorkerRef).__HDB_WORKER_CLIENT_REF__?.client), null, {
      timeout: 20000,
    });

    await page.evaluate(async () => {
      const ref = (window as WindowWithWorkerRef).__HDB_WORKER_CLIENT_REF__;
      const api = ref?.client ?? ref?.getAPI?.();
      if (api?.setCorsProxyBaseURL) {
        await api.setCorsProxyBaseURL('');
      }
    });
    const selectedArrayByCountries: SelectedArrayByCountries = { JP: [true] };
    const buildConfig = await page.evaluate(() => {
      return {
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
          zoomBandBoundaries: [1, 2, 3],
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
    });

    const shapeNode = await page.evaluate(async ({ buildConfig, selectedArrayByCountries }) => {
      const client = (window as WindowWithWorkerRef).__HDB_WORKER_CLIENT_REF__?.client;
      if (!client?.getQueryAPI || !client?.getMutationAPI || !client?.getTreeNodeUpdaterAPI) {
        throw new Error('Worker client not ready');
      }
      const queryAPI = await client.getQueryAPI();
      const mutationAPI = await client.getMutationAPI();
      const updaterAPI = await client.getTreeNodeUpdaterAPI();

      const trees = await queryAPI.listTrees();
      const tree = trees.find((t: { id: string }) => t.id === 'r') ?? trees[0];
      if (!tree) throw new Error('No tree available');
      const createResult = await mutationAPI.createNode({
        nodeType: 'shape',
        treeId: tree.id,
        parentId: tree.rootId,
        name: `Shape Startup ${Date.now()}`,
      });
      if (!createResult.success) {
        throw new Error(`Failed to create shape node: ${String(createResult.error ?? 'unknown')}`);
      }
      const nodeId = createResult.nodeId;
      const draftPayload = {
        name: `Shape Startup ${Date.now()}`,
        description: 'E2E startup receiving-task-snapshot test',
        buildConfig,
        selectedArrayByCountries,
        processingStatus: 'idle',
        licenseAgreement: true,
        licenseAgreedAt: new Date().toISOString(),
      };
      await updaterAPI.updateTreeNode(nodeId, {
        mode: 'save-draft',
        data: draftPayload,
        draftData: draftPayload,
      });
      return { treeId: tree.id, pageNodeId: tree.rootId, nodeId, name: draftPayload.name };
    }, { buildConfig, selectedArrayByCountries });

    await page.goto(buildAppUrl(`t/${shapeNode.treeId}/${shapeNode.pageNodeId}`), {
      waitUntil: 'domcontentloaded',
      timeout: 120000,
    });
    await waitForTreeTableLoad(page);

    const shapeNodeLink = page.locator(`a[href$="/${shapeNode.nodeId}"]`).first();
    await expect(shapeNodeLink).toBeVisible({ timeout: 20000 });
    await shapeNodeLink.click();

    const startupTimeoutLogs: string[] = [];
    const receivingTaskSnapshotSuccessLogs: string[] = [];
    const receivingTaskSnapshotFailureLogs: string[] = [];
    const authRequiredLogs: string[] = [];
    const workerStartupLogs: string[] = [];
    const startupTrace: string[] = [];
    const pushStartupTrace = (entry: string): void => {
      startupTrace.push(entry);
      if (startupTrace.length > 60) {
        startupTrace.splice(0, startupTrace.length - 60);
      }
    };
    const pendingConsoleTasks = new Set<Promise<void>>();
    const handleStartupConsole = (msg: ConsoleMessage) => {
      const pending = (async () => {
        const text = msg.text();
        if (
          text.includes('[ShapeBuildProgressStep]')
          || text.includes('[ShapeBuildStartResumeTrace]')
          || text.includes('[ShapeReceivingTaskSnapshotDecisionTrace]')
          || text.includes('[ShapeBuildWorkerStageTrace]')
        ) {
          pushStartupTrace(text);
        }
        if (text.includes('[shapeBuildAPI] startup')) {
          workerStartupLogs.push(text);
          if (workerStartupLogs.length > 120) {
            workerStartupLogs.splice(0, workerStartupLogs.length - 120);
          }
        }
        if (text.includes('Authentication required')) {
          authRequiredLogs.push(text);
          return;
        }
        if (!text.includes('[ShapeBuildProgressStep]')) return;
        const payload = await readConsolePayload(msg);

        if (text.includes('build session transition timeout')) {
          const phase = readString(payload, 'phase');
          const elapsed = payload?.elapsedMs;
          startupTimeoutLogs.push(
            `timeout phase=${phase ?? '-'} elapsedMs=${typeof elapsed === 'number' ? elapsed : '-'}`
          );
          return;
        }

        if (text.includes('build session transition finish')) {
          const message = readString(payload, 'message');
          if (message?.includes('Build did not start task processing (receiving-task-snapshot')) {
            startupTimeoutLogs.push(message);
            return;
          }
          if (message?.includes('Build completed without generating tasks.')) {
            receivingTaskSnapshotSuccessLogs.push(JSON.stringify(payload));
          }
          return;
        }

        if (text.includes('build startup step finish')) {
          const step = readString(payload, 'step');
          if (step !== 'receiving-task-snapshot') return;
          const outcome = readString(payload, 'outcome');
          if (outcome === 'success') {
            receivingTaskSnapshotSuccessLogs.push(JSON.stringify(payload));
            return;
          }
          if (outcome === 'error' || outcome === 'cancelled' || outcome === 'failed') {
            receivingTaskSnapshotFailureLogs.push(JSON.stringify(payload));
          }
        }
      })();
      pendingConsoleTasks.add(pending);
      void pending.finally(() => {
        pendingConsoleTasks.delete(pending);
      });
    };

    const workerConsoleHandlers = new Map<Worker, (msg: ConsoleMessage) => void>();
    const attachWorkerConsole = (worker: Worker) => {
      if (workerConsoleHandlers.has(worker)) return;
      appendWorkerTraceLog(workerStartupLogs, 'worker-attach', worker.url());
      const handler = (msg: ConsoleMessage) => {
        const text = msg.text();
        if (
          text.includes('[shapeBuildAPI] startup')
          || text.includes('[shapeBuildAPI] progress snapshot')
          || text.includes('[ShapePipeline]')
        ) {
          appendWorkerTraceLog(workerStartupLogs, `worker:${worker.url()}`, text);
        }
      };
      workerConsoleHandlers.set(worker, handler);
      worker.on('console', handler);
    };
    const detachWorkerConsoles = () => {
      workerConsoleHandlers.forEach((handler, worker) => {
        worker.off('console', handler);
        appendWorkerTraceLog(workerStartupLogs, 'worker-detach', worker.url());
      });
      workerConsoleHandlers.clear();
    };

    page.workers().forEach(attachWorkerConsole);
    page.on('worker', attachWorkerConsole);
    page.on('console', handleStartupConsole);

    try {
      const openEditButton = page.getByRole('button', { name: /ノードを編集|Edit/i }).first();
      await expect(openEditButton).toBeVisible({ timeout: 10000 });
      await openEditButton.click();

      const buildStepButton = page.getByRole('button', { name: /^5\s*(ビルド|Build)/ }).first();
      await expect(buildStepButton).toBeVisible({ timeout: 10000 });
      await buildStepButton.click();

      const launchBuildButtonByTestId = page.getByTestId('build-control-start-resume-button');
      const launchBuildButton = await launchBuildButtonByTestId.isVisible({ timeout: 3000 }).catch(() => false)
        ? launchBuildButtonByTestId
        : page.getByRole('button', { name: /ビルドを開始|ビルド開始|Start|Build/i }).first();
      await expect(launchBuildButton).toBeVisible({ timeout: 10000 });
      await expect(launchBuildButton).toBeEnabled({ timeout: 20000 });
      await launchBuildButton.click();

      const waitStartMs = Date.now();
      while (Date.now() - waitStartMs < 60000) {
        await Promise.allSettled(Array.from(pendingConsoleTasks));
        const workerTrace = workerStartupLogs.slice(-20).join('\n');
        if (authRequiredLogs.length > 0) {
          throw new Error(
            `Auth required during build start: ${authRequiredLogs[0]}`
            + `\nRecent worker startup trace:\n${workerTrace || '(none)'}`
          );
        }
        if (startupTimeoutLogs.length > 0) {
          const workerDiagnostics = await collectWorkerDiagnostics(page, String(shapeNode.nodeId));
          const recentTrace = startupTrace.slice(-25).join('\n');
          throw new Error(
            `Startup timeout detected: ${startupTimeoutLogs[0]}`
            + `\nRecent startup trace:\n${recentTrace || '(none)'}`
            + `\nRecent worker startup trace:\n${workerTrace || '(none)'}`
            + `\nWorker diagnostics:\n${JSON.stringify(workerDiagnostics)}`
          );
        }
        if (receivingTaskSnapshotFailureLogs.length > 0) {
          const workerDiagnostics = await collectWorkerDiagnostics(page, String(shapeNode.nodeId));
          const recentTrace = startupTrace.slice(-25).join('\n');
          throw new Error(
            `Startup failed before receiving-task-snapshot signal: ${receivingTaskSnapshotFailureLogs[0]}`
            + `\nRecent startup trace:\n${recentTrace || '(none)'}`
            + `\nRecent worker startup trace:\n${workerTrace || '(none)'}`
            + `\nWorker diagnostics:\n${JSON.stringify(workerDiagnostics)}`
          );
        }
        if (receivingTaskSnapshotSuccessLogs.length > 0) {
          break;
        }
        await page.waitForTimeout(250);
      }
      if (receivingTaskSnapshotSuccessLogs.length === 0) {
        const recentTrace = startupTrace.slice(-15).join('\n');
        const workerTrace = workerStartupLogs.slice(-20).join('\n');
        throw new Error(
          `No explicit startup outcome within 60s.\nRecent startup trace:\n${recentTrace || '(none)'}`
          + `\nRecent worker startup trace:\n${workerTrace || '(none)'}`
        );
      }

      expect(authRequiredLogs).toHaveLength(0);
      expect(startupTimeoutLogs).toHaveLength(0);
      expect(receivingTaskSnapshotFailureLogs).toHaveLength(0);
      expect(receivingTaskSnapshotSuccessLogs.length).toBeGreaterThan(0);
    } finally {
      page.off('worker', attachWorkerConsole);
      detachWorkerConsoles();
      page.off('console', handleStartupConsole);
    }
  });

  test('shows task list and summary after build start', async ({ page, canonicalAuth }) => {
    test.setTimeout(180000);
    await canonicalAuth.signIn();

    await page.goto(buildAppUrl('t/r'), { waitUntil: 'domcontentloaded', timeout: 120000 });
    await dismissGuidedTour(page);
    await waitForTreeTableLoad(page);
    await page.waitForFunction(() => Boolean((window as WindowWithWorkerRef).__HDB_WORKER_CLIENT_REF__?.client), null, {
      timeout: 20000,
    });

    await page.evaluate(async () => {
      const ref = (window as WindowWithWorkerRef).__HDB_WORKER_CLIENT_REF__;
      const api = ref?.client ?? ref?.getAPI?.();
      if (api?.setCorsProxyBaseURL) {
        await api.setCorsProxyBaseURL('');
      }
    });

    const selectedArrayByCountries: SelectedArrayByCountries = { JP: [true] };
    const buildConfig = await page.evaluate(() => {
      return {
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
          zoomBandBoundaries: [1, 2, 3],
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
    });

    const shapeNode = await page.evaluate(async ({ buildConfig, selectedArrayByCountries }) => {
      const client = (window as WindowWithWorkerRef).__HDB_WORKER_CLIENT_REF__?.client;
      if (!client) throw new Error('Worker client not ready');
      const queryAPI = await client.getQueryAPI();
      const mutationAPI = await client.getMutationAPI();
      const updaterAPI = await client.getTreeNodeUpdaterAPI();

      const trees = await queryAPI.listTrees();
      const tree = trees.find((t: { id: string }) => t.id === 'r') ?? trees[0];
      if (!tree) throw new Error('No tree available');
      const name = `Shape Tasks ${Date.now()}`;
      const createResult = await mutationAPI.createNode({
        nodeType: 'shape',
        treeId: tree.id,
        parentId: tree.rootId,
        name,
      });
      if (!createResult.success) {
        throw new Error(`Failed to create shape node: ${String(createResult.error ?? 'unknown')}`);
      }
      const nodeId = createResult.nodeId;
      const draftPayload = {
        name,
        description: 'E2E build task list visibility test',
        buildConfig,
        selectedArrayByCountries,
        processingStatus: 'idle',
        licenseAgreement: true,
        licenseAgreedAt: new Date().toISOString(),
      };
      await updaterAPI.updateTreeNode(nodeId, {
        mode: 'save-draft',
        data: draftPayload,
        draftData: draftPayload,
      });
      return { treeId: tree.id, pageNodeId: tree.rootId, nodeId, name: draftPayload.name };
    }, { buildConfig, selectedArrayByCountries });

    await page.goto(buildAppUrl(`t/${shapeNode.treeId}/${shapeNode.pageNodeId}`), {
      waitUntil: 'domcontentloaded',
      timeout: 120000,
    });
    await waitForTreeTableLoad(page);

    const shapeNodeLink = page.locator(`a[href$="/${shapeNode.nodeId}"]`).first();
    await expect(shapeNodeLink).toBeVisible({ timeout: 20000 });
    await shapeNodeLink.click();

    const openEditButton = page.getByRole('button', { name: /ノードを編集|Edit/i }).first();
    await expect(openEditButton).toBeVisible({ timeout: 10000 });
    await openEditButton.click();

    const buildStepButton = page.getByRole('button', { name: /^5\s*(ビルド|Build)/ }).first();
    await expect(buildStepButton).toBeVisible({ timeout: 10000 });
    await buildStepButton.click();

    const zeroCountChip = page.locator('[aria-label="Completed 0/0"]').first();
    await expect(zeroCountChip).toBeVisible({ timeout: 10000 });

    const launchBuildButtonByTestId = page.getByTestId('build-control-start-resume-button');
    const launchBuildButton = await launchBuildButtonByTestId.isVisible({ timeout: 3000 }).catch(() => false)
      ? launchBuildButtonByTestId
      : page.getByRole('button', { name: /ビルドを開始|ビルド開始|Start|Build/i }).first();
    await expect(launchBuildButton).toBeVisible({ timeout: 10000 });
    await expect(launchBuildButton).toBeEnabled({ timeout: 20000 });
    await launchBuildButton.click();

    const taskItems = page.locator('[data-task-id]');
    await expect.poll(async () => await taskItems.count(), {
      timeout: 60000,
      intervals: [500, 1000, 2000],
    }).toBeGreaterThan(0);

    const statusLabel = page.getByText(/Queued|Running|Completed|待機|実行中|完了/).first();
    await expect(statusLabel).toBeVisible({ timeout: 10000 });
  });
});
