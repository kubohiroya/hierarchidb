/**
 * Worker entry point (error-safe)
 * Keep imports explicit to stabilize preview bundling.
 */

import './worker-react-refresh-shim.js';
import type { PluginDefinition } from '@hierarchidb/plugin-registry/types';
import type { NodeId, NodeType } from '@hierarchidb/common-types';
import type {
  BatchProgressEvent,
  BatchSessionStatus,
  BatchTaskSummary,
} from '@hierarchidb/common-api';
import {
  getAllRuntimeExports,
  WorkerInitializationReporter,
  wirePluginsFromModules,
} from '@hierarchidb/ui-worker-client';
import {
  getWorkerContainer,
  configureWorkerContainer,
  type PluginWorkerModuleLoader,
  WorkerDiTokens,
  WorkerService,
} from '@hierarchidb/runtime-worker';
import { setCorsProxyBaseURL } from '@hierarchidb/download';
import { AuthRecoveryService } from '@hierarchidb/auth-recovery';
import {
  createHeapPressureMonitor,
  type HeapPressureContext,
  type HeapPressureEvent,
} from '@hierarchidb/memory';
import {
  pluginDefinitions as staticPluginDefinitions,
} from '~/plugin-loaders/index.ts';
import { pluginWorkerLoaders } from '~/plugin-loaders/worker-loaders.ts';

/** Runtime export metadata (subset consumed during bootstrap). */
type RuntimeExportEntry = {
  lifecycle?: unknown;
  createEntityHandler?: () => Promise<unknown>;
};

type ManualPluginSelf = typeof self & {
  __HIERARCHIDB_MANUAL_PLUGIN_DEFS__?: PluginDefinition[];
};

type WorkerMessagePort = typeof self & {
  postMessage?: (msg: unknown) => void;
};

type BatchTaskProvider = (sessionId: string) => Promise<BatchTaskSummary[]>;
type BatchProgressSubscriber = (sessionId: string, callback: (event: BatchProgressEvent) => void) => () => void;

type ShapeBatchAPI = {
  startBatchProcessing: (draftId: NodeId, batchConfig: unknown, urlMetadata: unknown[]) => Promise<string>;
  getDraft?: (draftId: NodeId) => Promise<unknown>;
  getBatchSession?: (sessionId: string) => Promise<unknown>;
  pauseBatchProcessing?: (draftId: NodeId) => Promise<void>;
  resumeBatchProcessing?: (draftId: NodeId) => Promise<string>;
  cancelBatchProcessing?: (draftId: NodeId) => Promise<void>;
  invokeBatchCommand?: (command: string, payload: Record<string, unknown>) => Promise<void>;
  subscribeToProgress?: BatchProgressSubscriber;
};

const heapMonitor = createHeapPressureMonitor({ source: 'worker' });
const heapListeners = new Set<(event: HeapPressureEvent) => void>();
heapMonitor.subscribe((event) => {
  heapListeners.forEach((listener) => listener(event));
});
heapMonitor.start();

const setHeapContext = (context: HeapPressureContext | null) => {
  heapMonitor.setContext(context);
};

const resolveBatchTaskProvider = (mod: unknown): BatchTaskProvider | null => {
  if (!mod || (typeof mod !== 'object' && typeof mod !== 'function')) return null;
  const record = mod as Record<string, unknown>;
  const direct = record.getBatchTaskSummaries ?? record.getBatchTasks;
  if (typeof direct === 'function') {
    return direct as BatchTaskProvider;
  }
  const shapePlugin = record.ShapeWorkerPlugin as { api?: Record<string, unknown>; batch?: Record<string, unknown> } | undefined;
  const api = shapePlugin?.batch ?? shapePlugin?.api;
  const apiFn = api?.getBatchTasks ?? api?.listBatchTasks;
  if (typeof apiFn === 'function') {
    return (sessionId: string) => (apiFn as (id: string) => Promise<BatchTaskSummary[]>)(sessionId);
  }
  return null;
};

const resolveShapeBatchAPI = (mod: unknown): ShapeBatchAPI | null => {
  if (!mod || (typeof mod !== 'object' && typeof mod !== 'function')) return null;
  const record = mod as Record<string, unknown>;
  const direct = (record.shapeBatchAPI ?? record.shapePluginAPI) as ShapeBatchAPI | undefined;
  if (direct?.startBatchProcessing) {
    return direct;
  }
  const shapePlugin = record.ShapeWorkerPlugin as { api?: ShapeBatchAPI; batch?: ShapeBatchAPI } | undefined;
  const api = shapePlugin?.batch ?? shapePlugin?.api;
  if (api?.startBatchProcessing) {
    return api;
  }
  return null;
};

const toBatchSessionStatus = (
  session: Record<string, unknown> | undefined,
  fallbackNodeId: NodeId,
  fallbackSessionId: string,
): BatchSessionStatus => {
  const progress = (session?.progress as Record<string, unknown> | undefined) ?? {};
  return {
    sessionId: (session?.sessionId as string | undefined) ?? fallbackSessionId,
    nodeId: (session?.nodeId as NodeId | undefined) ?? (session?.draftId as NodeId | undefined) ?? fallbackNodeId,
    status: (session?.status as BatchSessionStatus['status'] | undefined) ?? 'idle',
    progress: {
      total: (progress.total as number | undefined) ?? 0,
      completed: (progress.completed as number | undefined) ?? 0,
      failed: (progress.failed as number | undefined) ?? 0,
      skipped: (progress.skipped as number | undefined) ?? 0,
      percentage: (progress.percentage as number | undefined) ?? 0,
      currentStage: progress.currentStage as string | undefined,
      currentTask: progress.currentTask as string | undefined,
    },
    startedAt: session?.startedAt as number | undefined,
    completedAt: session?.completedAt as number | undefined,
    lastActivity: session?.updatedAt as number | undefined,
    error: session?.error as string | undefined,
  };
};

const coerceRecord = (value: unknown): Record<string, unknown> => {
  if (value && typeof value === 'object') {
    return value as Record<string, unknown>;
  }
  return {};
};

// Provide minimal Node-like globals for libraries that expect them.
const globalShim = globalThis as typeof globalThis & {
  global?: typeof globalThis;
  process?: { env: Record<string, unknown> };
};
if (typeof globalShim.global === 'undefined') {
  globalShim.global = globalShim;
}
if (!globalShim.process) {
  globalShim.process = { env: {} } as typeof globalShim.process;
}
if (!globalShim.process.env) {
  globalShim.process.env = {};
}
if (typeof import.meta.env?.VITE_CORS_PROXY_BASE_URL === 'string') {
  const value = import.meta.env.VITE_CORS_PROXY_BASE_URL;
  if (value.length > 0) {
    setCorsProxyBaseURL(value);
  }
}

const reporter = new WorkerInitializationReporter(
  [
    { name: 'Load Comlink', weight: 5 },
    { name: 'Load plugin loaders', weight: 10 },
    { name: 'Load plugin-loaders', weight: 35 },
    { name: 'Bootstrap services', weight: 30 },
    { name: 'Create API facade', weight: 10 },
    { name: 'Expose API', weight: 10 },
  ],
  false
);
reporter.reportStepProgress('Load Comlink', 0);

(async () => {
  try {
    reporter.reportStepProgress('Load Comlink', 10);
    const Comlink = await import('comlink');
    reporter.reportStepProgress('Load Comlink', 100);

    reporter.reportStepProgress('Load plugin loaders', 100);

    const pluginDefinitions: PluginDefinition[] = Array.isArray(staticPluginDefinitions)
      ? [...(staticPluginDefinitions as PluginDefinition[])]
      : [];

    const legacyDefs = (self as ManualPluginSelf).__HIERARCHIDB_MANUAL_PLUGIN_DEFS__;
    if (Array.isArray(legacyDefs)) {
      pluginDefinitions.push(...legacyDefs);
    }

    // Note: Legacy workerModuleLoaders are no longer generated; the DI-provided moduleLoader now resolves plugin bundles.

    const denyEnv =
      typeof import.meta.env.VITE_HDB_WORKER_PLUGIN_DENY === 'string'
        ? import.meta.env.VITE_HDB_WORKER_PLUGIN_DENY
        : '';
    const denyList = new Set(
      denyEnv
        .split(',')
        .map((entry) => entry.trim())
        .filter(Boolean)
    );

    const moduleEntries: Array<{ nodeType: string; mod: unknown }> = [];

    configureWorkerContainer((container) => {
      container.rebind(WorkerDiTokens.PluginWorkerLoaderMap).toConstantValue(pluginWorkerLoaders);
    });

    const workerContainer = getWorkerContainer();
    const moduleLoader = workerContainer.get<PluginWorkerModuleLoader>(
      WorkerDiTokens.PluginWorkerModuleLoader
    );

    for (const definition of pluginDefinitions) {
      const nodeType = definition?.nodeType;
      if (!nodeType || denyList.has(nodeType)) {
        continue;
      }
      const localLoader = pluginWorkerLoaders[nodeType];
      if (localLoader) {
        try {
          const mod = await localLoader();
          moduleEntries.push({ nodeType, mod });
          const progress = Math.round((moduleEntries.length / pluginDefinitions.length) * 100);
          reporter.reportStepProgress('Load plugin-loaders', progress);
          continue;
        } catch (loaderError) {
          const msg = loaderError instanceof Error ? loaderError.message : String(loaderError);
          console.warn(
            `[worker bootstrap] local loader failed for ${nodeType}, fallback to registry loader:`,
            msg
          );
        }
      }

      if (!moduleLoader.has(nodeType)) {
        continue;
      }
      try {
        const mod = await moduleLoader.importModule(nodeType);
        moduleEntries.push({ nodeType, mod });
        const progress = Math.round((moduleEntries.length / pluginDefinitions.length) * 100);
        reporter.reportStepProgress('Load plugin-loaders', progress);
      } catch (error) {
        const msg = error instanceof Error ? error.message : String(error);
        const softFailure = /document is not defined|Grid2|does not provide an export/i.test(msg);
        const prefix = `[worker bootstrap] failed to load worker for ${nodeType}:`;
        if (import.meta.env.DEV || softFailure) {
          console.warn(prefix, msg);
        } else {
          throw error;
        }
      }
    }

    if (moduleEntries.length > 0) {
      await wirePluginsFromModules(moduleEntries);
    }

    if (pluginDefinitions.length > 0) {
      reporter.reportStepProgress('Load plugin-loaders', 100);
    }

    const exportsByType = getAllRuntimeExports() as Record<string, RuntimeExportEntry>;
    const enrichedDefinitions = pluginDefinitions.map((definition) => {
      const extra = exportsByType?.[definition.nodeType];
      return extra?.lifecycle ? { ...definition, lifecycle: extra.lifecycle } : definition;
    });

    const batchTaskProviders = new Map<NodeType, BatchTaskProvider>();
    const shapeBatchAPIs = new Map<NodeType, ShapeBatchAPI>();
    for (const entry of moduleEntries) {
      const provider = resolveBatchTaskProvider(entry.mod);
      if (provider) {
        batchTaskProviders.set(entry.nodeType as NodeType, provider);
      }
      const batchApi = resolveShapeBatchAPI(entry.mod);
      if (batchApi) {
        shapeBatchAPIs.set(entry.nodeType as NodeType, batchApi);
      }
    }

    try {
      // Use a static import to avoid bundler facade re-export mismatches in preview builds.
      reporter.reportStepProgress('Bootstrap services', 10);
      const services = await WorkerService.getSingleton(
        enrichedDefinitions.length > 0 ? enrichedDefinitions : pluginDefinitions
      );
      reporter.reportStepProgress('Bootstrap services', 60);
      reporter.reportStepProgress('Bootstrap services', 100);

      const messagePort = self as WorkerMessagePort;
      messagePort.postMessage?.({ type: 'SERVICES_READY', source: 'worker', at: Date.now() });

      reporter.reportStepProgress('Create API facade', 10);

      const resolveShapeBatchApiOrThrow = (nodeType: NodeType): ShapeBatchAPI => {
        const api = shapeBatchAPIs.get(nodeType);
        if (!api) {
          throw new Error(`[worker bootstrap] Batch API not available for nodeType: ${nodeType}`);
        }
        return api;
      };

      const api = {
        ping: () => services.ping(),
        initialize: () => services.initialize(),
        shutdown: () => services.shutdown(),
        getSystemHealth: () => services.getSystemHealth(),
        getQueryAPI: () => Comlink.proxy(services.getQueryAPI()),
        getMutationAPI: () => Comlink.proxy(services.getMutationAPI()),
        getSubscriptionAPI: () => Comlink.proxy(services.getSubscriptionAPI()),
        getTreeNodeUpdaterAPI: () => Comlink.proxy(services.getTreeNodeUpdaterAPI()),
        getTreeTableExpandedAPI: () => Comlink.proxy(services.getTreeTableExpandedAPI()),
        getPluginLifecycleAPI: () => Comlink.proxy(services.getPluginLifecycleAPI()),
        getStyleQueryAPI: () => Comlink.proxy(services.getStyleQueryAPI()),
        getStyleMutationAPI: () => Comlink.proxy(services.getStyleMutationAPI()),
        getShapeQueryAPI: () => Comlink.proxy(services.getShapeQueryAPI()),
        getShapeMutationAPI: () => Comlink.proxy(services.getShapeMutationAPI()),
        getLocationQueryAPI: () => Comlink.proxy(services.getLocationQueryAPI()),
        getRouteQueryAPI: () => Comlink.proxy(services.getRouteQueryAPI()),
        getRouteMutationAPI: () => Comlink.proxy(services.getRouteMutationAPI()),
        getImportExportAPI: () => Comlink.proxy(services.getImportExportAPI()),
        getTagAPI: () => Comlink.proxy(services.getTagAPI()),
        getCommandProcessor: () => Comlink.proxy(services.getCommandProcessor()),
        startBatchSession: async (nodeType: NodeType, nodeId: NodeId): Promise<BatchSessionStatus> => {
          const api = resolveShapeBatchApiOrThrow(nodeType);
          const draft = api.getDraft ? await api.getDraft(nodeId) : undefined;
          const fallbackNode = await services.getTreeNodeUpdaterAPI().getTreeNode(nodeId);
          const draftData = coerceRecord(
            (draft as { draftData?: unknown } | undefined)?.draftData
              ?? (draft as { data?: unknown } | undefined)?.data
              ?? (fallbackNode as { draftData?: unknown } | undefined)?.draftData
              ?? (fallbackNode as { data?: unknown } | undefined)?.data
          );
          const batchConfig = (draftData as { batchConfig?: unknown }).batchConfig ?? {};
          const urlMetadata = (draftData as { urlMetadata?: unknown[] }).urlMetadata ?? [];
          const sessionId = await api.startBatchProcessing(nodeId, batchConfig, urlMetadata);
          const session = api.getBatchSession ? await api.getBatchSession(sessionId) : undefined;
          const status = toBatchSessionStatus(
            session as Record<string, unknown> | undefined,
            nodeId,
            sessionId
          );
          setHeapContext({ nodeType, sessionId: status.sessionId });
          return status;
        },
        getBatchSessionStatus: async (nodeType: NodeType, sessionId: string): Promise<BatchSessionStatus> => {
          const api = resolveShapeBatchApiOrThrow(nodeType);
          const session = api.getBatchSession ? await api.getBatchSession(sessionId) : undefined;
          const fallbackNodeId = (session as { nodeId?: NodeId; draftId?: NodeId } | undefined)?.nodeId
            ?? (session as { draftId?: NodeId } | undefined)?.draftId
            ?? (sessionId as NodeId);
          return toBatchSessionStatus(
            session as Record<string, unknown> | undefined,
            fallbackNodeId,
            sessionId
          );
        },
        pauseBatchSession: async (nodeType: NodeType, sessionId: string): Promise<void> => {
          const api = resolveShapeBatchApiOrThrow(nodeType);
          if (api.invokeBatchCommand) {
            await api.invokeBatchCommand('session/pause', { sessionId });
            return;
          }
          const session = api.getBatchSession ? await api.getBatchSession(sessionId) : undefined;
          const draftId = (session as { nodeId?: NodeId; draftId?: NodeId } | undefined)?.nodeId
            ?? (session as { draftId?: NodeId } | undefined)?.draftId
            ?? (sessionId as NodeId);
          if (api.pauseBatchProcessing) {
            await api.pauseBatchProcessing(draftId);
          }
        },
        resumeBatchSession: async (nodeType: NodeType, sessionId: string): Promise<void> => {
          const api = resolveShapeBatchApiOrThrow(nodeType);
          if (api.invokeBatchCommand) {
            await api.invokeBatchCommand('session/resume', { sessionId });
            setHeapContext({ nodeType, sessionId });
            return;
          }
          const session = api.getBatchSession ? await api.getBatchSession(sessionId) : undefined;
          const draftId = (session as { nodeId?: NodeId; draftId?: NodeId } | undefined)?.nodeId
            ?? (session as { draftId?: NodeId } | undefined)?.draftId
            ?? (sessionId as NodeId);
          if (api.resumeBatchProcessing) {
            await api.resumeBatchProcessing(draftId);
          }
          setHeapContext({ nodeType, sessionId });
        },
        cancelBatchSession: async (nodeType: NodeType, sessionId: string): Promise<void> => {
          const api = resolveShapeBatchApiOrThrow(nodeType);
          if (api.invokeBatchCommand) {
            await api.invokeBatchCommand('session/cancel', { sessionId });
            setHeapContext(null);
            return;
          }
          const session = api.getBatchSession ? await api.getBatchSession(sessionId) : undefined;
          const draftId = (session as { nodeId?: NodeId; draftId?: NodeId } | undefined)?.nodeId
            ?? (session as { draftId?: NodeId } | undefined)?.draftId
            ?? (sessionId as NodeId);
          if (api.cancelBatchProcessing) {
            await api.cancelBatchProcessing(draftId);
          }
          setHeapContext(null);
        },
        subscribeBatchProgress: async (
          nodeType: NodeType,
          sessionId: string,
          callback: (event: BatchProgressEvent) => void,
        ): Promise<() => void> => {
          const api = resolveShapeBatchApiOrThrow(nodeType);
          if (!api.subscribeToProgress) {
            return () => {};
          }
          const unsubscribe = api.subscribeToProgress(sessionId, callback);
          return Comlink.proxy(unsubscribe);
        },
        subscribeHeapPressure: async (
          callback: (event: HeapPressureEvent) => void,
        ): Promise<() => void> => {
          heapListeners.add(callback);
          return Comlink.proxy(() => {
            heapListeners.delete(callback);
          });
        },
        getBatchTasks: async (nodeType: NodeType, sessionId: string): Promise<BatchTaskSummary[]> => {
          const provider = batchTaskProviders.get(nodeType);
          if (!provider) return [];
          try {
            return await provider(sessionId);
          } catch (error) {
            const msg = error instanceof Error ? error.message : String(error);
            console.warn(`[worker bootstrap] getBatchTasks failed for ${nodeType}:`, msg);
            return [];
          }
        },
        setAuthToken: async (
          token: string,
          type: 'Bearer' | 'Basic' = 'Bearer',
          expiresAt?: number,
        ): Promise<void> => {
          const auth = await AuthRecoveryService.getSingleton();
          auth.setToken(token, type, expiresAt);
        },
        setCorsProxyBaseURL: async (url: string): Promise<void> => {
          setCorsProxyBaseURL(url);
        },
      } as const;

      reporter.reportStepProgress('Create API facade', 100);
      reporter.reportStepProgress('Expose API', 10);

      Comlink.expose(api);
      reporter.reportStepProgress('Expose API', 100);
      reporter.reportComplete();
    } catch (error) {
      const msg = error instanceof Error ? error.message : String(error);
      console.warn('[worker bootstrap] runtime-worker-worker wiring failed:', msg);
      throw error;
    }
  } catch (error) {
    const err = error instanceof Error ? error : new Error(String(error));
    reporter.reportError(err);
    throw err;
  }
})();
