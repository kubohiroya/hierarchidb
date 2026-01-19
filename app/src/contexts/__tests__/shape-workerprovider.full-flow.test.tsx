import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import { render, cleanup, waitFor } from '@testing-library/react';
import React from 'react';
import type { WorkerAPI } from '@hierarchidb/common-api';
import type { NodeId, NodeType } from '@hierarchidb/common-types';
import { DEFAULT_BUILD_CONFIG, type SelectedArrayByCountries } from '@hierarchidb/shape-plugin';
import { WorkerProvider } from '../WorkerProvider.tsx';

// Run with: pnpm --filter @hierarchidb/app test -- --run src/contexts/__tests__/shape-workerprovider.full-flow.test.tsx
// Requires network access to GeoBoundaries.

const { APP_PREFIX } = vi.hoisted(() => {
  const prefix = `hidb-test-shape-worker-${Math.random().toString(36).slice(2)}`;
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
  const { shapeBatchAPI } = await import('@hierarchidb/shape-plugin/worker');

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
  }) => {
    const status = (task.status ?? 'queued').toLowerCase();
    const phase =
      status === 'idle'
        ? 'queued'
        : status === 'running' ||
            status === 'queued' ||
            status === 'completed' ||
            status === 'failed' ||
            status === 'paused' ||
            status === 'regression'
          ? status
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
      getSystemHealth: async () => services.getSystemHealth(),
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
      getCommandProcessor: async () => Comlink.proxy(services.getCommandProcessor()),
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
      (globalThis as { fetch?: typeof fetch }).fetch = (input, init) => {
        if (init?.signal) {
          const { signal: _signal, ...rest } = init;
          return originalFetch(input, rest);
        }
        return originalFetch(input, init);
      };
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
      };
      const selectedArrayByCountries: SelectedArrayByCountries = {
        JPN: [true, true],
      };
      const node = await updater.initTreeNode('shape' as NodeType, 'r:root' as NodeId, {
        metadata: { name: 'JPN Shape' },
        draftData: {
          buildConfig,
          selectedArrayByCountries,
        },
      });
      const nodeId = node.id as NodeId;

      const payloads = await api.generateShapeDownloadTaskPayloadsFromSelection(
        nodeId,
        'geoboundaries',
        selectedArrayByCountries
      );
      expect(payloads.length).toBeGreaterThan(0);

      await api.startBatchSession('shape' as NodeType, nodeId, payloads);

      const shapeQuery = await api.getShapeQueryAPI();

      await waitFor(
        async () => {
          const status = await shapeQuery.getProcessingStatus(nodeId);
          expect(status?.status).toBe('completed');
        },
        { timeout: 300000, interval: 2000 }
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
    { timeout: 300000 }
  );
});
