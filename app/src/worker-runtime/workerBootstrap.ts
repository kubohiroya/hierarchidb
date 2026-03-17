/**
 * Shared bootstrap for Dedicated/Shared worker runtimes.
 */

import { AuthService } from '@hierarchidb/auth';
import type {
  BuildProgress,
  StageKey,
  BuildSessionRuntimeFilter,
  BuildSessionRuntimeRecord,
  BuildSessionRuntimeStatus,
  BuildSessionStatus,
  BuildTaskSummary,
  BuildTaskUpdateEvent,
  TaskProgressUpdatedEvent,
} from '@hierarchidb/build-api';
import type { UiStorageBridge } from '@hierarchidb/worker-api';
import type { NodeId, NodeType } from '@hierarchidb/core-types';
import { setCorsProxyBaseURL } from '@hierarchidb/download';
import {
  createHeapPressureMonitor,
  type HeapPressureContext,
  type HeapPressureEvent,
} from '@hierarchidb/memory';
import type { PluginDefinition } from '@hierarchidb/plugin-registry/types';
import type {
  ShapeBuildProgressSummary,
  ShapeBuildSessionRecord,
  ShapeDataSourceName,
} from '@hierarchidb/shape-api';
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
import type { BuildWorkerAPI } from '~/types/worker-api';
import { pluginDefinitions as staticPluginDefinitions } from '~/plugin-loaders/index';
import { pluginWorkerLoaders } from '~/plugin-loaders/worker-loaders';

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

type BuildTaskProvider = (nodeId: NodeId) => Promise<BuildTaskSummary[]>;

type BuildEventSubscriber = (
  nodeId: NodeId,
  callback: (event: unknown) => void
) => () => void;

type ShapeBuildAPI = {
  startBuildSession?: (
    draftId: NodeId,
    buildConfig: unknown,
    processingConfig: unknown,
    downloadTaskPayloads: unknown[],
  ) => Promise<NodeId>;
  generateDownloadTaskPayloadsFromSelection?: (
    nodeId: NodeId,
    dataSource: ShapeDataSourceName,
    selectedArrayByCountries: Record<string, boolean[]>
  ) => Promise<unknown[]>;
  getDraft?: (draftId: NodeId) => Promise<unknown>;
  getBuildSession?: (nodeId: NodeId) => Promise<unknown>;
  pauseBuildSession?: (draftId: NodeId) => Promise<void>;
  invokeBuildCommand?: (command: string, payload: Record<string, unknown>) => Promise<void>;
  subscribeStageSnapshots?: BuildEventSubscriber;
  subscribeSessionState?: BuildEventSubscriber;
  subscribeHeartbeat?: BuildEventSubscriber;
  subscribeTaskProgress?: BuildEventSubscriber;
  subscribeWorkerLog?: BuildEventSubscriber;
};

type RuntimeWorkerBootstrap = {
  api: BuildWorkerAPI;
  servicesReadyAt: number;
};

type ShapeDownloadTaskPayloads = NonNullable<Parameters<BuildWorkerAPI['startBuildSession']>[2]>;

const heapMonitor = createHeapPressureMonitor({ source: 'worker' });
const heapListeners = new Set<(event: HeapPressureEvent) => void>();
heapMonitor.subscribe((event) => {
  heapListeners.forEach((listener) => {
    listener(event);
  });
});
heapMonitor.start();

// UI token request callback for worker-to-UI token queries
let uiTokenRequestCallback: (() => Promise<string | null>) | null = null;

const setHeapContext = (context: HeapPressureContext | null) => {
  heapMonitor.setContext(context);
};

const toComlinkProxy = <T extends object>(Comlink: typeof import('comlink'), value: T): T =>
  Comlink.proxy(value) as T;

const sanitizeForComlink = <T>(value: T, seen = new WeakMap<object, unknown>()): T => {
  if (typeof value === 'bigint') {
    return value.toString() as T;
  }
  if (value === null || typeof value !== 'object') {
    return value;
  }

  if (value instanceof Date) {
    return new Date(value.getTime()) as T;
  }

  if (value instanceof Error) {
    return {
      name: value.name,
      message: value.message,
      stack: value.stack ?? undefined,
    } as T;
  }

  if (value instanceof Map) {
    return Array.from(value.values()).map((entry) => sanitizeForComlink(entry, seen)) as T;
  }

  if (value instanceof Set) {
    return Array.from(value).map((entry) => sanitizeForComlink(entry, seen)) as T;
  }

  if (Array.isArray(value)) {
    return value.map((entry) => sanitizeForComlink(entry, seen)) as T;
  }

  if (seen.has(value as object)) {
    return seen.get(value as object) as T;
  }

  const safe = {} as Record<string, unknown>;
  seen.set(value as object, safe);
  for (const key of Object.keys(value as Record<string, unknown>)) {
    const rawValue = (value as Record<string, unknown>)[key];
    if (typeof rawValue === 'function' || typeof rawValue === 'symbol') {
      continue;
    }
    safe[key] = sanitizeForComlink(rawValue, seen);
  }
  return safe as T;
};

const resolveBuildTaskProvider = (mod: unknown): BuildTaskProvider | null => {
  if (!mod || (typeof mod !== 'object' && typeof mod !== 'function')) return null;
  const record = mod as Record<string, unknown>;
  const direct = record.getBuildTasks;
  if (typeof direct === 'function') {
    return direct as BuildTaskProvider;
  }
  const shapePlugin = record.ShapeWorkerPlugin as
    | { api?: Record<string, unknown>; build?: Record<string, unknown> }
    | undefined;
  const api = shapePlugin?.build ?? shapePlugin?.api;
  const apiFn = api?.getBuildTasks;
  if (typeof apiFn === 'function') {
    return (nodeId: NodeId) => (apiFn as (id: NodeId) => Promise<BuildTaskSummary[]>)(nodeId);
  }
  return null;
};

const resolveShapeBuildAPI = (mod: unknown): ShapeBuildAPI | null => {
  if (!mod || (typeof mod !== 'object' && typeof mod !== 'function')) return null;
  const record = mod as Record<string, unknown>;
  const direct = (
    record.shapeBuildAPI
    ?? record.shapePluginAPI
  ) as ShapeBuildAPI | undefined;
  if (direct?.startBuildSession) {
    return direct;
  }
  const shapePlugin = record.ShapeWorkerPlugin as
    | { api?: ShapeBuildAPI; build?: ShapeBuildAPI }
    | undefined;
  const api = shapePlugin?.build ?? shapePlugin?.api;
  if (api?.startBuildSession) {
    return api;
  }
  return null;
};

const isTaskStage = (value: unknown): value is StageKey => (
  value === 'source' || value === 'geometry' || value === 'tileEmit'
);

type BuildProgressLike = {
  total?: number;
  completed?: number;
  failed?: number;
  skipped?: number;
  percentage?: number;
  stage?: StageKey;
  estimatedTimeRemaining?: number;
};

const toBuildProgress = (progress: BuildProgressLike | undefined): BuildProgress => ({
  total: (progress?.total as number | undefined) ?? 0,
  completed: (progress?.completed as number | undefined) ?? 0,
  failed: (progress?.failed as number | undefined) ?? 0,
  skipped: (progress?.skipped as number | undefined) ?? 0,
  percentage: (progress?.percentage as number | undefined) ?? 0,
  stage: isTaskStage((progress as { stage?: unknown } | undefined)?.stage) ? (progress?.stage as StageKey) : 'source',
  estimatedTimeRemaining: (progress?.estimatedTimeRemaining as number | undefined),
});

const VALID_BUILD_SESSION_STATUSES = new Set<BuildSessionStatus['status']>([
  'idle', 'queued', 'running', 'paused', 'completed', 'failed',
]);

const toBuildSessionStatus = (
  session: Record<string, unknown> | undefined,
  fallbackNodeId: NodeId
): BuildSessionStatus => {
  const rawStatus = session?.status;
  if (!VALID_BUILD_SESSION_STATUSES.has(rawStatus as BuildSessionStatus['status'])) {
    throw new Error(
      `[toBuildSessionStatus] invalid or missing session status: ${JSON.stringify(rawStatus)}`
    );
  }
  const progress = session?.progress as (BuildProgressLike | ShapeBuildProgressSummary | undefined);
  return {
    nodeId: (session?.nodeId as NodeId | undefined) ?? fallbackNodeId,
    status: rawStatus as BuildSessionStatus['status'],
    progress: toBuildProgress(progress),
    startedAt: session?.startedAt as number | undefined,
    completedAt: session?.completedAt as number | undefined,
    lastActivity: session?.updatedAt as number | undefined,
    error: session?.error as string | undefined,
  };
};

const RUNTIME_KEY_SEPARATOR = '\u0000';

const toRuntimeKey = (nodeType: NodeType, nodeId: NodeId): string =>
  `${String(nodeType)}${RUNTIME_KEY_SEPARATOR}${String(nodeId)}`;

const resolveRuntimeStatusFromBuildSession = (
  status: BuildSessionStatus['status']
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
  const fromVite = typeof import.meta.env?.VITE_CORS_PROXY_BASE_URL === 'string'
    ? import.meta.env.VITE_CORS_PROXY_BASE_URL.trim()
    : '';
  const value = fromVite || (import.meta.env?.DEV
    ? 'https://hierarchidb-cors-proxy.kubohiroya.workers.dev'
    : '');
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

      const buildTaskProviders = new Map<NodeType, BuildTaskProvider>();
      const shapeBuildAPIs = new Map<NodeType, ShapeBuildAPI>();
      for (const entry of moduleEntries) {
        const provider = resolveBuildTaskProvider(entry.mod);
        if (provider) {
          buildTaskProviders.set(entry.nodeType as NodeType, provider);
        }
        const buildApi = resolveShapeBuildAPI(entry.mod);
        if (buildApi) {
          shapeBuildAPIs.set(entry.nodeType as NodeType, buildApi);
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

        const resolveShapeBuildApiOrThrow = (nodeType: NodeType): ShapeBuildAPI => {
          const api = shapeBuildAPIs.get(nodeType);
          if (!api) {
            throw new Error(`[worker bootstrap] Build API not available for nodeType: ${nodeType}`);
          }
          return api;
        };
        const getSessionSnapshot = async (
          buildApi: ShapeBuildAPI,
          nodeId: NodeId
        ): Promise<unknown> => {
          const getBuildSession = buildApi.getBuildSession;
          if (typeof getBuildSession === 'function') {
            return getBuildSession(nodeId);
          }
          return undefined;
        };
        const invokeStartBuildSession = async (
          buildApi: ShapeBuildAPI,
          nodeId: NodeId,
          buildConfig: unknown,
          processingConfig: unknown,
          downloadTaskPayloads: unknown[]
        ): Promise<NodeId> => {
          if (typeof buildApi.startBuildSession === 'function') {
            return buildApi.startBuildSession(
              nodeId,
              buildConfig,
              processingConfig,
              downloadTaskPayloads
            );
          }
          throw new Error('[worker bootstrap] Build API missing start method');
        };
        const SHAPE_NODE_TYPE = 'shape' as NodeType;
        const normalizeSessionStatuses = (
          statuses: Array<'idle' | 'running' | 'paused' | 'completed' | 'failed'>
        ): Array<'idle' | 'running' | 'paused' | 'completed' | 'failed'> => (
          statuses.length > 0
            ? statuses
            : (['running'] as Array<'idle' | 'running' | 'paused' | 'completed' | 'failed'>)
        );
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

        const probeRuntimeActive = (
          nodeType: NodeType,
          nodeId: NodeId,
          status: BuildSessionRuntimeStatus
        ): boolean => {
          if (!runtimeStatusesWithActiveLock.has(status)) {
            return false;
          }
          const activeHint = runtimeActiveHints.get(toRuntimeKey(nodeType, nodeId));
          return activeHint ?? true;
        };

        const toRuntimeRecord = (
          nodeType: NodeType,
          session: ShapeBuildSessionRecord
        ): BuildSessionRuntimeRecord => {
          const key = toRuntimeKey(nodeType, session.nodeId);
          runtimeNodeIndex.set(key, { nodeType, nodeId: session.nodeId });
          const persistedStatus = resolveRuntimeStatusFromShapeRecord(session.status);
          const runtimeStatus = runtimeStatusOverrides.get(key) ?? persistedStatus;
          const isActive = probeRuntimeActive(nodeType, session.nodeId, runtimeStatus);
          const revision = runtimeRevisions.get(key) ?? Number(session.updatedAt ?? 0);
          return {
            nodeId: session.nodeId,
            status: runtimeStatus,
            isActive,
            progress: toBuildProgress(session.progress),
            startedAt: session.startedAt,
            completedAt: session.completedAt,
            updatedAt: session.updatedAt,
            inactiveMs: session.inactiveMs,
            lastHeartbeatAt: session.lastHeartbeatAt,
            error: session.status === 'failed' ? 'failed' : undefined,
            revision,
          };
        };

        const toSyntheticRuntimeRecord = (
          nodeType: NodeType,
          nodeId: NodeId
        ): BuildSessionRuntimeRecord | null => {
          const key = toRuntimeKey(nodeType, nodeId);
          const transient = runtimeStatusOverrides.get(key);
          if (!transient) return null;
          const isActive = probeRuntimeActive(nodeType, nodeId, transient);
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
          const runtimeRecords = records.map((session) => toRuntimeRecord(SHAPE_NODE_TYPE, session));
          const existing = new Set(runtimeRecords.map((record) => toRuntimeKey(SHAPE_NODE_TYPE, record.nodeId)));

          const syntheticCandidates = filter?.nodeId
            ? [{ nodeType: SHAPE_NODE_TYPE, nodeId: filter.nodeId }]
            : Array.from(runtimeNodeIndex.values()).filter((entry) => entry.nodeType === SHAPE_NODE_TYPE);

          for (const candidate of syntheticCandidates) {
            const key = toRuntimeKey(candidate.nodeType, candidate.nodeId);
            if (existing.has(key)) continue;
            const synthetic = toSyntheticRuntimeRecord(candidate.nodeType, candidate.nodeId);
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

        const runStartBuildSession = async (
          nodeType: NodeType,
          nodeId: NodeId,
          downloadTaskPayloads?: ShapeDownloadTaskPayloads,
        ): Promise<BuildSessionStatus> => {
          const buildApi = resolveShapeBuildApiOrThrow(nodeType);
          setRuntimeTransientStatus(nodeType, nodeId, 'starting', true);
          try {
            const draft = buildApi.getDraft ? await buildApi.getDraft(nodeId) : undefined;
            const fallbackNode = await services.getTreeNodeUpdaterAPI().getTreeNode(nodeId);
            const draftData = coerceRecord(
              (draft as { draftData?: unknown } | undefined)?.draftData ??
              (fallbackNode as { draftData?: unknown } | undefined)?.draftData
            );
            const buildConfig = (draftData as { buildConfig?: unknown }).buildConfig ?? {};
            const processingConfig = (draftData as { processingConfig?: unknown }).processingConfig ?? {};
            const payloads = downloadTaskPayloads ?? [];
            await invokeStartBuildSession(
              buildApi,
              nodeId,
              buildConfig,
              processingConfig,
              payloads
            );
            const session = await getSessionSnapshot(buildApi, nodeId);
            const status = toBuildSessionStatus(
              session as Record<string, unknown> | undefined,
              nodeId
            );
            setHeapContext({ nodeType, nodeId: status.nodeId });
            const runtimeStatus = resolveRuntimeStatusFromBuildSession(status.status);
            clearRuntimeTransientStatus(nodeType, nodeId, runtimeStatus === 'running');
            return status;
          } catch (error) {
            clearRuntimeTransientStatus(nodeType, nodeId, false);
            throw error;
          }
        };

        const runPauseBuildSession = async (
          nodeType: NodeType,
          nodeId: NodeId,
          reason?: string
        ): Promise<void> => {
          const buildApi = resolveShapeBuildApiOrThrow(nodeType);
          console.warn('[worker bootstrap][PauseTrace] pause-requested', {
            nodeType,
            nodeId,
            reason: reason ?? null,
          });
          setRuntimeTransientStatus(nodeType, nodeId, 'pausing', true);
          try {
            if (buildApi.invokeBuildCommand) {
              await buildApi.invokeBuildCommand('session/pause', { nodeId, stopReason: reason });
            } else {
              const session = await getSessionSnapshot(buildApi, nodeId);
              const nodeIdForCommand = (session as { nodeId?: NodeId } | undefined)?.nodeId ?? nodeId;
              if (buildApi.pauseBuildSession) {
                await buildApi.pauseBuildSession(nodeIdForCommand);
              }
            }
            console.warn('[worker bootstrap][PauseTrace] pause-finished', {
              nodeType,
              nodeId,
              reason: reason ?? null,
              observedStatus: 'paused',
            });
            clearRuntimeTransientStatus(nodeType, nodeId, false);
            return;
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

        const runCancelQueuedBuildSession = async (
          nodeType: NodeType,
          nodeId: NodeId,
          reason?: string
        ): Promise<void> => {
          const buildApi = resolveShapeBuildApiOrThrow(nodeType);
          if (buildApi.invokeBuildCommand) {
            await buildApi.invokeBuildCommand('session/cancel-queued', {
              nodeId,
              stopReason: reason,
            });
            clearRuntimeTransientStatus(nodeType, nodeId, false);
            return;
          }
          await runPauseBuildSession(nodeType, nodeId, reason);
        };

        const runRestartBuildSession = async (
          nodeType: NodeType,
          nodeId: NodeId
        ): Promise<void> => {
          await runStartBuildSession(nodeType, nodeId, []);
        };

        const RESUME_SESSION_FRESHNESS_WINDOW_MS = 5 * 60 * 1000;

        const resolveSessionRecoveryBaselineAt = (session: ShapeBuildSessionRecord): number => {
          if (typeof session.lastHeartbeatAt === 'number' && Number.isFinite(session.lastHeartbeatAt)) {
            return session.lastHeartbeatAt;
          }
          if (typeof session.lastActivity === 'number' && Number.isFinite(session.lastActivity)) {
            return session.lastActivity;
          }
          if (typeof session.stageHeartbeatAt === 'number' && Number.isFinite(session.stageHeartbeatAt)) {
            return session.stageHeartbeatAt;
          }
          if (typeof session.updatedAt === 'number' && Number.isFinite(session.updatedAt)) {
            return session.updatedAt;
          }
          if (typeof session.completedAt === 'number' && Number.isFinite(session.completedAt)) {
            return session.completedAt;
          }
          return 0;
        };

        const isRecoverableRunningSession = (
          session: ShapeBuildSessionRecord,
          now: number,
        ): boolean => {
          if (typeof session.expiresAt === 'number' && Number.isFinite(session.expiresAt)) {
            if (session.expiresAt <= now) return false;
          }

          const baseline = resolveSessionRecoveryBaselineAt(session);
          if (!Number.isFinite(baseline) || baseline <= 0) return false;
          return now - baseline <= RESUME_SESSION_FRESHNESS_WINDOW_MS;
        };

        const isSessionStaleRunning = (
          session: ShapeBuildSessionRecord,
          now: number
        ): boolean => (
          !isRecoverableRunningSession(session, now)
        );

        const recoverBuildSessionFromPersistedState = async (): Promise<void> => {
          const queryAPI = services.getShapeQueryAPI();
          const mutationAPI = services.getShapeMutationAPI();
          const runningSessions = await queryAPI.listBuildSessionRecordsByStatus(['running']);
          if (runningSessions.length === 0) return;

          const now = Date.now();
          const staleSessions = runningSessions.filter((session) => isSessionStaleRunning(session, now));
          const freshSessions = runningSessions
            .filter((session) => isRecoverableRunningSession(session, now))
            .sort((a, b) => (
              resolveSessionRecoveryBaselineAt(b) - resolveSessionRecoveryBaselineAt(a)
            ));
          const latestSession = freshSessions[0];
          if (staleSessions.length > 0) {
            await Promise.all(staleSessions.map(async (session) => {
              try {
                const inactiveAt = resolveSessionRecoveryBaselineAt(session);
                const inactiveDeltaMs = Math.max(0, now - inactiveAt);
                const inactiveMs = (session.inactiveMs ?? 0) + inactiveDeltaMs;
                await mutationAPI.updateBuildSession(session.nodeId, {
                  status: 'paused',
                  stopReason: 'route-leave',
                  canResume: true,
                  inactiveMs,
                  lastHeartbeatAt: now,
                });
                console.info('[worker bootstrap][ResumeTrace] mark-stale-running-session-paused', {
                  nodeId: session.nodeId,
                  stopReason: 'route-leave',
                  inactiveMs,
                });
              } catch (error) {
                const msg = error instanceof Error ? error.message : String(error);
                console.warn('[worker bootstrap][ResumeTrace] mark-stale-running-session-paused-failed', {
                  nodeId: session.nodeId,
                  errorMessage: msg,
                });
              }
            }));
          }

          if (!latestSession) return;

          try {
            const sessionNodeId = latestSession.nodeId;
            console.info('[worker bootstrap][ResumeTrace] restart-cold-start-session', {
              nodeId: sessionNodeId,
            });
            await runRestartBuildSession(SHAPE_NODE_TYPE, sessionNodeId);
            console.info('[worker bootstrap][ResumeTrace] restart-cold-start-session-success', {
              nodeId: sessionNodeId,
            });
          } catch (error) {
            const msg = error instanceof Error ? error.message : String(error);
            console.warn('[worker bootstrap][ResumeTrace] restart-cold-start-session-failed', {
              nodeId: latestSession.nodeId,
              errorMessage: msg,
            });
          }
        };

        const startBuildSession = async (
          nodeType: NodeType,
          nodeId: NodeId,
          downloadTaskPayloads?: ShapeDownloadTaskPayloads
        ): Promise<BuildSessionStatus> => (
          runStartBuildSession(nodeType, nodeId, downloadTaskPayloads)
        );

        const getBuildSessionStatus = async (
          nodeType: NodeType,
          nodeId: NodeId
        ): Promise<BuildSessionStatus> => {
          const buildApi = resolveShapeBuildApiOrThrow(nodeType);
          const session = await getSessionSnapshot(buildApi, nodeId);
          return toBuildSessionStatus(session as Record<string, unknown> | undefined, nodeId);
        };

        const pauseBuildSession = async (
          nodeType: NodeType,
          nodeId: NodeId,
          reason?: string
        ): Promise<void> => (
          runPauseBuildSession(nodeType, nodeId, reason)
        );

        const cancelQueuedBuildSession = async (
          nodeType: NodeType,
          nodeId: NodeId,
          reason?: string
        ): Promise<void> => runCancelQueuedBuildSession(nodeType, nodeId, reason);

<<<<<<< fix/shape-plugin/wire-emit-task-progress-subscribe-task-progress-1141
        const subscribeTaskProgress = async (
=======

        const safeStringify = (value: unknown): string => {
          const seen = new WeakSet<object>();
          return JSON.stringify(value, (_key, val) => {
            if (typeof val === 'object' && val !== null) {
              if (seen.has(val)) return '[Circular]';
              seen.add(val);
            }
            return val as unknown;
          });
        };

        const subscribeBuildProgress = async (
>>>>>>> main
          nodeType: NodeType,
          nodeId: NodeId,
          callback: (event: TaskProgressUpdatedEvent) => void
        ): Promise<() => void> => {
          const buildApi = resolveShapeBuildApiOrThrow(nodeType);
          if (!buildApi.subscribeTaskProgress) {
            return () => { };
          }
          const wrappedCallback = (event: unknown): void => {
            const sanitized = sanitizeForComlink(event);
            if (
              !sanitized ||
              typeof sanitized !== 'object' ||
              (sanitized as { type?: unknown }).type !== 'taskProgressUpdated'
            ) {
              throw new Error(
<<<<<<< fix/shape-plugin/wire-emit-task-progress-subscribe-task-progress-1141
                `[subscribeTaskProgress] unexpected event type: ${JSON.stringify((sanitized as { type?: unknown } | null)?.type ?? sanitized)}`
=======
                `[subscribeBuildProgress] unexpected event type: ${safeStringify((sanitized as { type?: unknown } | null)?.type ?? sanitized)}`
>>>>>>> main
              );
            }
            callback(sanitized as TaskProgressUpdatedEvent);
          };
          const unsubscribe = buildApi.subscribeTaskProgress(nodeId, wrappedCallback);
          return toComlinkProxy(Comlink, unsubscribe);
        };

        const subscribeBuildTasks = async (
          nodeType: NodeType,
          nodeId: NodeId,
          callback: (event: BuildTaskUpdateEvent) => void
        ): Promise<() => void> => {
          // subscribeTasks was removed from ShapeBuildAPI in favour of subscribeTaskProgress.
          // This method is kept for API compatibility but always returns a no-op unsubscribe.
          void nodeType; void nodeId; void callback;
          return () => { };
        };

        const requireEventType = (event: unknown, expectedType: string, context: string): Record<string, unknown> => {
          if (!event || typeof event !== 'object') {
<<<<<<< fix/shape-plugin/wire-emit-task-progress-subscribe-task-progress-1141
            throw new Error(`[${context}] event must be an object, received ${JSON.stringify(event)}`);
          }
          const rec = event as Record<string, unknown>;
          if (rec.type !== expectedType) {
            throw new Error(`[${context}] unexpected event type: expected "${expectedType}", received ${JSON.stringify(rec.type)}`);
=======
            throw new Error(`[${context}] event must be an object, received ${safeStringify(event)}`);
          }
          const rec = event as Record<string, unknown>;
          if (rec.type !== expectedType) {
            throw new Error(`[${context}] unexpected event type: expected "${expectedType}", received ${safeStringify(rec.type)}`);
>>>>>>> main
          }
          return rec;
        };

        const subscribeStageSnapshots = async (
          nodeType: NodeType,
          nodeId: NodeId,
          callback: (event: unknown) => void
        ): Promise<() => void> => {
          const buildApi = resolveShapeBuildApiOrThrow(nodeType);
          if (!buildApi.subscribeStageSnapshots) {
            throw new Error(`[subscribeStageSnapshots] subscribeStageSnapshots not available for nodeType: ${nodeType}`);
          }
          const wrappedCallback = (event: unknown): void => {
            const sanitized = sanitizeForComlink(event);
            requireEventType(sanitized, 'stageSnapshotUpdated', 'subscribeStageSnapshots');
            callback(sanitized);
          };
          const unsubscribe = buildApi.subscribeStageSnapshots(nodeId, wrappedCallback as (event: any) => void);
          return toComlinkProxy(Comlink, unsubscribe);
        };

        const subscribeSessionState = async (
          nodeType: NodeType,
          nodeId: NodeId,
          callback: (event: unknown) => void
        ): Promise<() => void> => {
          const buildApi = resolveShapeBuildApiOrThrow(nodeType);
          if (!buildApi.subscribeSessionState) {
            throw new Error(`[subscribeSessionState] subscribeSessionState not available for nodeType: ${nodeType}`);
          }
          const wrappedCallback = (event: unknown): void => {
            const sanitized = sanitizeForComlink(event);
            requireEventType(sanitized, 'sessionStatusUpdated', 'subscribeSessionState');
            callback(sanitized);
          };
          const unsubscribe = buildApi.subscribeSessionState(nodeId, wrappedCallback);
          return toComlinkProxy(Comlink, unsubscribe);
        };

        const subscribeSessionHeartbeat = async (
          nodeType: NodeType,
          nodeId: NodeId,
          callback: (event: unknown) => void
        ): Promise<() => void> => {
          const buildApi = resolveShapeBuildApiOrThrow(nodeType);
          if (!buildApi.subscribeHeartbeat) {
            throw new Error(`[subscribeSessionHeartbeat] subscribeHeartbeat not available for nodeType: ${nodeType}`);
          }
          const wrappedCallback = (event: unknown): void => {
            const sanitized = sanitizeForComlink(event);
            requireEventType(sanitized, 'heartbeat', 'subscribeSessionHeartbeat');
            callback(sanitized);
          };
          const unsubscribe = buildApi.subscribeHeartbeat(nodeId, wrappedCallback);
          return toComlinkProxy(Comlink, unsubscribe);
        };

        const subscribeWorkerLog = async (
          nodeType: NodeType,
          nodeId: NodeId,
          callback: (event: unknown) => void
        ): Promise<() => void> => {
          const buildApi = resolveShapeBuildApiOrThrow(nodeType);
          if (!buildApi.subscribeWorkerLog) {
            throw new Error(`[subscribeWorkerLog] subscribeWorkerLog not available for nodeType: ${nodeType}`);
          }
          const wrappedCallback = (event: unknown): void => {
            const sanitized = sanitizeForComlink(event);
            // WorkerLogEvent does not have a canonical 'type' field in the 4-event spec;
            // validate that it is at least a non-null object.
            if (!sanitized || typeof sanitized !== 'object') {
<<<<<<< fix/shape-plugin/wire-emit-task-progress-subscribe-task-progress-1141
              throw new Error(`[subscribeWorkerLog] event must be an object, received ${JSON.stringify(sanitized)}`);
=======
              throw new Error(`[subscribeWorkerLog] event must be an object, received ${safeStringify(sanitized)}`);
>>>>>>> main
            }
            callback(sanitized);
          };
          const unsubscribe = buildApi.subscribeWorkerLog(nodeId, wrappedCallback);
          return toComlinkProxy(Comlink, unsubscribe);
        };

        const getBuildTasks = async (
          nodeType: NodeType,
          nodeId: NodeId
        ): Promise<BuildTaskSummary[]> => {
          const provider = buildTaskProviders.get(nodeType);
          if (!provider) return [];
          try {
            return await provider(nodeId);
          } catch (error) {
            const msg = error instanceof Error ? error.message : String(error);
            console.warn(`[worker bootstrap] getBuildTasks failed for ${nodeType}:`, msg);
            return [];
          }
        };

        const api: BuildWorkerAPI = {
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
          getCommandProcessor: async () => {
            const commandProcessor = services.getCommandProcessor();
            return {
              canUndo: () => commandProcessor.canUndo(),
              canRedo: () => commandProcessor.canRedo(),
            };
          },
          startBuildSession,
          generateShapeDownloadTaskPayloadsFromSelection: async (
            nodeId: NodeId,
            dataSource: ShapeDataSourceName,
            selectedArrayByCountries: Record<string, boolean[]>
          ): Promise<ShapeDownloadTaskPayloads> => {
            const api = resolveShapeBuildApiOrThrow(SHAPE_NODE_TYPE);
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
          getBuildSessionStatus,
          pauseBuildSession,
          cancelQueuedBuildSession,
          subscribeTaskProgress,
          subscribeBuildTasks,
          subscribeStageSnapshots,
          subscribeSessionState,
          subscribeSessionHeartbeat,
          subscribeWorkerLog,
          subscribeHeapPressure: async (
            callback: (event: HeapPressureEvent) => void
          ): Promise<() => void> => {
            const wrappedCallback = (event: HeapPressureEvent): void => {
              callback(sanitizeForComlink(event));
            };
            heapListeners.add(wrappedCallback);
            return toComlinkProxy(Comlink, () => {
              heapListeners.delete(wrappedCallback);
            });
          },
          getBuildTasks,
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
              return () => { };
            }
            const queryAPI = services.getShapeQueryAPI();
            const statuses = ['idle', 'running', 'paused', 'completed', 'failed'] as Array<
              'idle' | 'running' | 'paused' | 'completed' | 'failed'
            >;
            const observable = liveQuery(() => queryAPI.listBuildSessionRecordsByStatus(statuses));
            const dispatch = async () => {
              try {
                const sessions = await getRuntimeRecordsForShape(filter);
                callback(sanitizeForComlink(sessions));
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
                callback(sanitizeForComlink([]));
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
              return () => { };
            }
            const queryAPI = services.getShapeQueryAPI();
            const normalized = normalizeSessionStatuses(statuses);
            const observable = liveQuery(() => queryAPI.listBuildSessionRecordsByStatus(normalized));
            const subscription = observable.subscribe({
              next: (sessions) => {
                callback(sanitizeForComlink(sessions));
              },
              error: (error) => {
                const msg = error instanceof Error ? error.message : String(error);
                console.warn('[worker bootstrap] build session subscription failed:', msg);
                callback(sanitizeForComlink([]));
              },
            });
            const dispatchSessions = async () => {
              try {
                const sessions = await queryAPI.listBuildSessionRecordsByStatus(normalized);
                callback(sanitizeForComlink(sessions));
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
          requestAuthToken: async (): Promise<string | null> => {
            // Issue #823: Enhanced debug logging for worker token request processing
            const requestStart = performance.now();
            console.debug('[worker bootstrap] requestAuthToken called - Issue #823 debug:', {
              timestamp: new Date().toISOString(),
              hasUiTokenRequestCallback: typeof uiTokenRequestCallback === 'function',
              callbackType: typeof uiTokenRequestCallback,
              requestStartTime: requestStart,
            });

            // Request token from UI side via callback
            if (typeof uiTokenRequestCallback === 'function') {
              try {
                console.debug('[worker bootstrap] Requesting token from UI via callback - Issue #823 debug:', {
                  timestamp: new Date().toISOString(),
                  callbackType: typeof uiTokenRequestCallback,
                  requestStartTime: requestStart,
                });

                const callbackStart = performance.now();
                const token = await uiTokenRequestCallback();
                const callbackEnd = performance.now();

                console.debug('[worker bootstrap] UI token request result - Issue #823 debug:', {
                  hasToken: Boolean(token),
                  tokenLength: token?.length || 0,
                  tokenPreview: token ? `${token.substring(0, 10)}...` : null,
                  callbackTimeMs: Math.round(callbackEnd - callbackStart),
                  totalTimeMs: Math.round(callbackEnd - requestStart),
                  timestamp: new Date().toISOString(),
                });
                return token;
              } catch (error) {
                const callbackEnd = performance.now();
                console.warn('[worker bootstrap] UI token request failed - Issue #823 debug:', {
                  error: error instanceof Error ? error.message : String(error),
                  errorStack: error instanceof Error ? error.stack : undefined,
                  errorName: error instanceof Error ? error.name : 'unknown',
                  callbackTimeMs: Math.round(callbackEnd - requestStart),
                  timestamp: new Date().toISOString(),
                });
                return null;
              }
            } else {
              console.debug('[worker bootstrap] No UI token request callback available - Issue #823 debug:', {
                callbackType: typeof uiTokenRequestCallback,
                callbackValue: uiTokenRequestCallback,
                timestamp: new Date().toISOString(),
              });
            }

            // Fallback to AuthService if no UI callback available
            try {
              console.debug('[worker bootstrap] Falling back to AuthService for token - Issue #823 debug:', {
                timestamp: new Date().toISOString(),
                fallbackStartTime: performance.now(),
              });

              const authServiceStart = performance.now();
              const auth = await AuthService.getSingleton();
              const authHeaders = await auth.getAuthHeaders();
              const authServiceEnd = performance.now();

              const authHeader = authHeaders.Authorization;
              if (authHeader && authHeader.startsWith('Bearer ')) {
                const token = authHeader.slice(7); // Remove 'Bearer ' prefix
                console.debug('[worker bootstrap] AuthService token result - Issue #823 debug:', {
                  hasToken: Boolean(token),
                  tokenLength: token?.length || 0,
                  tokenPreview: token ? `${token.substring(0, 10)}...` : null,
                  authServiceTimeMs: Math.round(authServiceEnd - authServiceStart),
                  totalTimeMs: Math.round(authServiceEnd - requestStart),
                  timestamp: new Date().toISOString(),
                });
                return token;
              }
              console.debug('[worker bootstrap] No valid Authorization header from AuthService - Issue #823 debug:', {
                hasAuthHeader: Boolean(authHeader),
                authHeaderPreview: authHeader ? `${authHeader.substring(0, 20)}...` : null,
                authServiceTimeMs: Math.round(authServiceEnd - authServiceStart),
                totalTimeMs: Math.round(authServiceEnd - requestStart),
                timestamp: new Date().toISOString(),
              });
              return null;
            } catch (error) {
              const fallbackEnd = performance.now();
              console.warn('[worker bootstrap] AuthService token request failed - Issue #823 debug:', {
                error: error instanceof Error ? error.message : String(error),
                errorStack: error instanceof Error ? error.stack : undefined,
                errorName: error instanceof Error ? error.name : 'unknown',
                fallbackTimeMs: Math.round(fallbackEnd - requestStart),
                timestamp: new Date().toISOString(),
              });
              return null;
            }
          },
          setUiTokenRequestCallback: async (callback: (() => Promise<string | null>) | null): Promise<void> => {
            console.debug('[worker bootstrap] setUiTokenRequestCallback called - Issue #823 debug:', {
              hasCallback: typeof callback === 'function',
              callbackType: typeof callback,
              previousCallbackType: typeof uiTokenRequestCallback,
              timestamp: new Date().toISOString(),
            });
            uiTokenRequestCallback = callback;
            console.debug('[worker bootstrap] uiTokenRequestCallback set successfully - Issue #823 debug:', {
              newCallbackType: typeof uiTokenRequestCallback,
              timestamp: new Date().toISOString(),
            });
          },
        };

        // Setup AuthService with WorkerAPI for token requests
        try {
          console.debug('[worker bootstrap] Setting up AuthService with WorkerAPI - Issue #823 debug:', {
            timestamp: new Date().toISOString(),
            hasRequestAuthTokenMethod: typeof api.requestAuthToken === 'function',
          });
          const auth = await AuthService.getSingleton();
          auth.setWorkerAPI(api);
          console.debug('[worker bootstrap] AuthService setup completed - Issue #823 debug:', {
            timestamp: new Date().toISOString(),
          });
        } catch (error) {
          console.warn('[worker bootstrap] Failed to setup AuthService with WorkerAPI - Issue #823 debug:', {
            error: error instanceof Error ? error.message : String(error),
            errorStack: error instanceof Error ? error.stack : undefined,
            timestamp: new Date().toISOString(),
          });
        }

        reporter.reportStepProgress('Create API facade', 100);
        await recoverBuildSessionFromPersistedState();

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
