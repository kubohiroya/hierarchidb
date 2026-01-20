import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import { render, cleanup, waitFor } from '@testing-library/react';
import React from 'react';
import { readFile } from 'node:fs/promises';
import type {
  BatchProgressEvent,
  BatchProgressPayload,
  BatchTaskSummary,
  ProgressPhase,
  WorkerAPI,
} from '@hierarchidb/common-api';
import type { NodeId, NodeType } from '@hierarchidb/common-types';
import { DEFAULT_BUILD_CONFIG, type SelectedArrayByCountries } from '@hierarchidb/shape-plugin';
import { WorkerProvider } from '../WorkerProvider.tsx';

// Run with: pnpm --filter @hierarchidb/app test -- --run src/contexts/__tests__/shape-workerprovider.full-flow.test.tsx
// Requires network access to GeoBoundaries.

const { APP_PREFIX } = vi.hoisted(() => {
  const prefix = 'hidb';
  (globalThis as { APP_PREFIX?: string }).APP_PREFIX = prefix;
  return { APP_PREFIX: prefix };
});

vi.mock('@hierarchidb/ui-plugin-shell/ui-i18n', () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}));

vi.mock('~/worker-runtime/WorkerModuleLoader.ts', async () => {
  const loader = await import('~/worker-runtime/workerApiClientLoader.ts');
  return {
    ensureWorkerRuntime: async () => {
      const { WorkerAPIClient } = await loader.loadWorkerAPIClientModule();
      return WorkerAPIClient.getOrInit();
    },
    resetWorkerRuntime: () => {},
  };
});

vi.mock('~/worker-runtime/client.ts', async () => {
  const Comlink = await vi.importActual<typeof import('comlink')>('comlink');
  const { WorkerService } = await import('@hierarchidb/runtime-worker');
  type ShapeDownloadPayloads = Awaited<ReturnType<WorkerAPI['generateShapeDownloadTaskPayloadsFromSelection']>>;
  type ShapeBatchAPI = {
    startBatchProcess: (
      nodeId: NodeId,
      buildConfig: Record<string, unknown>,
      downloadTaskPayloads: unknown[],
      buildContinuationPolicy?: string
    ) => Promise<void>;
    getBatchStatus: (nodeId: NodeId) => Promise<{ status: string; progress?: number }>;
    invokeBatchCommand: (command: string, payload: Record<string, unknown>) => Promise<void>;
    getBatchTasks: (nodeId: NodeId) => Promise<Array<{
      taskId: string;
      type?: string;
      status?: string;
      progress?: number;
      message?: string;
    }>>;
    generateDownloadTaskPayloadsFromSelection: (
      nodeId: NodeId,
      dataSource: string,
      selectedArrayByCountries: SelectedArrayByCountries
    ) => Promise<ShapeDownloadPayloads>;
    subscribeToProgress: (
      nodeId: NodeId,
      callback: (payload: BatchProgressEvent<BatchProgressPayload>) => void
    ) => () => void;
  };
  const shapeWorker = await import('@hierarchidb/shape-plugin/worker') as unknown as {
    shapeBatchAPI: ShapeBatchAPI;
  };
  const { shapeBatchAPI } = shapeWorker;

  let workerClient: import('comlink').Remote<WorkerAPI> | null = null;
  let workerInitCompleted = false;
  let rawWorkerInstance: { terminate: () => void } | null = null;

  const resolveShapeDraftData = async (nodeId: NodeId) => {
    const services = await WorkerService.getSingleton([]);
    const updater = services.getTreeNodeUpdaterAPI();
    const node = await updater.getTreeNode(nodeId);
    const payload = (node?.draftData ?? node?.data) as Record<string, unknown> | undefined;
    if (!payload) {
      throw new Error(`[test-worker] draft data missing for node ${String(nodeId)}`);
    }
    const buildConfig = payload.buildConfig as Record<string, unknown> | undefined;
    if (!buildConfig) {
      throw new Error(`[test-worker] buildConfig missing for node ${String(nodeId)}`);
    }
    return buildConfig;
  };

  const toBatchSessionStatus = (nodeId: NodeId, status: string, progress?: number) => ({
    nodeId,
    status: status as 'idle' | 'running' | 'paused' | 'completed' | 'failed',
    progress: {
      total: 0,
      completed: 0,
      failed: 0,
      skipped: 0,
      percentage: progress ?? 0,
    },
    lastActivity: Date.now(),
  });

  const toBatchTaskSummary = (task: {
    taskId: string;
    type?: string;
    status?: string;
    progress?: number;
    message?: string;
  }): BatchTaskSummary => {
    const status = (task.status ?? 'queued').toLowerCase();
    const phase: ProgressPhase =
      status === 'idle'
        ? 'queued'
        : status === 'running' ||
            status === 'queued' ||
            status === 'completed' ||
            status === 'failed' ||
            status === 'paused' ||
            status === 'regression'
          ? (status as ProgressPhase)
          : 'queued';
    return {
      taskId: task.taskId,
      stage: task.type ?? 'unknown',
      status: phase,
      progress: task.progress ?? 0,
      message: task.message,
    };
  };

  const createWorkerApi = async (): Promise<WorkerAPI> => {
    const services = await WorkerService.getSingleton([]);
    return {
      ping: async () => ({ response: 'pong', timestamp: Date.now() }),
      initialize: async () => {},
      shutdown: async () => services.shutdown(),
      getSystemHealth: async () => {
        const health = await services.getSystemHealth();
        return {
          ...health,
          databases: {
            coreDB: health.databases?.coreDB ?? false,
            ephemeralDB: false,
          },
        };
      },
      getQueryAPI: async () => Comlink.proxy(services.getQueryAPI()),
      getMutationAPI: async () => Comlink.proxy(services.getMutationAPI()),
      getSubscriptionAPI: async () => Comlink.proxy(services.getSubscriptionAPI()),
      getTreeNodeUpdaterAPI: async () => Comlink.proxy(services.getTreeNodeUpdaterAPI()),
      getTreeTableExpandedAPI: async () => Comlink.proxy(services.getTreeTableExpandedAPI()),
      getImportExportAPI: async () => Comlink.proxy(services.getImportExportAPI()),
      getTagAPI: async () => Comlink.proxy(services.getTagAPI()),
      getStyleQueryAPI: async () => Comlink.proxy(services.getStyleQueryAPI()),
      getStyleMutationAPI: async () => Comlink.proxy(services.getStyleMutationAPI()),
      getShapeQueryAPI: async () => Comlink.proxy(services.getShapeQueryAPI()),
      getShapeMutationAPI: async () => Comlink.proxy(services.getShapeMutationAPI()),
      getLocationQueryAPI: async () => Comlink.proxy(services.getLocationQueryAPI()),
      getLocationMutationAPI: async () => Comlink.proxy(services.getLocationMutationAPI()),
      getRouteQueryAPI: async () => Comlink.proxy(services.getRouteQueryAPI()),
      getRouteMutationAPI: async () => Comlink.proxy(services.getRouteMutationAPI()),
      getPluginLifecycleAPI: async () => Comlink.proxy(services.getPluginLifecycleAPI()),
      getCommandProcessor: async () => (
        Comlink.proxy(services.getCommandProcessor()) as unknown as Awaited<ReturnType<WorkerAPI['getCommandProcessor']>>
      ),
      startBatchSession: async (nodeType, nodeId, downloadTaskPayloads, buildContinuationPolicy) => {
        if (nodeType !== ('shape' as NodeType)) {
          throw new Error(`[test-worker] unsupported nodeType ${String(nodeType)}`);
        }
        const buildConfig = await resolveShapeDraftData(nodeId);
        await shapeBatchAPI.startBatchProcess(
          nodeId,
          buildConfig,
          downloadTaskPayloads ?? [],
          buildContinuationPolicy
        );
        const batchStatus = await shapeBatchAPI.getBatchStatus(nodeId);
        return toBatchSessionStatus(nodeId, batchStatus.status, batchStatus.progress);
      },
      getBatchSessionStatus: async (nodeType, nodeId) => {
        if (nodeType !== ('shape' as NodeType)) {
          return toBatchSessionStatus(nodeId, 'idle');
        }
        const batchStatus = await shapeBatchAPI.getBatchStatus(nodeId);
        return toBatchSessionStatus(nodeId, batchStatus.status, batchStatus.progress);
      },
      pauseBatchSession: async (_nodeType, nodeId) => {
        await shapeBatchAPI.invokeBatchCommand('session/pause', { nodeId });
      },
      resumeBatchSession: async (_nodeType, nodeId, buildContinuationPolicy) => {
        await shapeBatchAPI.invokeBatchCommand('session/resume', { nodeId, buildContinuationPolicy });
      },
      getBatchTasks: async (_nodeType, nodeId) => {
        const tasks = await shapeBatchAPI.getBatchTasks(nodeId);
        return tasks.map(toBatchTaskSummary);
      },
      generateShapeDownloadTaskPayloadsFromSelection: async (
        nodeId,
        dataSource,
        selectedArrayByCountries
      ) =>
        shapeBatchAPI.generateDownloadTaskPayloadsFromSelection(
          nodeId,
          dataSource,
          selectedArrayByCountries
        ),
      subscribeBatchProgress: async (_nodeType, nodeId, callback) => {
        const unsubscribe = shapeBatchAPI.subscribeToProgress(nodeId, callback);
        return () => unsubscribe();
      },
      subscribeHeapPressure: async () => () => {},
      setUiStorageBridge: async () => {},
      setAuthToken: async () => {},
      setCorsProxyBaseURL: async () => {},
    };
  };

  const createWorkerClient = async (): Promise<import('comlink').Remote<WorkerAPI>> => {
    const channel = new MessageChannel();
    channel.port1.start();
    channel.port2.start();
    rawWorkerInstance = { terminate: () => channel.port2.close() };
    const api = await createWorkerApi();
    Comlink.expose(api, channel.port2);
    workerInitCompleted = true;
    return Comlink.wrap<WorkerAPI>(channel.port1);
  };

  return {
    getWorkerClient: async () => {
      if (!workerClient) {
        workerClient = await createWorkerClient();
      }
      return workerClient;
    },
    getRawWorkerInstance: () => rawWorkerInstance,
    isWorkerInitCompleted: () => workerInitCompleted,
  };
});

describe('Shape WorkerProvider full flow', () => {
  const originalAbortSignal = globalThis.AbortSignal;
  const originalFetch = globalThis.fetch;
  const isoCsvUrl = new URL('../../../public/iso3166-2-level1.csv', import.meta.url);
  let isoCsvTextPromise: Promise<string> | null = null;

  beforeAll(() => {
    (globalThis as { APP_PREFIX?: string }).APP_PREFIX = APP_PREFIX;
    try {
      const controller = new AbortController();
      const signalCtor = controller.signal?.constructor;
      if (signalCtor && globalThis.AbortSignal !== signalCtor) {
        (globalThis as { AbortSignal?: typeof AbortSignal }).AbortSignal =
          signalCtor as typeof AbortSignal;
      }
    } catch {
      // Ignore AbortSignal alignment failures for environments without AbortController.
    }
    if (typeof originalFetch === 'function') {
      const wrappedFetch: typeof fetch = (input, init) => {
        const url = typeof input === 'string'
          ? input
          : input instanceof URL
            ? input.toString()
            : input.url;
        if (url.endsWith('/iso3166-2-level1.csv')) {
          if (!isoCsvTextPromise) {
            isoCsvTextPromise = readFile(isoCsvUrl, 'utf8');
          }
          return isoCsvTextPromise.then(
            (text) =>
              new Response(text, {
                status: 200,
                headers: { 'Content-Type': 'text/csv' },
              })
          );
        }
        try {
          if (init?.signal) {
            const { signal: _signal, ...rest } = init;
            return originalFetch(input, rest).catch((error) => {
              console.log('[shape-workerprovider] fetch failed', { input, error });
              throw error;
            });
          }
          return originalFetch(input, init).catch((error) => {
            console.log('[shape-workerprovider] fetch failed', { input, error });
            throw error;
          });
        } catch (error) {
          console.log('[shape-workerprovider] fetch threw', { input, error });
          throw error;
        }
      };
      (globalThis as { fetch?: typeof fetch }).fetch = wrappedFetch;
      if (typeof window !== 'undefined') {
        (window as { fetch?: typeof fetch }).fetch = wrappedFetch;
      }
    }
  });

  afterAll(() => {
    (globalThis as { AbortSignal?: typeof AbortSignal }).AbortSignal = originalAbortSignal;
    if (originalFetch) {
      (globalThis as { fetch?: typeof fetch }).fetch = originalFetch;
    }
  });

  afterEach(() => {
    cleanup();
  });

  const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

  it(
    'runs fetch/transform/vt through WorkerProvider with JPN ADM0/ADM1 and persists outputs',
    async () => {
      render(
        <WorkerProvider renderOverlay={false} fallback={null}>
          <span data-testid="worker-provider-ready" />
        </WorkerProvider>
      );

      const api = await waitFor(
        async () => {
          const win = window as Window & {
            __HDB_WORKER_CLIENT_REF__?: {
              getAPI: () => WorkerAPI;
              isInitialized?: boolean;
              client?: WorkerAPI | null;
              error?: Error | null;
            };
          };
          const clientRef = win.__HDB_WORKER_CLIENT_REF__;
          if (!clientRef) {
            throw new Error('WorkerProvider client ref missing');
          }
          if (clientRef.error) {
            throw clientRef.error;
          }
          if (!clientRef.isInitialized || !clientRef.client) {
            throw new Error('WorkerProvider client not ready');
          }
          return clientRef.getAPI();
        },
        { timeout: 20000, interval: 200 }
      );
      const updater = await api.getTreeNodeUpdaterAPI();
      const buildConfig = {
        ...DEFAULT_BUILD_CONFIG,
        dataSourceName: 'geoboundaries',
        transformConfig: {
          ...DEFAULT_BUILD_CONFIG.transformConfig,
          zoomBandBoundaries: [0, 4],
          selfIntersectionTuningConfig: {
            ...DEFAULT_BUILD_CONFIG.transformConfig.selfIntersectionTuningConfig,
            disableAtZoomOrBelow: 11,
          },
          tolerance: 1,
          preSimplifyFilterConfig: {
            ...DEFAULT_BUILD_CONFIG.transformConfig.preSimplifyFilterConfig,
            maxVerticesPerFeature: 20000,
          },
        },
      };
      const selectedArrayByCountries: SelectedArrayByCountries = {
        JPN: [true, true],
      };
      const node = await updater.initTreeNode('shape' as NodeType, 'r:root' as NodeId, {
        metadata: { name: 'JPN Shape', description: '', tags: [] },
        draftData: {
          buildConfig,
          selectedArrayByCountries,
        },
      });
      const nodeId = node.id as NodeId;

      console.log('[shape-workerprovider] fetch metadata url', {
        url: 'https://geoboundaries.org/api/current/gbOpen/ALL/ALL/',
      });

      let payloads = null;
      try {
        payloads = await api.generateShapeDownloadTaskPayloadsFromSelection(
          nodeId,
          'geoboundaries',
          selectedArrayByCountries
        );
      } catch (error) {
        console.log('[shape-workerprovider] generate payloads failed', {
          error,
          cause: (error as { cause?: unknown } | undefined)?.cause,
        });
        throw error;
      }
      expect(payloads.length).toBeGreaterThan(0);

      console.log(
        '[shape-workerprovider] download payloads',
        payloads.map((payload) => ({
          url: payload.url,
          countryCode: payload.countryCode,
          adminLevel: payload.adminLevel,
        }))
      );

      try {
        await api.startBatchSession('shape' as NodeType, nodeId, payloads);
      } catch (error) {
        console.log('[shape-workerprovider] startBatchSession failed', {
          error,
          cause: (error as { cause?: unknown } | undefined)?.cause,
        });
        throw error;
      }

      const shapeQuery = await api.getShapeQueryAPI();

      const startAt = Date.now();
      let lastProgressAt = startAt;
      let lastCompleted = 0;
      let lastFailed = 0;
      let lastTotal = 0;
      let lastTaskSummary = '';
      let lastDiagnosticsAt = startAt;
      const pollIntervalMs = 10000;
      const stallThresholdMs = 240000;
      const maxRuntimeMs = 900000;

      const summarizeTasks = (tasks: Array<{ stage?: string; status?: string }>): string => {
        const stages = ['fetch', 'transform', 'vt'] as const;
        const summary: Record<(typeof stages)[number], {
          queued: number;
          running: number;
          completed: number;
          failed: number;
          skipped: number;
        }> = {
          fetch: { queued: 0, running: 0, completed: 0, failed: 0, skipped: 0 },
          transform: { queued: 0, running: 0, completed: 0, failed: 0, skipped: 0 },
          vt: { queued: 0, running: 0, completed: 0, failed: 0, skipped: 0 },
        };
        tasks.forEach((task) => {
          const stage = stages.find((value) => value === task.stage);
          if (!stage) return;
          const status = (task.status ?? 'queued').toLowerCase();
          if (status === 'failed') summary[stage].failed += 1;
          else if (status === 'completed') summary[stage].completed += 1;
          else if (status === 'running') summary[stage].running += 1;
          else if (status === 'queued') summary[stage].queued += 1;
          else if (status === 'paused') summary[stage].queued += 1;
          else if (status === 'regression') summary[stage].queued += 1;
        });
        return JSON.stringify(summary);
      };
      const countTasks = (summary: Record<string, Record<string, number>>) => {
        const totals = { total: 0, done: 0 };
        Object.values(summary).forEach((stageSummary) => {
          const safeSummary = {
            queued: 0,
            running: 0,
            completed: 0,
            failed: 0,
            skipped: 0,
            ...stageSummary,
          };
          const stageTotal =
            safeSummary.queued +
            safeSummary.running +
            safeSummary.completed +
            safeSummary.failed +
            safeSummary.skipped;
          const stageDone =
            safeSummary.completed +
            safeSummary.failed +
            safeSummary.skipped;
          totals.total += stageTotal;
          totals.done += stageDone;
        });
        return totals;
      };

      while (Date.now() - startAt < maxRuntimeMs) {
        const [session, tasks] = await Promise.all([
          api.getBatchSessionStatus('shape' as NodeType, nodeId),
          api.getBatchTasks('shape' as NodeType, nodeId),
        ]);

        const failedTasks = tasks.filter((task) => task.status === 'failed');
        if (failedTasks.length > 0) {
          const summary = failedTasks
            .map((task) => `${task.taskId}:${task.stage}:${task.message ?? 'failed'}`)
            .join('; ');
          throw new Error(`[shape-workerprovider] failed tasks: ${summary}`);
        }

        const progress = session.progress ?? {
          total: 0,
          completed: 0,
          failed: 0,
          skipped: 0,
          percentage: 0,
        };

        const taskSummary = summarizeTasks(tasks);
        const taskSummaryObj = JSON.parse(taskSummary) as Record<string, Record<string, number>>;
        const { total: totalTasks, done: doneTasks } = countTasks(taskSummaryObj);
        const changed =
          progress.completed !== lastCompleted ||
          progress.failed !== lastFailed ||
          progress.total !== lastTotal ||
          taskSummary !== lastTaskSummary;

        if (changed) {
          lastProgressAt = Date.now();
          lastCompleted = progress.completed;
          lastFailed = progress.failed;
          lastTotal = progress.total;
          lastTaskSummary = taskSummary;
          console.log('[shape-workerprovider] progress', {
            total: progress.total,
            completed: progress.completed,
            failed: progress.failed,
            percentage: progress.percentage,
            sessionStatus: session.status,
            taskSummary: taskSummaryObj,
            elapsedMs: Date.now() - startAt,
          });
        }
        if (tasks.length === 0 && Date.now() - lastDiagnosticsAt > 30000) {
          lastDiagnosticsAt = Date.now();
          console.log('[shape-workerprovider] task-queue snapshot', {
            nodeId,
            totalTasks: 0,
          });
        }

        if (session.status === 'completed' || (totalTasks > 0 && doneTasks >= totalTasks)) {
          break;
        }

        if (Date.now() - lastProgressAt > stallThresholdMs) {
          throw new Error(
            `[shape-workerprovider] stalled: sessionStatus=${session.status ?? 'unknown'}`
          );
        }

        if (session.status === 'paused') {
          throw new Error('[shape-workerprovider] batch session paused');
        }

        await sleep(pollIntervalMs);
      }

      const [_finalStatus, finalSession, finalTasks] = await Promise.all([
        shapeQuery.getProcessingStatus(nodeId),
        api.getBatchSessionStatus('shape' as NodeType, nodeId),
        api.getBatchTasks('shape' as NodeType, nodeId),
      ]);
      const finalSummary = JSON.parse(summarizeTasks(finalTasks)) as Record<
        string,
        Record<string, number>
      >;
      const { total: finalTotal, done: finalDone } = countTasks(finalSummary);
      expect(finalSession.status === 'completed' || (finalTotal > 0 && finalDone >= finalTotal)).toBe(
        true
      );

      const [featureMetadata, vectorTiles, sourceMetadata] = await Promise.all([
        shapeQuery.listFeatureMetadata(nodeId),
        shapeQuery.listVectorTiles(nodeId),
        shapeQuery.listSourceMetadata(nodeId),
      ]);

      expect(featureMetadata.length).toBeGreaterThan(0);
      expect(vectorTiles.length).toBeGreaterThan(0);
      expect(sourceMetadata.length).toBeGreaterThan(0);

      const hasAdm0 = featureMetadata.some(
        (entry) => entry.countryCode === 'JPN' && entry.adminLevel === 0
      );
      const hasAdm1 = featureMetadata.some(
        (entry) => entry.countryCode === 'JPN' && entry.adminLevel === 1
      );
      expect(hasAdm0).toBe(true);
      expect(hasAdm1).toBe(true);
    },
    { timeout: 900000 }
  );
});
