/**
 * Shared bootstrap for Dedicated/Shared worker runtimes.
 */

import { AuthService } from '@hierarchidb/auth';
import type {
  BuildSessionRuntimeFilter,
  BuildSessionRuntimeRecord,
  BuildSessionRuntimeStatus,
  BuildSessionStatus,
  BuildTaskSummary,
  CanonicalBuildInputSource,
  CanonicalBuildRuntimeAdapter,
  CanonicalPluginBuildAPI,
  HeartbeatEvent,
  SessionStatusUpdatedEvent,
  StageSnapshotUpdatedEvent,
  TaskProgressUpdatedEvent,
  WorkerLogEvent,
} from '@hierarchidb/build-api';
import { CanonicalBuildRuntimeAdapterRegistry } from '@hierarchidb/build-runtime-services';
import type { NodeId, NodeType } from '@hierarchidb/core-types';
import { setCorsProxyBaseURL } from '@hierarchidb/download';
import {
  createHeapPressureMonitor,
  type HeapPressureContext,
  type HeapPressureEvent,
} from '@hierarchidb/memory';
import type { PluginDefinition, PluginRegistryEntry } from '@hierarchidb/plugin-registry/types';
import {
  CoreDB,
  configureWorkerContainer,
  createStagedFolderActionBuildRuntimeAdapter,
  getWorkerContainer,
  type PluginWorkerModuleLoaderContract,
  StagedFolderActionProgressStore,
  subscribeToBuildSessionBroadcast,
  WorkerDiTokens,
  WorkerService,
  type WorkerServiceOptions,
} from '@hierarchidb/runtime-worker';
import {
  getYamlStorageAccessDecision,
  type YamlStorageCanonicalReadyState,
} from '@hierarchidb/runtime-worker/yaml-storage-activation';
import { inspectCanonicalYamlStorageCoreDb } from '@hierarchidb/runtime-worker/yaml-storage-production';
import type { ShapeBuildSessionRecord, ShapeDataSourceName } from '@hierarchidb/shape-api';
import {
  getAllRuntimeExports,
  type WorkerInitializationReporter,
  wirePluginsFromModules,
} from '@hierarchidb/ui-worker-client';
import { digestSha256Hex, getBuildDatabasePrefix, getDBName } from '@hierarchidb/util';
import type { UiStorageBridge, YamlCanonicalZipServiceFactory } from '@hierarchidb/worker-api';
import { liveQuery } from 'dexie';
import { canonicalBuildFeatureFlags } from '~/config/canonicalBuildFeatureFlags';
import { resolveRequiredCorsProxyBaseURL } from '~/config/resolveRequiredCorsProxyBaseURL';
import {
  pluginDefinitions as staticPluginDefinitions,
  pluginRegistry as staticPluginRegistry,
} from '~/plugin-loaders/index';
import { pluginWorkerLoaders } from '~/plugin-loaders/workerLoaderUtils';
import type { BuildWorkerAPI } from '~/types/workerApiTypes';
import { resolveCanonicalBuildRuntimeModule } from './resolveCanonicalBuildRuntimeModule.js';
import { resolveCanonicalBuildStartInput } from './resolveCanonicalBuildStartInput.js';
import {
  resolveShapeBuildExtensions,
  type ShapeDownloadTaskPayload,
} from './resolveShapeBuildExtensions.js';
import { resolveShapeBuildRuntimeAdapterHooks } from './resolveShapeBuildRuntimeAdapterHooks.js';

/** Runtime export metadata (subset consumed during bootstrap). */
type RuntimeExportEntry = {
  lifecycle?: unknown;
  createEntityHandler?: () => Promise<unknown>;
};
type PluginModuleEntry = { nodeType: string; mod: unknown };

type YamlCanonicalDialogWriter = NonNullable<WorkerServiceOptions['yamlCanonicalDialogWriter']>;
type RouteCanonicalBuildInputResolverConfigurator = (deps: {
  treeQueryAPI: ReturnType<WorkerService['getQueryAPI']>;
  locationQueryAPI: ReturnType<WorkerService['getLocationQueryAPI']>;
  dbPrefix: string;
}) => void;

type ManualPluginSelf = typeof self & {
  __HIERARCHIDB_MANUAL_PLUGIN_DEFS__?: PluginDefinition[];
};

type WorkerMessageTarget = {
  postMessage?: (msg: unknown) => void;
};

type RuntimeWorkerBootstrap = {
  api: BuildWorkerAPI;
  servicesReadyAt: number;
};

const heapListeners = new Set<(event: HeapPressureEvent) => void>();
let heapMonitor: ReturnType<typeof createHeapPressureMonitor> | null = null;

const ensureHeapMonitor = (): ReturnType<typeof createHeapPressureMonitor> => {
  if (heapMonitor !== null) return heapMonitor;
  const monitor = createHeapPressureMonitor({ source: 'worker' });
  monitor.subscribe((event) => {
    heapListeners.forEach((listener) => {
      listener(event);
    });
  });
  monitor.start();
  heapMonitor = monitor;
  return monitor;
};

const setHeapContext = (context: HeapPressureContext | null) => {
  ensureHeapMonitor().setContext(context);
};

const toComlinkProxy = <T extends object>(Comlink: typeof import('comlink'), value: T): T =>
  Comlink.proxy(value) as T;

const guardCanonicalWorkerApi = (
  api: BuildWorkerAPI,
  canonicalReadyState: YamlStorageCanonicalReadyState
): BuildWorkerAPI =>
  new Proxy(api, {
    get(target, property, receiver) {
      const decision = getYamlStorageAccessDecision(canonicalReadyState, {
        domain: 'runtime',
        representation: 'canonical',
        operation: 'query',
      });
      if (!decision.allowed) {
        throw new Error(`yaml-storage-canonical-access-denied:${decision.code}`);
      }
      const value = Reflect.get(target, property, receiver) as unknown;
      return typeof value === 'function'
        ? (...args: unknown[]) => {
            const callDecision = getYamlStorageAccessDecision(canonicalReadyState, {
              domain: 'runtime',
              representation: 'canonical',
              operation: 'mutation',
            });
            if (!callDecision.allowed) {
              throw new Error(`yaml-storage-canonical-access-denied:${callDecision.code}`);
            }
            return Reflect.apply(value, target, args);
          }
        : value;
    },
  });

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
const initialCorsProxyBaseURL = resolveRequiredCorsProxyBaseURL(
  import.meta.env?.VITE_CORS_PROXY_BASE_URL,
  'worker'
);
setCorsProxyBaseURL(initialCorsProxyBaseURL);

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

const runWorkerStorePreloads = async (
  moduleEntries: PluginModuleEntry[],
  pluginRegistry: PluginRegistryEntry[]
): Promise<void> => {
  const registryByNodeType = new Map(pluginRegistry.map((entry) => [entry.nodeType, entry]));
  for (const entry of moduleEntries) {
    const registryEntry = registryByNodeType.get(entry.nodeType);
    const preloadExports = registryEntry?.manifest?.worker?.preload ?? [];
    const moduleRecord =
      entry.mod !== null && (typeof entry.mod === 'object' || typeof entry.mod === 'function')
        ? (entry.mod as Record<string, unknown>)
        : null;
    if (moduleRecord === null) continue;
    for (const exportName of preloadExports) {
      if (!/^register[A-Z].*WorkerStores$/u.test(exportName)) continue;
      const preload = moduleRecord[exportName];
      if (typeof preload !== 'function') {
        throw new Error(
          `[worker bootstrap] plugin worker store preload is not exported: ${entry.nodeType}.${exportName}`
        );
      }
      await Promise.resolve((preload as () => unknown)());
    }
  }
};

export const ensureRuntimeWorkerBootstrap = async (options: {
  reporter: WorkerInitializationReporter;
  messageTarget?: WorkerMessageTarget | null;
  yamlStorageGate: 'revoked-ready-for-preflight';
}): Promise<RuntimeWorkerBootstrap> => {
  if (bootstrapPromise) return bootstrapPromise;

  bootstrapPromise = (async () => {
    const reporter = options.reporter;

    try {
      if (options.yamlStorageGate !== 'revoked-ready-for-preflight') {
        throw new Error('yaml-storage-canonical-gate-required');
      }
      if (typeof crypto?.randomUUID !== 'function') {
        throw new Error('yaml-storage-crypto-identity-unavailable');
      }
      const databasePrefix = getBuildDatabasePrefix();
      const coreDatabaseName = getDBName(databasePrefix, 'core');
      const canonicalInspection = await inspectCanonicalYamlStorageCoreDb({
        activationId: crypto.randomUUID(),
        databaseName: coreDatabaseName,
        targetVersion: 2,
        openRequestId: crypto.randomUUID(),
        coordinatorGate: options.yamlStorageGate,
        environment: {
          indexedDB,
          digestSha256Hex,
          initializeCoreDb: async () => {
            await CoreDB.getSingleton(coreDatabaseName);
          },
        },
      });
      if (canonicalInspection.ok === false) {
        throw new Error(`yaml-storage-post-activation-failed:${canonicalInspection.error.code}`);
      }
      const accessDecision = getYamlStorageAccessDecision(canonicalInspection.state, {
        domain: 'runtime',
        representation: 'canonical',
        operation: 'query',
      });
      if (!accessDecision.allowed) {
        throw new Error(`yaml-storage-canonical-access-denied:${accessDecision.code}`);
      }
      const assertYamlStorageCanonicalAccess = (): void => {
        const currentDecision = getYamlStorageAccessDecision(canonicalInspection.state, {
          domain: 'runtime',
          representation: 'canonical',
          operation: 'mutation',
        });
        if (!currentDecision.allowed) {
          throw new Error(`yaml-storage-canonical-access-denied:${currentDecision.code}`);
        }
      };

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

      const moduleEntries: PluginModuleEntry[] = [];

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

      const yamlModule = moduleEntries.find((entry) => entry.nodeType === 'yaml-file')?.mod;
      const yamlCanonicalDialogWriter =
        yamlModule !== null &&
        typeof yamlModule === 'object' &&
        'writeYamlCanonicalDialogDraft' in yamlModule &&
        typeof yamlModule.writeYamlCanonicalDialogDraft === 'function'
          ? (yamlModule.writeYamlCanonicalDialogDraft as YamlCanonicalDialogWriter)
          : null;
      if (
        pluginDefinitions.some((definition) => definition.nodeType === 'yaml-file') &&
        yamlCanonicalDialogWriter === null
      ) {
        throw new Error('yaml-canonical-dialog-writer-unavailable');
      }
      const folderModule = moduleEntries.find((entry) => entry.nodeType === 'folder')?.mod;
      const yamlCanonicalZipServiceFactory =
        folderModule !== null &&
        typeof folderModule === 'object' &&
        'createYamlCanonicalZipService' in folderModule &&
        typeof folderModule.createYamlCanonicalZipService === 'function'
          ? (folderModule.createYamlCanonicalZipService as YamlCanonicalZipServiceFactory)
          : null;
      if (
        pluginDefinitions.some((definition) => definition.nodeType === 'folder') &&
        yamlCanonicalZipServiceFactory === null
      ) {
        throw new Error('yaml-canonical-zip-service-factory-unavailable');
      }

      if (pluginDefinitions.length > 0) {
        reporter.reportStepProgress('Load plugin-loaders', 100);
      }

      const exportsByType = getAllRuntimeExports() as Record<string, RuntimeExportEntry>;
      const enrichedDefinitions = pluginDefinitions.map((definition) => {
        const extra = exportsByType?.[definition.nodeType];
        return extra?.lifecycle ? { ...definition, lifecycle: extra.lifecycle } : definition;
      });

      const SHAPE_NODE_TYPE = 'shape' as NodeType;
      const ROUTE_NODE_TYPE = 'route' as NodeType;
      const canonicalBuildAPIs = new Map<NodeType, CanonicalPluginBuildAPI>();
      const canonicalBuildRuntimeAdapters: CanonicalBuildRuntimeAdapter[] = [];
      for (const entry of moduleEntries) {
        const { buildAPI: buildApi, runtimeAdapter } = resolveCanonicalBuildRuntimeModule(
          entry.mod
        );
        if (buildApi) {
          canonicalBuildAPIs.set(entry.nodeType as NodeType, buildApi);
        }
        if (runtimeAdapter) {
          canonicalBuildRuntimeAdapters.push(runtimeAdapter);
        }
      }
      const shapeModule = moduleEntries.find((entry) => entry.nodeType === SHAPE_NODE_TYPE)?.mod;
      const shapeBuildExtensions = resolveShapeBuildExtensions(shapeModule);
      const applyCorsProxyBaseURL = (url: string): void => {
        setCorsProxyBaseURL(url);
        shapeBuildExtensions.setCorsProxyBaseURL(url);
      };
      applyCorsProxyBaseURL(initialCorsProxyBaseURL);

      try {
        // Use a static import to avoid bundler facade re-export mismatches in preview builds.
        reporter.reportStepProgress('Bootstrap services', 10);
        const services = await WorkerService.getSingleton(
          enrichedDefinitions.length > 0 ? enrichedDefinitions : pluginDefinitions,
          {
            databasePrefix,
            ...(yamlCanonicalDialogWriter === null ? {} : { yamlCanonicalDialogWriter }),
            ...(yamlCanonicalZipServiceFactory === null ? {} : { yamlCanonicalZipServiceFactory }),
            assertYamlStorageCanonicalAccess,
          }
        );
        reporter.reportStepProgress('Bootstrap services', 60);
        await runWorkerStorePreloads(moduleEntries, staticPluginRegistry);
        reporter.reportStepProgress('Bootstrap services', 100);

        const routeModule = moduleEntries.find((entry) => entry.nodeType === ROUTE_NODE_TYPE)?.mod;
        if (
          routeModule !== null &&
          typeof routeModule === 'object' &&
          'configureRouteCanonicalBuildInputResolver' in routeModule &&
          typeof routeModule.configureRouteCanonicalBuildInputResolver === 'function'
        ) {
          (
            routeModule.configureRouteCanonicalBuildInputResolver as RouteCanonicalBuildInputResolverConfigurator
          )({
            treeQueryAPI: services.getQueryAPI(),
            locationQueryAPI: services.getLocationQueryAPI(),
            dbPrefix: databasePrefix,
          });
        }

        const servicesReadyAt = Date.now();
        options.messageTarget?.postMessage?.({
          type: 'SERVICES_READY',
          source: 'worker',
          at: servicesReadyAt,
        });

        reporter.reportStepProgress('Create API facade', 10);

        const resolveCanonicalBuildAPIOrThrow = (nodeType: NodeType): CanonicalPluginBuildAPI => {
          const api = canonicalBuildAPIs.get(nodeType);
          if (!api) {
            throw new Error(
              `[worker bootstrap] canonicalBuildAPI is not registered for nodeType: ${nodeType}`
            );
          }
          return api;
        };
        const normalizeSessionStatuses = (
          statuses: Array<'idle' | 'running' | 'paused' | 'completed' | 'failed'>
        ): Array<'idle' | 'running' | 'paused' | 'completed' | 'failed'> =>
          statuses.length > 0
            ? statuses
            : (['running'] as Array<'idle' | 'running' | 'paused' | 'completed' | 'failed'>);
        const shapeBuildRuntimeAdapterHooks = resolveShapeBuildRuntimeAdapterHooks(shapeModule);
        shapeBuildRuntimeAdapterHooks.configureShapeCanonicalBuildRuntimeAdapter({
          queryAPI: services.getShapeQueryAPI(),
          mutationAPI: services.getShapeMutationAPI(),
        });
        const stagedFolderActionProgressStore = new StagedFolderActionProgressStore(
          getDBName(databasePrefix, 'staged-folder-action-progress')
        );
        const buildRuntimeAdapters = new CanonicalBuildRuntimeAdapterRegistry([
          ...canonicalBuildRuntimeAdapters,
          createStagedFolderActionBuildRuntimeAdapter(stagedFolderActionProgressStore),
        ]);
        buildRuntimeAdapters.require(SHAPE_NODE_TYPE);
        const runtimeInputSources = new Map<string, CanonicalBuildInputSource>();
        const runtimeInputSourceKey = (nodeType: NodeType, nodeId: NodeId): string =>
          `${String(nodeType)}\u0000${String(nodeId)}`;
        const setRuntimeTransientStatus = (
          nodeType: NodeType,
          nodeId: NodeId,
          status: BuildSessionRuntimeStatus
        ): void => {
          if (nodeType !== SHAPE_NODE_TYPE) return;
          shapeBuildRuntimeAdapterHooks.setShapeBuildRuntimeTransientStatus(nodeId, status);
        };
        const clearRuntimeTransientStatus = (nodeType: NodeType, nodeId: NodeId): void => {
          if (nodeType !== SHAPE_NODE_TYPE) return;
          shapeBuildRuntimeAdapterHooks.clearShapeBuildRuntimeTransientStatus(nodeId);
        };

        const runStartBuildSession = async (
          nodeType: NodeType,
          nodeId: NodeId,
          inputSource: CanonicalBuildInputSource
        ): Promise<BuildSessionStatus> => {
          const buildApi = resolveCanonicalBuildAPIOrThrow(nodeType);
          setRuntimeTransientStatus(nodeType, nodeId, 'starting');
          try {
            const treeNode = await services.getTreeNodeUpdaterAPI().getTreeNode(nodeId);
            const input = resolveCanonicalBuildStartInput({
              nodeType,
              nodeId,
              source: inputSource,
              treeNode,
            });
            const status = await buildApi.startBuildSession({
              nodeId,
              input: {
                source: input.source,
                payload: input.payload,
              },
            });
            if (status.nodeId !== nodeId) {
              throw new Error(
                `[worker bootstrap] canonical build status nodeId mismatch: expected=${String(nodeId)}, actual=${String(status.nodeId)}`
              );
            }
            runtimeInputSources.set(runtimeInputSourceKey(nodeType, nodeId), input.source);
            if (nodeType === SHAPE_NODE_TYPE) {
              shapeBuildRuntimeAdapterHooks.setShapeBuildRuntimeInputSource(nodeId, input.source);
            }
            setHeapContext({ nodeType, nodeId: status.nodeId });
            clearRuntimeTransientStatus(nodeType, nodeId);
            return { ...status, inputSource: input.source };
          } catch (error) {
            clearRuntimeTransientStatus(nodeType, nodeId);
            throw error;
          }
        };

        const runPauseBuildSession = async (
          nodeType: NodeType,
          nodeId: NodeId,
          reason?: string
        ): Promise<void> => {
          const buildApi = resolveCanonicalBuildAPIOrThrow(nodeType);
          console.warn('[worker bootstrap][PauseTrace] pause-requested', {
            nodeType,
            nodeId,
            reason: reason ?? null,
          });
          setRuntimeTransientStatus(nodeType, nodeId, 'pausing');
          try {
            await buildApi.pauseBuildSession(nodeId, reason);
            console.warn('[worker bootstrap][PauseTrace] pause-finished', {
              nodeType,
              nodeId,
              reason: reason ?? null,
              observedStatus: 'paused',
            });
            clearRuntimeTransientStatus(nodeType, nodeId);
            return;
          } catch (error) {
            const msg = error instanceof Error ? error.message : String(error);
            console.warn('[worker bootstrap][PauseTrace] pause-failed', {
              nodeType,
              nodeId,
              reason: reason ?? null,
              errorMessage: msg,
            });
            clearRuntimeTransientStatus(nodeType, nodeId);
            throw error;
          }
        };

        const runCancelQueuedBuildSession = async (
          nodeType: NodeType,
          nodeId: NodeId,
          reason?: string
        ): Promise<void> => {
          const buildApi = resolveCanonicalBuildAPIOrThrow(nodeType);
          await buildApi.cancelQueuedBuildSession(nodeId, reason);
          clearRuntimeTransientStatus(nodeType, nodeId);
        };

        const runRestartBuildSession = async (
          nodeType: NodeType,
          nodeId: NodeId
        ): Promise<void> => {
          await runStartBuildSession(
            nodeType,
            nodeId,
            runtimeInputSources.get(runtimeInputSourceKey(nodeType, nodeId)) ?? 'committed'
          );
        };

        const RESUME_SESSION_FRESHNESS_WINDOW_MS = 5 * 60 * 1000;

        const resolveSessionRecoveryBaselineAt = (session: ShapeBuildSessionRecord): number => {
          if (
            typeof session.lastHeartbeatAt === 'number' &&
            Number.isFinite(session.lastHeartbeatAt)
          ) {
            return session.lastHeartbeatAt;
          }
          if (typeof session.lastActivity === 'number' && Number.isFinite(session.lastActivity)) {
            return session.lastActivity;
          }
          if (
            typeof session.stageHeartbeatAt === 'number' &&
            Number.isFinite(session.stageHeartbeatAt)
          ) {
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
          now: number
        ): boolean => {
          if (typeof session.expiresAt === 'number' && Number.isFinite(session.expiresAt)) {
            if (session.expiresAt <= now) return false;
          }

          const baseline = resolveSessionRecoveryBaselineAt(session);
          if (!Number.isFinite(baseline) || baseline <= 0) return false;
          return now - baseline <= RESUME_SESSION_FRESHNESS_WINDOW_MS;
        };

        const isSessionStaleRunning = (session: ShapeBuildSessionRecord, now: number): boolean =>
          !isRecoverableRunningSession(session, now);

        const recoverBuildSessionFromPersistedState = async (): Promise<void> => {
          const queryAPI = services.getShapeQueryAPI();
          const mutationAPI = services.getShapeMutationAPI();
          const runningSessions = await queryAPI.listBuildSessionRecordsByStatus(['running']);
          if (runningSessions.length === 0) return;

          const now = Date.now();
          const staleSessions = runningSessions.filter((session) =>
            isSessionStaleRunning(session, now)
          );
          const freshSessions = runningSessions
            .filter((session) => isRecoverableRunningSession(session, now))
            .sort(
              (a, b) => resolveSessionRecoveryBaselineAt(b) - resolveSessionRecoveryBaselineAt(a)
            );
          const latestSession = freshSessions[0];
          if (staleSessions.length > 0) {
            await Promise.all(
              staleSessions.map(async (session) => {
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
                  console.info(
                    '[worker bootstrap][ResumeTrace] mark-stale-running-session-paused',
                    {
                      nodeId: session.nodeId,
                      stopReason: 'route-leave',
                      inactiveMs,
                    }
                  );
                } catch (error) {
                  const msg = error instanceof Error ? error.message : String(error);
                  console.warn(
                    '[worker bootstrap][ResumeTrace] mark-stale-running-session-paused-failed',
                    {
                      nodeId: session.nodeId,
                      errorMessage: msg,
                    }
                  );
                }
              })
            );
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
          inputSource: CanonicalBuildInputSource
        ): Promise<BuildSessionStatus> => runStartBuildSession(nodeType, nodeId, inputSource);

        const getBuildSessionStatus = async (
          nodeType: NodeType,
          nodeId: NodeId
        ): Promise<BuildSessionStatus> => {
          const buildApi = resolveCanonicalBuildAPIOrThrow(nodeType);
          return buildApi.getBuildSessionStatus(nodeId);
        };

        const pauseBuildSession = async (
          nodeType: NodeType,
          nodeId: NodeId,
          reason?: string
        ): Promise<void> => runPauseBuildSession(nodeType, nodeId, reason);

        const cancelQueuedBuildSession = async (
          nodeType: NodeType,
          nodeId: NodeId,
          reason?: string
        ): Promise<void> => runCancelQueuedBuildSession(nodeType, nodeId, reason);

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

        const subscribeTaskProgress = async (
          nodeType: NodeType,
          nodeId: NodeId,
          callback: (event: TaskProgressUpdatedEvent) => void
        ): Promise<() => void> => {
          const buildApi = resolveCanonicalBuildAPIOrThrow(nodeType);
          const wrappedCallback = (event: TaskProgressUpdatedEvent): void => {
            const sanitized = sanitizeForComlink(event);
            if (
              !sanitized ||
              typeof sanitized !== 'object' ||
              (sanitized as { type?: unknown }).type !== 'taskProgressUpdated'
            ) {
              throw new Error(
                `[subscribeTaskProgress] unexpected event type: ${safeStringify((sanitized as { type?: unknown } | null)?.type ?? sanitized)}`
              );
            }
            callback(sanitized as TaskProgressUpdatedEvent);
          };
          const unsubscribe = await buildApi.subscribeTaskProgress(nodeId, wrappedCallback);
          return toComlinkProxy(Comlink, unsubscribe);
        };

        const requireEventType = (
          event: unknown,
          expectedType: string,
          context: string
        ): Record<string, unknown> => {
          if (!event || typeof event !== 'object') {
            throw new Error(
              `[${context}] event must be an object, received ${safeStringify(event)}`
            );
          }
          const rec = event as Record<string, unknown>;
          if (rec.type !== expectedType) {
            throw new Error(
              `[${context}] unexpected event type: expected "${expectedType}", received ${safeStringify(rec.type)}`
            );
          }
          return rec;
        };

        const subscribeStageSnapshots = async (
          nodeType: NodeType,
          nodeId: NodeId,
          callback: (event: StageSnapshotUpdatedEvent) => void
        ): Promise<() => void> => {
          const buildApi = resolveCanonicalBuildAPIOrThrow(nodeType);
          const wrappedCallback = (event: StageSnapshotUpdatedEvent): void => {
            const sanitized = sanitizeForComlink(event);
            requireEventType(sanitized, 'stageSnapshotUpdated', 'subscribeStageSnapshots');
            callback(sanitized);
          };
          const unsubscribe = await buildApi.subscribeStageSnapshots(nodeId, wrappedCallback);
          return toComlinkProxy(Comlink, unsubscribe);
        };

        const subscribeSessionState = async (
          nodeType: NodeType,
          nodeId: NodeId,
          callback: (event: SessionStatusUpdatedEvent) => void
        ): Promise<() => void> => {
          const buildApi = resolveCanonicalBuildAPIOrThrow(nodeType);
          const wrappedCallback = (event: SessionStatusUpdatedEvent): void => {
            const sanitized = sanitizeForComlink(event);
            requireEventType(sanitized, 'sessionStatusUpdated', 'subscribeSessionState');
            callback(sanitized);
          };
          const unsubscribe = await buildApi.subscribeSessionState(nodeId, wrappedCallback);
          return toComlinkProxy(Comlink, unsubscribe);
        };

        const subscribeSessionHeartbeat = async (
          nodeType: NodeType,
          nodeId: NodeId,
          callback: (event: HeartbeatEvent) => void
        ): Promise<() => void> => {
          const buildApi = resolveCanonicalBuildAPIOrThrow(nodeType);
          const wrappedCallback = (event: HeartbeatEvent): void => {
            const sanitized = sanitizeForComlink(event);
            requireEventType(sanitized, 'heartbeat', 'subscribeSessionHeartbeat');
            callback(sanitized);
          };
          const unsubscribe = await buildApi.subscribeSessionHeartbeat(nodeId, wrappedCallback);
          return toComlinkProxy(Comlink, unsubscribe);
        };

        const subscribeWorkerLog = async (
          nodeType: NodeType,
          nodeId: NodeId,
          callback: (event: WorkerLogEvent) => void
        ): Promise<() => void> => {
          const buildApi = resolveCanonicalBuildAPIOrThrow(nodeType);
          const wrappedCallback = (event: WorkerLogEvent): void => {
            const sanitized = sanitizeForComlink(event);
            // WorkerLogEvent does not have a canonical 'type' field in the 4-event spec;
            // validate that it is at least a non-null object.
            if (!sanitized || typeof sanitized !== 'object') {
              throw new Error(
                `[subscribeWorkerLog] event must be an object, received ${safeStringify(sanitized)}`
              );
            }
            callback(sanitized);
          };
          const unsubscribe = await buildApi.subscribeWorkerLog(nodeId, wrappedCallback);
          return toComlinkProxy(Comlink, unsubscribe);
        };

        const getBuildTasks = async (
          nodeType: NodeType,
          nodeId: NodeId
        ): Promise<BuildTaskSummary[]> => {
          const buildApi = resolveCanonicalBuildAPIOrThrow(nodeType);
          return buildApi.getBuildTasks(nodeId);
        };

        const api: BuildWorkerAPI = {
          ping: async () => services.ping(),
          initialize: () => services.initialize(),
          shutdown: () => services.shutdown(),
          getYamlCoreDbReadOnlyInventory: async () =>
            sanitizeForComlink(await services.getYamlCoreDbReadOnlyInventory()),
          getYamlCanonicalZipAPI: async () =>
            toComlinkProxy(Comlink, services.getYamlCanonicalZipAPI()),
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
          getTreeNodeUpdaterAPI: async () =>
            toComlinkProxy(Comlink, services.getTreeNodeUpdaterAPI()),
          getTreeTableExpandedAPI: async () =>
            toComlinkProxy(Comlink, services.getTreeTableExpandedAPI()),
          getPluginLifecycleAPI: async () =>
            toComlinkProxy(Comlink, services.getPluginLifecycleAPI()),
          getStyleQueryAPI: async () => toComlinkProxy(Comlink, services.getStyleQueryAPI()),
          getStyleMutationAPI: async () => toComlinkProxy(Comlink, services.getStyleMutationAPI()),
          getShapeQueryAPI: async () => toComlinkProxy(Comlink, services.getShapeQueryAPI()),
          getShapeMutationAPI: async () => toComlinkProxy(Comlink, services.getShapeMutationAPI()),
          getLocationQueryAPI: async () => toComlinkProxy(Comlink, services.getLocationQueryAPI()),
          getLocationMutationAPI: async () =>
            toComlinkProxy(Comlink, services.getLocationMutationAPI()),
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
          ): Promise<ShapeDownloadTaskPayload[]> => {
            const payloads = await shapeBuildExtensions.generateDownloadTaskPayloadsFromSelection(
              nodeId,
              dataSource,
              selectedArrayByCountries
            );
            return payloads;
          },
          getBuildSessionStatus,
          pauseBuildSession,
          cancelQueuedBuildSession,
          subscribeTaskProgress,
          subscribeStageSnapshots,
          subscribeSessionState,
          subscribeSessionHeartbeat,
          subscribeWorkerLog,
          subscribeHeapPressure: async (
            callback: (event: HeapPressureEvent) => void
          ): Promise<() => void> => {
            ensureHeapMonitor();
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
            if (
              !canonicalBuildFeatureFlags.canonicalBuildRuntimeAdapter &&
              nodeType !== SHAPE_NODE_TYPE
            ) {
              return null;
            }
            return buildRuntimeAdapters.getSession(nodeType, nodeId);
          },
          listBuildSessionRuntimes: async (
            nodeType: NodeType,
            filter?: BuildSessionRuntimeFilter
          ): Promise<BuildSessionRuntimeRecord[]> => {
            if (
              !canonicalBuildFeatureFlags.canonicalBuildRuntimeAdapter &&
              nodeType !== SHAPE_NODE_TYPE
            ) {
              return [];
            }
            return buildRuntimeAdapters.listSessions(nodeType, filter);
          },
          subscribeBuildSessionRuntimes: async (
            nodeType: NodeType,
            filter: BuildSessionRuntimeFilter | undefined,
            callback: (sessions: BuildSessionRuntimeRecord[]) => void
          ): Promise<() => void> => {
            if (
              !canonicalBuildFeatureFlags.canonicalBuildRuntimeAdapter &&
              nodeType !== SHAPE_NODE_TYPE
            ) {
              return toComlinkProxy(Comlink, () => {});
            }
            const unsubscribe = await buildRuntimeAdapters.subscribeSessions(
              nodeType,
              filter,
              callback
            );
            return toComlinkProxy(Comlink, unsubscribe);
          },
          deleteBuildSession: async (nodeType: NodeType, nodeId: NodeId): Promise<void> => {
            if (
              !canonicalBuildFeatureFlags.canonicalBuildRuntimeAdapter &&
              nodeType !== SHAPE_NODE_TYPE
            ) {
              return;
            }
            await buildRuntimeAdapters.deleteSession(nodeType, nodeId);
          },
          getMapImageCaptureIntent: async (intentId: string) =>
            sanitizeForComlink(
              await stagedFolderActionProgressStore.getMapImageCaptureIntent(intentId)
            ),
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
            const observable = liveQuery(() =>
              queryAPI.listBuildSessionRecordsByStatus(normalized)
            );
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
            await shapeBuildExtensions.setUiStorageBridge(bridge);
          },
          setCorsProxyBaseURL: async (url: string): Promise<void> => {
            applyCorsProxyBaseURL(url);
          },
        };

        reporter.reportStepProgress('Create API facade', 100);
        await recoverBuildSessionFromPersistedState();

        return { api: guardCanonicalWorkerApi(api, canonicalInspection.state), servicesReadyAt };
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
