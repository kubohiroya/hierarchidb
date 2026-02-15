/**
 * Shared bootstrap for Dedicated/Shared worker runtimes.
 */

import { AuthService } from '@hierarchidb/auth';
import type {
  BatchProgressEvent,
  BuildSessionRuntimeFilter,
  BuildSessionRuntimeRecord,
  BuildSessionRuntimeStatus,
  BatchSessionStatus,
  BatchTaskSummary,
  BatchTaskUpdateEvent,
  BuildContinuationPolicy,
} from '@hierarchidb/batch-api';
import type { UiStorageBridge } from '@hierarchidb/worker-api';
import type { NodeId, NodeType } from '@hierarchidb/core-types';
import { setCorsProxyBaseURL } from '@hierarchidb/download';
import {
  createHeapPressureMonitor,
  type HeapPressureContext,
  type HeapPressureEvent,
} from '@hierarchidb/memory';
import type { PluginDefinition } from '@hierarchidb/plugin-registry/types';
import type { ShapeBuildSessionRecord, ShapeDataSourceName } from '@hierarchidb/shape-api';
import { createSessionCoordinator } from '@hierarchidb/session-coordinator';
import {
  configureWorkerContainer,
  getWorkerContainer,
  publishBuildSessionUpdate,
  type PluginWorkerModuleLoaderContract,
  subscribeToBuildSessionBroadcast,
  WorkerDiTokens,
  WorkerService,
} from '@hierarchidb/runtime-worker';
import { liveQuery } from 'dexie';
import {
  getAllRuntimeExports,
  type WorkerInitializationReporter,
  wirePluginsFromModules,
} from '@hierarchidb/ui-worker-client';
import type { WorkerAPI } from '~/types/worker-api.js';
import { pluginDefinitions as staticPluginDefinitions } from '~/plugin-loaders/index.ts';
import { pluginWorkerLoaders } from '~/plugin-loaders/worker-loaders.ts';

/** Runtime export metadata (subset consumed during bootstrap). */
type RuntimeExportEntry = {
  lifecycle?: unknown;
  createEntityHandler?: () => Promise<unknown>;
};

type ManualPluginSelf = typeof self & {
  __HIERARCHIDB_MANUAL_PLUGIN_DEFS__?: PluginDefinition[];
};

type WorkerMessageTarget = {
  postMessage?: (msg: unknown) => void;
};

type BatchTaskProvider = (nodeId: NodeId) => Promise<BatchTaskSummary[]>;
type BatchProgressSubscriber = (
  nodeId: NodeId,
  callback: (event: BatchProgressEvent) => void
) => () => void;

type BatchTaskSubscriber = (
  nodeId: NodeId,
  callback: (event: BatchTaskUpdateEvent) => void
) => () => void;

type ShapeBatchAPI = {
  startBatchProcess: (
    draftId: NodeId,
    batchConfig: unknown,
    processingConfig: unknown,
    downloadTaskPayloads: unknown[],
    buildContinuationPolicy?: BuildContinuationPolicy
  ) => Promise<NodeId>;
  generateDownloadTaskPayloadsFromSelection?: (
    nodeId: NodeId,
    dataSource: ShapeDataSourceName,
    selectedArrayByCountries: Record<string, boolean[]>
  ) => Promise<unknown[]>;
  getDraft?: (draftId: NodeId) => Promise<unknown>;
  getBatchSession?: (nodeId: NodeId) => Promise<unknown>;
  pauseBatchProcessing?: (draftId: NodeId) => Promise<void>;
  resumeBatchProcessing?: (draftId: NodeId) => Promise<NodeId>;
  invokeBatchCommand?: (command: string, payload: Record<string, unknown>) => Promise<void>;
  subscribeToProgress?: BatchProgressSubscriber;
  subscribeToTasks?: BatchTaskSubscriber;
};

type RuntimeWorkerBootstrap = {
  api: WorkerAPI;
  servicesReadyAt: number;
};

type ShapeDownloadTaskPayloads = NonNullable<Parameters<WorkerAPI['startBatchSession']>[2]>;

const heapMonitor = createHeapPressureMonitor({ source: 'worker' });
const heapListeners = new Set<(event: HeapPressureEvent) => void>();
heapMonitor.subscribe((event) => {
  heapListeners.forEach((listener) => {
    listener(event);
  });
});
heapMonitor.start();

const setHeapContext = (context: HeapPressureContext | null) => {
  heapMonitor.setContext(context);
};

const toComlinkProxy = <T extends object>(Comlink: typeof import('comlink'), value: T): T =>
  Comlink.proxy(value) as unknown as T;

const resolveBatchTaskProvider = (mod: unknown): BatchTaskProvider | null => {
  if (!mod || (typeof mod !== 'object' && typeof mod !== 'function')) return null;
  const record = mod as Record<string, unknown>;
  const direct = record.getBatchTasks;
  if (typeof direct === 'function') {
    return direct as BatchTaskProvider;
  }
  const shapePlugin = record.ShapeWorkerPlugin as
    | { api?: Record<string, unknown>; batch?: Record<string, unknown> }
    | undefined;
  const api = shapePlugin?.batch ?? shapePlugin?.api;
  const apiFn = api?.getBatchTasks;
  if (typeof apiFn === 'function') {
    return (nodeId: NodeId) => (apiFn as (id: NodeId) => Promise<BatchTaskSummary[]>)(nodeId);
  }
  return null;
};

const resolveShapeBatchAPI = (mod: unknown): ShapeBatchAPI | null => {
  if (!mod || (typeof mod !== 'object' && typeof mod !== 'function')) return null;
  const record = mod as Record<string, unknown>;
  const direct = (record.shapeBatchAPI ?? record.shapePluginAPI) as ShapeBatchAPI | undefined;
  if (direct?.startBatchProcess) {
    return direct;
  }
  const shapePlugin = record.ShapeWorkerPlugin as
    | { api?: ShapeBatchAPI; batch?: ShapeBatchAPI }
    | undefined;
  const api = shapePlugin?.batch ?? shapePlugin?.api;
  if (api?.startBatchProcess) {
    return api;
  }
  return null;
};

const toBatchSessionStatus = (
  session: Record<string, unknown> | undefined,
  fallbackNodeId: NodeId
): BatchSessionStatus => {
  const progress = (session?.progress as Record<string, unknown> | undefined) ?? {};
  return {
    nodeId:
      (session?.nodeId as NodeId | undefined) ??
      (session?.draftId as NodeId | undefined) ??
      fallbackNodeId,
    status: (session?.status as BatchSessionStatus['status'] | undefined) ?? 'idle',
    progress: {
      total: (progress.total as number | undefined) ?? 0,
      completed: (progress.completed as number | undefined) ?? 0,
      failed: (progress.failed as number | undefined) ?? 0,
      skipped: (progress.skipped as number | undefined) ?? 0,
      percentage: (progress.percentage as number | undefined) ?? 0,
      taskType: progress.taskType as string | undefined,
    },
    startedAt: session?.startedAt as number | undefined,
    completedAt: session?.completedAt as number | undefined,
    lastActivity: session?.updatedAt as number | undefined,
    error: session?.error as string | undefined,
  };
};

const RUNTIME_KEY_SEPARATOR = '\u0000';

const toRuntimeKey = (nodeType: NodeType, nodeId: NodeId): string =>
  `${String(nodeType)}${RUNTIME_KEY_SEPARATOR}${String(nodeId)}`;

const resolveRuntimeStatusFromBatch = (
  status: BatchSessionStatus['status']
): BuildSessionRuntimeStatus => {
  switch (status) {
    case 'queued':
      return 'starting';
    case 'running':
      return 'running';
    case 'paused':
      return 'paused';
    case 'completed':
      return 'completed';
    case 'failed':
      return 'failed';
    case 'idle':
    default:
      return 'idle';
  }
};

const resolveRuntimeStatusFromShapeRecord = (
  status: ShapeBuildSessionRecord['status']
): BuildSessionRuntimeStatus => {
  switch (status) {
    case 'running':
      return 'running';
    case 'paused':
      return 'paused';
    case 'completed':
      return 'completed';
    case 'failed':
      return 'failed';
    case 'idle':
    default:
      return 'idle';
  }
};

const runtimeStatusesWithActiveLock = new Set<BuildSessionRuntimeStatus>([
  'starting',
  'running',
  'pausing',
  'resuming',
  'finalizing',
]);

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
{
  const value = typeof import.meta.env?.VITE_CORS_PROXY_BASE_URL === 'string'
    ? import.meta.env.VITE_CORS_PROXY_BASE_URL.trim()
    : '';
  if (!value) {
    throw new Error('VITE_CORS_PROXY_BASE_URL is required for worker startup.');
  }
  setCorsProxyBaseURL(value);
}

let bootstrapPromise: Promise<RuntimeWorkerBootstrap> | null = null;

const resolveManualPluginDefinitions = (): PluginDefinition[] => {
  const pluginDefinitions: PluginDefinition[] = Array.isArray(staticPluginDefinitions)
    ? [...(staticPluginDefinitions as PluginDefinition[])]
    : [];

  const legacyDefs = (self as ManualPluginSelf).__HIERARCHIDB_MANUAL_PLUGIN_DEFS__;
  if (Array.isArray(legacyDefs)) {
    pluginDefinitions.push(...legacyDefs);
  }
  return pluginDefinitions;
};

export const ensureRuntimeWorkerBootstrap = async (options: {
  reporter: WorkerInitializationReporter;
  messageTarget?: WorkerMessageTarget | null;
}): Promise<RuntimeWorkerBootstrap> => {
  if (bootstrapPromise) return bootstrapPromise;

  bootstrapPromise = (async () => {
    const reporter = options.reporter;

    try {
      reporter.reportStepProgress('Load Comlink', 10);
      const Comlink = await import('comlink');
      reporter.reportStepProgress('Load Comlink', 100);

      reporter.reportStepProgress('Load plugin loaders', 100);

      const pluginDefinitions = resolveManualPluginDefinitions();

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
      const moduleLoader = workerContainer.get<PluginWorkerModuleLoaderContract>(
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

        const servicesReadyAt = Date.now();
        options.messageTarget?.postMessage?.({
          type: 'SERVICES_READY',
          source: 'worker',
          at: servicesReadyAt,
        });

        reporter.reportStepProgress('Create API facade', 10);

        const resolveShapeBatchApiOrThrow = (nodeType: NodeType): ShapeBatchAPI => {
          const api = shapeBatchAPIs.get(nodeType);
          if (!api) {
            throw new Error(`[worker bootstrap] Batch API not available for nodeType: ${nodeType}`);
          }
          return api;
        };
        const SHAPE_NODE_TYPE = 'shape' as NodeType;
        const normalizeSessionStatuses = (
          statuses: Array<'idle' | 'running' | 'paused' | 'completed' | 'failed'>
        ): Array<'idle' | 'running' | 'paused' | 'completed' | 'failed'> => (
          statuses.length > 0
            ? statuses
            : (['running'] as Array<'idle' | 'running' | 'paused' | 'completed' | 'failed'>)
        );
        const runtimeCoordinator = createSessionCoordinator({
          channelName: 'sessions',
          pollIntervalTimeout: 3000,
          quietThresholdTimeout: 5000,
        });
        const runtimeStatusOverrides = new Map<string, BuildSessionRuntimeStatus>();
        const runtimeActiveHints = new Map<string, boolean>();
        const runtimeRevisions = new Map<string, number>();
        const runtimeNodeIndex = new Map<string, { nodeType: NodeType; nodeId: NodeId }>();

        const bumpRuntimeRevision = (nodeType: NodeType, nodeId: NodeId): number => {
          const key = toRuntimeKey(nodeType, nodeId);
          const next = (runtimeRevisions.get(key) ?? 0) + 1;
          runtimeRevisions.set(key, next);
          runtimeNodeIndex.set(key, { nodeType, nodeId });
          return next;
        };

        const setRuntimeTransientStatus = (
          nodeType: NodeType,
          nodeId: NodeId,
          status: BuildSessionRuntimeStatus,
          activeHint?: boolean
        ): void => {
          const key = toRuntimeKey(nodeType, nodeId);
          runtimeStatusOverrides.set(key, status);
          runtimeNodeIndex.set(key, { nodeType, nodeId });
          if (activeHint !== undefined) {
            runtimeActiveHints.set(key, activeHint);
          }
          bumpRuntimeRevision(nodeType, nodeId);
          publishBuildSessionUpdate({ nodeId, status });
        };

        const clearRuntimeTransientStatus = (
          nodeType: NodeType,
          nodeId: NodeId,
          activeHint?: boolean
        ): void => {
          const key = toRuntimeKey(nodeType, nodeId);
          runtimeStatusOverrides.delete(key);
          runtimeNodeIndex.set(key, { nodeType, nodeId });
          if (activeHint !== undefined) {
            runtimeActiveHints.set(key, activeHint);
          }
          bumpRuntimeRevision(nodeType, nodeId);
          publishBuildSessionUpdate({ nodeId });
        };

        const probeRuntimeActive = async (
          nodeType: NodeType,
          nodeId: NodeId,
          status: BuildSessionRuntimeStatus
        ): Promise<boolean> => {
          if (!runtimeStatusesWithActiveLock.has(status)) {
            return false;
          }
          const lockState = await runtimeCoordinator.probeSessionLock(`${String(nodeType)}:${String(nodeId)}`);
          if (lockState === 'held') return true;
          if (lockState === 'unsupported') {
            return runtimeActiveHints.get(toRuntimeKey(nodeType, nodeId)) === true;
          }
          return false;
        };

        const toRuntimeRecord = async (
          nodeType: NodeType,
          session: ShapeBuildSessionRecord
        ): Promise<BuildSessionRuntimeRecord> => {
          const key = toRuntimeKey(nodeType, session.nodeId);
          runtimeNodeIndex.set(key, { nodeType, nodeId: session.nodeId });
          const persistedStatus = resolveRuntimeStatusFromShapeRecord(session.status);
          const runtimeStatus = runtimeStatusOverrides.get(key) ?? persistedStatus;
          const isActive = await probeRuntimeActive(nodeType, session.nodeId, runtimeStatus);
          const revision = runtimeRevisions.get(key) ?? Number(session.updatedAt ?? 0);
          return {
            nodeId: session.nodeId,
            status: runtimeStatus,
            isActive,
            progress: session.progress,
            startedAt: session.startedAt,
            completedAt: session.completedAt,
            updatedAt: session.updatedAt,
            error: session.status === 'failed' ? 'failed' : undefined,
            revision,
          };
        };

        const toSyntheticRuntimeRecord = async (
          nodeType: NodeType,
          nodeId: NodeId
        ): Promise<BuildSessionRuntimeRecord | null> => {
          const key = toRuntimeKey(nodeType, nodeId);
          const transient = runtimeStatusOverrides.get(key);
          if (!transient) return null;
          const isActive = await probeRuntimeActive(nodeType, nodeId, transient);
          return {
            nodeId,
            status: transient,
            isActive,
            revision: runtimeRevisions.get(key) ?? bumpRuntimeRevision(nodeType, nodeId),
            updatedAt: Date.now(),
          };
        };

        const getRuntimeRecordsForShape = async (
          filter?: BuildSessionRuntimeFilter
        ): Promise<BuildSessionRuntimeRecord[]> => {
          const queryAPI = services.getShapeQueryAPI();
          const nodeFilter = filter?.nodeId;
          const statuses = ['idle', 'running', 'paused', 'completed', 'failed'] as Array<
            'idle' | 'running' | 'paused' | 'completed' | 'failed'
          >;
          const sessionRecords = nodeFilter
            ? queryAPI.getBuildSessionRecord(nodeFilter)
            : queryAPI.listBuildSessionRecordsByStatus(statuses);

          const persisted = await sessionRecords;
          const records = (Array.isArray(persisted) ? persisted : (persisted ? [persisted] : []));
          const runtimeRecords = await Promise.all(records.map((session) => toRuntimeRecord(SHAPE_NODE_TYPE, session)));
          const existing = new Set(runtimeRecords.map((record) => toRuntimeKey(SHAPE_NODE_TYPE, record.nodeId)));

          const syntheticCandidates = filter?.nodeId
            ? [{ nodeType: SHAPE_NODE_TYPE, nodeId: filter.nodeId }]
            : Array.from(runtimeNodeIndex.values()).filter((entry) => entry.nodeType === SHAPE_NODE_TYPE);

          for (const candidate of syntheticCandidates) {
            const key = toRuntimeKey(candidate.nodeType, candidate.nodeId);
            if (existing.has(key)) continue;
            const synthetic = await toSyntheticRuntimeRecord(candidate.nodeType, candidate.nodeId);
            if (!synthetic) continue;
            runtimeRecords.push(synthetic);
          }

          const statusesFilter = filter?.statuses;
          const filteredByStatus = statusesFilter && statusesFilter.length > 0
            ? runtimeRecords.filter((record) => statusesFilter.includes(record.status))
            : runtimeRecords;
          const filteredByActive = filter?.activeOnly
            ? filteredByStatus.filter((record) => record.isActive)
            : filteredByStatus;
          return filteredByActive.sort((a, b) => String(a.nodeId).localeCompare(String(b.nodeId)));
        };

        const runStartBatchSession = async (
          nodeType: NodeType,
          nodeId: NodeId,
          downloadTaskPayloads?: ShapeDownloadTaskPayloads,
          buildContinuationPolicy?: BuildContinuationPolicy
        ): Promise<BatchSessionStatus> => {
          const batchApi = resolveShapeBatchApiOrThrow(nodeType);
          setRuntimeTransientStatus(nodeType, nodeId, 'starting', true);
          try {
            const draft = batchApi.getDraft ? await batchApi.getDraft(nodeId) : undefined;
            const fallbackNode = await services.getTreeNodeUpdaterAPI().getTreeNode(nodeId);
            const draftData = coerceRecord(
              (draft as { draftData?: unknown } | undefined)?.draftData ??
                (fallbackNode as { draftData?: unknown } | undefined)?.draftData
            );
            const batchConfig = (draftData as { buildConfig?: unknown }).buildConfig ?? {};
            const processingConfig = (draftData as { processingConfig?: unknown }).processingConfig ?? {};
            const payloads = downloadTaskPayloads ?? [];
            await batchApi.startBatchProcess(
              nodeId,
              batchConfig,
              processingConfig,
              payloads,
              buildContinuationPolicy,
            );
            const session = batchApi.getBatchSession ? await batchApi.getBatchSession(nodeId) : undefined;
            const status = toBatchSessionStatus(
              session as Record<string, unknown> | undefined,
              nodeId
            );
            setHeapContext({ nodeType, nodeId: status.nodeId });
            const runtimeStatus = resolveRuntimeStatusFromBatch(status.status);
            clearRuntimeTransientStatus(nodeType, nodeId, runtimeStatus === 'running');
            return status;
          } catch (error) {
            clearRuntimeTransientStatus(nodeType, nodeId, false);
            throw error;
          }
        };

        const runPauseBatchSession = async (
          nodeType: NodeType,
          nodeId: NodeId,
          reason?: string
        ): Promise<void> => {
          const batchApi = resolveShapeBatchApiOrThrow(nodeType);
          console.warn('[worker bootstrap][PauseTrace] pause-requested', {
            nodeType,
            nodeId,
            reason: reason ?? null,
          });
          setRuntimeTransientStatus(nodeType, nodeId, 'pausing', true);
          try {
            if (batchApi.invokeBatchCommand) {
              await batchApi.invokeBatchCommand('session/pause', { nodeId, stopReason: reason });
              console.warn('[worker bootstrap][PauseTrace] pause-finished', {
                nodeType,
                nodeId,
                reason: reason ?? null,
                observedStatus: 'paused',
              });
              clearRuntimeTransientStatus(nodeType, nodeId, false);
              return;
            }
            const session = batchApi.getBatchSession ? await batchApi.getBatchSession(nodeId) : undefined;
            const draftId =
              (session as { nodeId?: NodeId; draftId?: NodeId } | undefined)?.nodeId ??
              (session as { draftId?: NodeId } | undefined)?.draftId ??
              nodeId;
            if (batchApi.pauseBatchProcessing) {
              await batchApi.pauseBatchProcessing(draftId);
            }
            console.warn('[worker bootstrap][PauseTrace] pause-finished', {
              nodeType,
              nodeId,
              reason: reason ?? null,
              observedStatus: 'paused',
            });
            clearRuntimeTransientStatus(nodeType, nodeId, false);
          } catch (error) {
            const msg = error instanceof Error ? error.message : String(error);
            console.warn('[worker bootstrap][PauseTrace] pause-failed', {
              nodeType,
              nodeId,
              reason: reason ?? null,
              errorMessage: msg,
            });
            clearRuntimeTransientStatus(nodeType, nodeId, true);
            throw error;
          }
        };

        const runResumeBatchSession = async (
          nodeType: NodeType,
          nodeId: NodeId,
          buildContinuationPolicy?: BuildContinuationPolicy
        ): Promise<void> => {
          const batchApi = resolveShapeBatchApiOrThrow(nodeType);
          setRuntimeTransientStatus(nodeType, nodeId, 'resuming', true);
          try {
            if (batchApi.invokeBatchCommand) {
              const draft = batchApi.getDraft ? await batchApi.getDraft(nodeId) : undefined;
              const fallbackNode = await services.getTreeNodeUpdaterAPI().getTreeNode(nodeId);
              const draftData = coerceRecord(
                (draft as { draftData?: unknown } | undefined)?.draftData ??
                  (fallbackNode as { draftData?: unknown } | undefined)?.draftData
              );
              const batchConfig = (draftData as { buildConfig?: unknown }).buildConfig ?? {};
              const processingConfig = (draftData as { processingConfig?: unknown }).processingConfig ?? {};
              const processingConfigRecord = coerceRecord(processingConfig);
              const transformConfigRecord = coerceRecord(
                (processingConfigRecord as { transform?: unknown }).transform
              );
              const transformMaxConcurrent = transformConfigRecord.maxConcurrent;
              console.warn('[worker bootstrap][ResumeTrace] resume-request-config', {
                nodeType,
                nodeId,
                transformMaxConcurrent: typeof transformMaxConcurrent === 'number'
                  ? transformMaxConcurrent
                  : transformMaxConcurrent ?? null,
              });
              await batchApi.invokeBatchCommand('session/resume', {
                nodeId,
                buildContinuationPolicy,
                buildConfig: batchConfig,
                processingConfig,
              });
              setHeapContext({ nodeType, nodeId });
              clearRuntimeTransientStatus(nodeType, nodeId, true);
              return;
            }
            const session = batchApi.getBatchSession ? await batchApi.getBatchSession(nodeId) : undefined;
            const draftId =
              (session as { nodeId?: NodeId; draftId?: NodeId } | undefined)?.nodeId ??
              (session as { draftId?: NodeId } | undefined)?.draftId ??
              nodeId;
            if (batchApi.resumeBatchProcessing) {
              await batchApi.resumeBatchProcessing(draftId);
            }
            setHeapContext({ nodeType, nodeId });
            clearRuntimeTransientStatus(nodeType, nodeId, true);
          } catch (error) {
            clearRuntimeTransientStatus(nodeType, nodeId, false);
            throw error;
          }
        };

        const runStartOrResumeBuildSession = async (
          nodeType: NodeType,
          nodeId: NodeId,
          downloadTaskPayloads?: ShapeDownloadTaskPayloads,
          buildContinuationPolicy?: BuildContinuationPolicy
        ): Promise<BatchSessionStatus> => {
          const RUNNING_SESSION_STALE_GRACE_MS = 20_000;
          const inspectTasks = async (): Promise<{
            total: number;
            hasInFlight: boolean;
            hasVtStageTasks: boolean;
          }> => {
            const provider = batchTaskProviders.get(nodeType);
            if (!provider) {
              return {
                total: 0,
                hasInFlight: false,
                hasVtStageTasks: false,
              };
            }
            try {
              const tasks = await provider(nodeId);
              return {
                total: tasks.length,
                hasInFlight: tasks.some((task) => task.status === 'running' || task.status === 'queued'),
                hasVtStageTasks: tasks.some((task) => task.stage === 'vt'),
              };
            } catch (error) {
              const msg = error instanceof Error ? error.message : String(error);
              console.warn('[worker bootstrap] failed to inspect build tasks:', msg);
              return {
                total: 0,
                hasInFlight: false,
                hasVtStageTasks: false,
              };
            }
          };
          const batchApi = resolveShapeBatchApiOrThrow(nodeType);
          const session = batchApi.getBatchSession ? await batchApi.getBatchSession(nodeId) : undefined;
          const current = toBatchSessionStatus(
            session as Record<string, unknown> | undefined,
            nodeId
          );
          const currentRuntimeStatus = resolveRuntimeStatusFromBatch(current.status);
          if (currentRuntimeStatus === 'running' || currentRuntimeStatus === 'starting') {
            const now = Date.now();
            const hasRecentActivity = typeof current.lastActivity === 'number'
              && now - current.lastActivity < RUNNING_SESSION_STALE_GRACE_MS;
            const currentTaskState = await inspectTasks();
            const currentHasInFlightTasks = currentTaskState.hasInFlight;
            if (hasRecentActivity || currentHasInFlightTasks) {
              return current;
            }
            await runResumeBatchSession(nodeType, nodeId, buildContinuationPolicy);
            const resumed = batchApi.getBatchSession ? await batchApi.getBatchSession(nodeId) : undefined;
            const resumedStatus = toBatchSessionStatus(
              resumed as Record<string, unknown> | undefined,
              nodeId
            );
            const resumedRuntimeStatus = resolveRuntimeStatusFromBatch(resumedStatus.status);
            if (resumedRuntimeStatus === 'running' || resumedRuntimeStatus === 'starting') {
              const resumedHasRecentActivity = typeof resumedStatus.lastActivity === 'number'
                && Date.now() - resumedStatus.lastActivity < RUNNING_SESSION_STALE_GRACE_MS;
              const resumedTaskState = await inspectTasks();
              const resumedHasInFlightTasks = resumedTaskState.hasInFlight;
              if (!resumedHasRecentActivity && !resumedHasInFlightTasks) {
                return runStartBatchSession(nodeType, nodeId, downloadTaskPayloads, buildContinuationPolicy);
              }
            }
            return resumedStatus;
          }
          if (currentRuntimeStatus === 'paused' || currentRuntimeStatus === 'failed') {
            await runResumeBatchSession(nodeType, nodeId, buildContinuationPolicy);
            const resumed = batchApi.getBatchSession ? await batchApi.getBatchSession(nodeId) : undefined;
            return toBatchSessionStatus(
              resumed as Record<string, unknown> | undefined,
              nodeId
            );
          }
          if (currentRuntimeStatus === 'completed') {
            const taskState = await inspectTasks();
            if (taskState.total === 0) {
              return runStartBatchSession(nodeType, nodeId, downloadTaskPayloads, buildContinuationPolicy);
            }
            if (nodeType === SHAPE_NODE_TYPE && !taskState.hasVtStageTasks) {
              // Stage-level cache reset can leave only upstream completed tasks (e.g. fetch) in queue.
              // Treat this as resumable work and start a new run.
              return runStartBatchSession(nodeType, nodeId, downloadTaskPayloads, buildContinuationPolicy);
            }
            if (nodeType === SHAPE_NODE_TYPE) {
              // When session metadata is cleared but completed fetch tasks remain in the queue,
              // getBatchSession may synthesize a completed status. In that case, start a new run.
              const queryAPI = services.getShapeQueryAPI();
              const persisted = await queryAPI.getBuildSessionRecord(nodeId).catch(() => null);
              if (!persisted) {
                return runStartBatchSession(nodeType, nodeId, downloadTaskPayloads, buildContinuationPolicy);
              }
            }
            return current;
          }
          return runStartBatchSession(nodeType, nodeId, downloadTaskPayloads, buildContinuationPolicy);
        };

        const api: WorkerAPI = {
          ping: async () => services.ping(),
          initialize: () => services.initialize(),
          shutdown: () => services.shutdown(),
          getSystemHealth: async () => {
            const health = await services.getSystemHealth();
            return {
              ...health,
              databases: {
                coreDB: health.databases.coreDB,
                ephemeralDB: false,
              },
            };
          },
          getQueryAPI: async () => toComlinkProxy(Comlink, services.getQueryAPI()),
          getMutationAPI: async () => toComlinkProxy(Comlink, services.getMutationAPI()),
          getSubscriptionAPI: async () => toComlinkProxy(Comlink, services.getSubscriptionAPI()),
          getTreeNodeUpdaterAPI: async () => toComlinkProxy(Comlink, services.getTreeNodeUpdaterAPI()),
          getTreeTableExpandedAPI: async () => toComlinkProxy(Comlink, services.getTreeTableExpandedAPI()),
          getPluginLifecycleAPI: async () => toComlinkProxy(Comlink, services.getPluginLifecycleAPI()),
          getStyleQueryAPI: async () => toComlinkProxy(Comlink, services.getStyleQueryAPI()),
          getStyleMutationAPI: async () => toComlinkProxy(Comlink, services.getStyleMutationAPI()),
          getShapeQueryAPI: async () => toComlinkProxy(Comlink, services.getShapeQueryAPI()),
          getShapeMutationAPI: async () => toComlinkProxy(Comlink, services.getShapeMutationAPI()),
          getLocationQueryAPI: async () => toComlinkProxy(Comlink, services.getLocationQueryAPI()),
          getLocationMutationAPI: async () => toComlinkProxy(Comlink, services.getLocationMutationAPI()),
          getRouteQueryAPI: async () => toComlinkProxy(Comlink, services.getRouteQueryAPI()),
          getRouteMutationAPI: async () => toComlinkProxy(Comlink, services.getRouteMutationAPI()),
          getImportExportAPI: async () => toComlinkProxy(Comlink, services.getImportExportAPI()),
          getTagAPI: async () => toComlinkProxy(Comlink, services.getTagAPI()),
          getCommandProcessor: async () =>
            (toComlinkProxy(Comlink, services.getCommandProcessor()) as unknown as Awaited<
              ReturnType<WorkerAPI['getCommandProcessor']>
            >),
          startBatchSession: async (
            nodeType: NodeType,
            nodeId: NodeId,
            downloadTaskPayloads?: ShapeDownloadTaskPayloads,
            buildContinuationPolicy?: BuildContinuationPolicy
          ): Promise<BatchSessionStatus> => (
            runStartBatchSession(nodeType, nodeId, downloadTaskPayloads, buildContinuationPolicy)
          ),
          startBuildSession: async (
            nodeType: NodeType,
            nodeId: NodeId,
            downloadTaskPayloads?: ShapeDownloadTaskPayloads,
            buildContinuationPolicy?: BuildContinuationPolicy
          ): Promise<BatchSessionStatus> => (
            api.startBatchSession(nodeType, nodeId, downloadTaskPayloads, buildContinuationPolicy)
          ),
          startOrResumeBuildSession: async (
            nodeType: NodeType,
            nodeId: NodeId,
            downloadTaskPayloads?: ShapeDownloadTaskPayloads,
            buildContinuationPolicy?: BuildContinuationPolicy
          ): Promise<BatchSessionStatus> => (
            runStartOrResumeBuildSession(
              nodeType,
              nodeId,
              downloadTaskPayloads,
              buildContinuationPolicy
            )
          ),
          generateShapeDownloadTaskPayloadsFromSelection: async (
            nodeId: NodeId,
            dataSource: ShapeDataSourceName,
            selectedArrayByCountries: Record<string, boolean[]>
          ): Promise<ShapeDownloadTaskPayloads> => {
            const api = resolveShapeBatchApiOrThrow(SHAPE_NODE_TYPE);
            if (!api.generateDownloadTaskPayloadsFromSelection) {
              throw new Error(
                '[worker bootstrap] generateDownloadTaskPayloadsFromSelection is not available'
              );
            }
            const payloads = await api.generateDownloadTaskPayloadsFromSelection(
              nodeId,
              dataSource,
              selectedArrayByCountries
            );
            return payloads as ShapeDownloadTaskPayloads;
          },
          getBatchSessionStatus: async (
            nodeType: NodeType,
            nodeId: NodeId
          ): Promise<BatchSessionStatus> => {
            const api = resolveShapeBatchApiOrThrow(nodeType);
            const session = api.getBatchSession ? await api.getBatchSession(nodeId) : undefined;
            return toBatchSessionStatus(session as Record<string, unknown> | undefined, nodeId);
          },
          getBuildSessionStatus: async (
            nodeType: NodeType,
            nodeId: NodeId
          ): Promise<BatchSessionStatus> => api.getBatchSessionStatus(nodeType, nodeId),
          pauseBatchSession: async (nodeType: NodeType, nodeId: NodeId, reason?: string): Promise<void> => (
            runPauseBatchSession(nodeType, nodeId, reason)
          ),
          pauseBuildSession: async (nodeType: NodeType, nodeId: NodeId, reason?: string): Promise<void> => (
            api.pauseBatchSession(nodeType, nodeId, reason)
          ),
          resumeBatchSession: async (
            nodeType: NodeType,
            nodeId: NodeId,
            buildContinuationPolicy?: BuildContinuationPolicy
          ): Promise<void> => runResumeBatchSession(nodeType, nodeId, buildContinuationPolicy),
          resumeBuildSession: async (
            nodeType: NodeType,
            nodeId: NodeId,
            buildContinuationPolicy?: BuildContinuationPolicy
          ): Promise<void> => api.resumeBatchSession(nodeType, nodeId, buildContinuationPolicy),
          subscribeBatchProgress: async (
            nodeType: NodeType,
            nodeId: NodeId,
            callback: (event: BatchProgressEvent) => void
          ): Promise<() => void> => {
            const api = resolveShapeBatchApiOrThrow(nodeType);
            if (!api.subscribeToProgress) {
              return () => {};
            }
            const unsubscribe = api.subscribeToProgress(nodeId, callback);
            return toComlinkProxy(Comlink, unsubscribe);
          },
          subscribeBuildProgress: async (
            nodeType: NodeType,
            nodeId: NodeId,
            callback: (event: BatchProgressEvent) => void
          ): Promise<() => void> => api.subscribeBatchProgress(nodeType, nodeId, callback),
          subscribeBatchTasks: async (
            nodeType: NodeType,
            nodeId: NodeId,
            callback: (event: BatchTaskUpdateEvent) => void
          ): Promise<() => void> => {
            const api = resolveShapeBatchApiOrThrow(nodeType);
            if (!api.subscribeToTasks) {
              return () => {};
            }
            const unsubscribe = api.subscribeToTasks(nodeId, callback);
            return toComlinkProxy(Comlink, unsubscribe);
          },
          subscribeBuildTasks: async (
            nodeType: NodeType,
            nodeId: NodeId,
            callback: (event: BatchTaskUpdateEvent) => void
          ): Promise<() => void> => api.subscribeBatchTasks(nodeType, nodeId, callback),
          subscribeHeapPressure: async (
            callback: (event: HeapPressureEvent) => void
          ): Promise<() => void> => {
            heapListeners.add(callback);
            return toComlinkProxy(Comlink, () => {
              heapListeners.delete(callback);
            });
          },
          getBatchTasks: async (nodeType: NodeType, nodeId: NodeId): Promise<BatchTaskSummary[]> => {
            const provider = batchTaskProviders.get(nodeType);
            if (!provider) return [];
            try {
              return await provider(nodeId);
            } catch (error) {
              const msg = error instanceof Error ? error.message : String(error);
              console.warn(`[worker bootstrap] getBatchTasks failed for ${nodeType}:`, msg);
              return [];
            }
          },
          getBuildTasks: async (nodeType: NodeType, nodeId: NodeId): Promise<BatchTaskSummary[]> => (
            api.getBatchTasks(nodeType, nodeId)
          ),
          listBuildSessionRecordsByStatus: async (
            nodeType: NodeType,
            statuses: Array<'idle' | 'running' | 'paused' | 'completed' | 'failed'>
          ): Promise<ShapeBuildSessionRecord[]> => {
            if (nodeType !== SHAPE_NODE_TYPE) return [];
            const queryAPI = services.getShapeQueryAPI();
            return queryAPI.listBuildSessionRecordsByStatus(normalizeSessionStatuses(statuses));
          },
          getBuildSessionRuntime: async (
            nodeType: NodeType,
            nodeId: NodeId
          ): Promise<BuildSessionRuntimeRecord | null> => {
            if (nodeType !== SHAPE_NODE_TYPE) return null;
            const sessions = await getRuntimeRecordsForShape({ nodeId });
            return sessions[0] ?? null;
          },
          listBuildSessionRuntimes: async (
            nodeType: NodeType,
            filter?: BuildSessionRuntimeFilter
          ): Promise<BuildSessionRuntimeRecord[]> => {
            if (nodeType !== SHAPE_NODE_TYPE) return [];
            return getRuntimeRecordsForShape(filter);
          },
          subscribeBuildSessionRuntimes: async (
            nodeType: NodeType,
            filter: BuildSessionRuntimeFilter | undefined,
            callback: (sessions: BuildSessionRuntimeRecord[]) => void
          ): Promise<() => void> => {
            if (nodeType !== SHAPE_NODE_TYPE) {
              return () => {};
            }
            const queryAPI = services.getShapeQueryAPI();
            const statuses = ['idle', 'running', 'paused', 'completed', 'failed'] as Array<
              'idle' | 'running' | 'paused' | 'completed' | 'failed'
            >;
            const observable = liveQuery(() => queryAPI.listBuildSessionRecordsByStatus(statuses));
            const dispatch = async () => {
              try {
                const sessions = await getRuntimeRecordsForShape(filter);
                callback(sessions);
              } catch (error) {
                const msg = error instanceof Error ? error.message : String(error);
                console.warn('[worker bootstrap] build runtime refresh failed:', msg);
              }
            };
            const subscription = observable.subscribe({
              next: () => {
                void dispatch();
              },
              error: (error) => {
                const msg = error instanceof Error ? error.message : String(error);
                console.warn('[worker bootstrap] build runtime subscription failed:', msg);
                callback([]);
              },
            });
            const broadcastUnsubscribe = subscribeToBuildSessionBroadcast(() => {
              void dispatch();
            });
            void dispatch();
            return toComlinkProxy(Comlink, () => {
              subscription.unsubscribe();
              broadcastUnsubscribe();
            });
          },
          deleteBuildSession: async (nodeType: NodeType, nodeId: NodeId): Promise<void> => {
            if (nodeType !== SHAPE_NODE_TYPE) return;
            const queryAPI = services.getShapeQueryAPI();
            const current = await queryAPI.getBuildSessionRecord(nodeId);
            if (current?.status === 'running') {
              throw new Error('Cannot delete a running build session.');
            }
            setRuntimeTransientStatus(nodeType, nodeId, 'deleting', false);
            try {
              const mutationAPI = services.getShapeMutationAPI();
              await mutationAPI.deleteBuildSession(nodeId);
              clearRuntimeTransientStatus(nodeType, nodeId, false);
            } catch (error) {
              clearRuntimeTransientStatus(nodeType, nodeId, false);
              throw error;
            }
          },
          subscribeBuildSessionRecordsByStatus: async (
            nodeType: NodeType,
            statuses: Array<'idle' | 'running' | 'paused' | 'completed' | 'failed'>,
            callback: (sessions: ShapeBuildSessionRecord[]) => void
          ): Promise<() => void> => {
            if (nodeType !== SHAPE_NODE_TYPE) {
              return () => {};
            }
            const queryAPI = services.getShapeQueryAPI();
            const normalized = normalizeSessionStatuses(statuses);
            const observable = liveQuery(() => queryAPI.listBuildSessionRecordsByStatus(normalized));
            const subscription = observable.subscribe({
              next: (sessions) => {
                callback(sessions);
              },
              error: (error) => {
                const msg = error instanceof Error ? error.message : String(error);
                console.warn('[worker bootstrap] build session subscription failed:', msg);
                callback([]);
              },
            });
            const dispatchSessions = async () => {
              try {
                const sessions = await queryAPI.listBuildSessionRecordsByStatus(normalized);
                callback(sessions);
              } catch (error) {
                const msg = error instanceof Error ? error.message : String(error);
                console.warn('[worker bootstrap] build session refresh failed:', msg);
              }
            };
            const broadcastUnsubscribe = subscribeToBuildSessionBroadcast(() => {
              void dispatchSessions();
            });
            return toComlinkProxy(Comlink, () => {
              subscription.unsubscribe();
              broadcastUnsubscribe();
            });
          },
          setUiStorageBridge: async (bridge: UiStorageBridge): Promise<void> => {
            const auth = await AuthService.getSingleton();
            await auth.setUiStorageBridge(bridge);
          },
          setAuthToken: async (
            token: string,
            type: 'Bearer' | 'Basic' = 'Bearer',
            expiresAt?: number
          ): Promise<void> => {
            const auth = await AuthService.getSingleton();
            auth.setToken(token, type, expiresAt);
          },
          setCorsProxyBaseURL: async (url: string): Promise<void> => {
            setCorsProxyBaseURL(url);
          },
        };

        reporter.reportStepProgress('Create API facade', 100);

        return { api, servicesReadyAt };
      } catch (error) {
        const msg = error instanceof Error ? error.message : String(error);
        console.warn('[worker bootstrap] runtime-worker-worker wiring failed:', msg);
        throw error;
      }
    } catch (error) {
      const err = error instanceof Error ? error : new Error(String(error));
      throw err;
    }
  })();

  return bootstrapPromise;
};
