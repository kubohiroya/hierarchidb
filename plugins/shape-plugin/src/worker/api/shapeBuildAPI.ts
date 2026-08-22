import type { NodeId } from '@hierarchidb/core-types';
import type { BuildContinuationPolicy, BuildTaskSummary, BuildTaskUpdateEvent, TaskProgressUpdatedEvent } from '@hierarchidb/build-api';
import type { ShapeBuildSessionRecord } from '@hierarchidb/shape-api';
import type {
  SessionStatusUpdatedEvent,
  StageSnapshotUpdatedEvent,
  HeartbeatEvent,
  WorkerLogEvent,
} from '~/common/types/session-events';
import {
  type BuildSession,
  type CountryMetadata,
  type DataSourceConfig,
  type DataSourceName,
  type SourceTaskPayload,
  type ProgressInfo,
  type ShapeBuildConfig,
  type ShapeProcessingConfig,
  type ShapeStepValidationResult,
  type SelectedArrayByCountries,
  SHAPE_DATA_SOURCES,
  isDataSourceName,
  requireDataSourceName,
  getPreferredCountryCodeFormat,
} from '~/common/types/index';
import { metadataLoader } from '~/services/metadata/MetadataLoader';
import { normalizeCountryCodeFormat } from '~/services/utils/iso3166';
import {
  generateDownloadTaskPayloads,
} from '~/services/utils/shapeBuildUtils';
import { resolveSourceStageStrategy } from '~/services/build/strategies/resolveSourceStageStrategy';
import { VtTaskQueueDb } from '@hierarchidb/vt-orchestrator';
import { shapeQueryAPIImpl } from '~/services/build/ShapeBuildAPIClient';
import { shapeBuildMonitoringAPI } from './shapeBuildMonitoringAPI.js';
import { shapeBuildRuntime } from './shapeBuildRuntime.js';
import * as shapeBuildRuntimeCore from './shapeBuildRuntimeCore.js';
import { unconditionalEventStreamer } from './eventBuffering.js';
import {
  emitSessionStatusUpdated,
  emitStageSnapshotUpdated,
  readStartedStageTiming,
} from './eventEmissionConstantsUtils.js';

export const shapeBuildAPI = {

  // ===================================
  // Data Source Operations
  // ===================================

  getDataSourceConfigs: async (): Promise<DataSourceConfig[]> => {
    return SHAPE_DATA_SOURCES;
  },

  getCountryMetadata: async (nodeId: NodeId, dataSource: DataSourceName): Promise<CountryMetadata[]> => {
    const data = await metadataLoader.loadMetadata(dataSource, nodeId);
    if (Array.isArray(data) && data.length > 0) return data;
    throw new Error(`No country metadata returned for data source: ${dataSource}`);
  },

  generateDownloadTaskPayloads: async (
    nodeId: NodeId,
    dataSource: DataSourceName,
    countries: string[],
    adminLevels: number[],
  ): Promise<SourceTaskPayload[]> => {
    const resolvedDataSource = requireDataSourceName(dataSource, 'generateDownloadTaskPayloads');
    // Get country metadata first
    const preferredFormat = getPreferredCountryCodeFormat(resolvedDataSource);
    const normalizedCountries = await Promise.all(
      countries.map((code) => normalizeCountryCodeFormat(code, preferredFormat)),
    );
    const countryMetadata = await shapeBuildAPI.getCountryMetadata(nodeId, resolvedDataSource);
    return generateDownloadTaskPayloads(resolvedDataSource, normalizedCountries, adminLevels, countryMetadata);
  },

  generateDownloadTaskPayloadsFromSelection: async (
    nodeId: NodeId,
    dataSource: DataSourceName,
    selectedArrayByCountries: SelectedArrayByCountries,
  ): Promise<SourceTaskPayload[]> => {
    const resolvedDataSource = requireDataSourceName(dataSource, 'generateDownloadTaskPayloadsFromSelection');
    const countryMetadata = await shapeBuildAPI.getCountryMetadata(nodeId, resolvedDataSource);
    const strategy = resolveSourceStageStrategy(resolvedDataSource);
    return strategy.buildSourceTaskPayloads({
      selectedArrayByCountries,
      countryMetadata,
    });
  },

  // ===================================
  // Selection Validation
  // ===================================

  validateSelection: async (
    countries: string[],
    adminLevels: number[],
    dataSource: DataSourceName,
  ): Promise<ShapeStepValidationResult> => {
    const errors: string[] = [];
    const warnings: string[] = [];
    if (!isDataSourceName(dataSource)) {
      errors.push('Invalid data source selected');
    }
    if (countries.length === 0) {
      errors.push('At least one country must be selected');
    }

    if (adminLevels.length === 0) {
      errors.push('At least one administrative level must be selected');
    }

    if (countries.length > 10) {
      warnings.push('Large country selection may require significant processing time');
    }

    return {
      isValid: errors.length === 0,
      errors: errors.length > 0 ? errors : undefined,
      warnings: warnings.length > 0 ? warnings : undefined,
    };
  },

  // ===================================
  // DraftTypes-based Build Processing
  // ===================================

  startBuildSession: async (
    draftId: NodeId,
    buildConfig: ShapeBuildConfig,
    processingConfig: ShapeProcessingConfig | undefined,
    downloadTaskPayloads: SourceTaskPayload[],
    buildContinuationPolicy?: BuildContinuationPolicy,
  ): Promise<NodeId> => shapeBuildRuntime.startBuildSessionInternal(
    'startBuildSession',
    draftId,
    buildConfig,
    processingConfig,
    downloadTaskPayloads,
    buildContinuationPolicy,
  ),
  pauseBuildSession: async (draftId: NodeId, reason?: string): Promise<void> => {
    await shapeBuildAPI.invokeBuildCommand('session/pause', {
      nodeId: draftId,
      stopReason: reason,
    });
  },
  cancelQueuedBuildSession: async (draftId: NodeId, reason?: string): Promise<void> => {
    await shapeBuildAPI.invokeBuildCommand('session/cancel-queued', {
      nodeId: draftId,
      stopReason: reason,
    });
  },

  invokeBuildCommand: async (command: string, payload: Record<string, unknown>): Promise<void> => {
    return shapeBuildRuntime.invokeShapeBuildCommand(command, payload);
  },

  getBuildSession: async (nodeId: NodeId): Promise<BuildSession | undefined> => (
    shapeBuildRuntimeCore.getBuildSessionInternal(nodeId)
  ),

  getBuildTasks: async (nodeId: NodeId): Promise<BuildTaskSummary[]> => {
    const taskQueue = new VtTaskQueueDb();
    await shapeBuildRuntimeCore.ensureTaskQueueSeeded(nodeId, taskQueue);
    const vtTasks = await shapeBuildRuntimeCore.listTasks(taskQueue, nodeId);
    if (vtTasks.length > 0) {
      return vtTasks.map((task) => shapeBuildRuntimeCore.mapTaskQueueRecordToTaskSummary(task));
    }
    return [];
  },

  getBuildProgress: async (draftId: NodeId): Promise<ProgressInfo> => {
    const handler = shapeBuildRuntimeCore.getShapeEntityHandler();
    const entity = await handler.getEntity(draftId);
    const nodeId = draftId;
    if (!entity || !nodeId) {
      return {
        total: 0,
        completed: 0,
        failed: 0,
        skipped: 0,
        percentage: 0,
      };
    }
    const taskQueue = new VtTaskQueueDb();
    await shapeBuildRuntimeCore.ensureTaskQueueSeeded(nodeId, taskQueue);
    const vtTasks = await shapeBuildRuntimeCore.listTasks(taskQueue, nodeId);
    if (vtTasks.length > 0) {
      const summary = await shapeBuildRuntimeCore.buildTaskQueueSummary(nodeId, vtTasks);
      return summary.progress;
    }
    return {
      total: 0,
      completed: 0,
      failed: 0,
      skipped: 0,
      percentage: 0,
    };
  },

  getBuildStatus: async (
    nodeId: NodeId,
  ): Promise<{
    nodeId: NodeId;
    status: string;
    progress?: number;
    completedTasks?: number;
    totalTasks?: number;
  }> => {
    const taskQueue = new VtTaskQueueDb();
    await shapeBuildRuntimeCore.ensureTaskQueueSeeded(nodeId, taskQueue);
    const vtTasks = await shapeBuildRuntimeCore.listTasks(taskQueue, nodeId);
    if (vtTasks.length > 0) {
      const summary = await shapeBuildRuntimeCore.buildTaskQueueSummary(nodeId, vtTasks);
      const paused = shapeBuildRuntimeCore.getPauseState(nodeId).paused;
      return {
        nodeId,
        status: paused ? 'paused' : summary.status,
        progress: summary.progress.percentage,
        completedTasks: summary.progress.completed,
        totalTasks: summary.progress.total,
      };
    }
    return {
      nodeId,
      status: 'idle',
    };
  },

  // ===================================
  // Build Session Recovery
  // ===================================

  findPendingBuildSessions: async (nodeId: NodeId): Promise<BuildSession[]> => {
    console.log(`Finding pending build sessions for node: ${nodeId}`);
    return [];
  },

  getBuildSessionStatus: async (
    nodeId: NodeId,
  ): Promise<{
    exists: boolean;
    canResume: boolean;
    lastActivity: number;
    expiresAt: number;
  }> => {
    const sessionRecord = await shapeQueryAPIImpl.getBuildSessionRecord(nodeId);
    if (sessionRecord) {
      const lastActivity = sessionRecord.lastActivity ?? sessionRecord.updatedAt;
      const expiresAt = sessionRecord.expiresAt ?? shapeBuildRuntime.resolveSessionExpiresAt(lastActivity);
      return {
        exists: true,
        canResume: Boolean(sessionRecord.canResume ?? sessionRecord.status === 'paused'),
        lastActivity,
        expiresAt,
      };
    }

    return {
      exists: false,
      canResume: false,
      lastActivity: 0,
      expiresAt: 0,
    };
  },

  // ===================================
  // Cleanup (mock/no-op placeholder)
  // ===================================

  performCleanup: async (): Promise<{
    workingCopiesRemoved: number;
    buildSessionsRemoved: number;
    totalSpaceRecovered: number;
    timestamp: number;
  }> => {
    console.log('Performing draft cleanup (mock)');
    return {
      workingCopiesRemoved: 0,
      buildSessionsRemoved: 0,
      totalSpaceRecovered: 0,
      timestamp: Date.now(),
    };
  },

  getCleanupStats: async (): Promise<{
    totalDrafts: number;
    expiredDrafts: number;
    totalBuildSessions: number;
    expiredBuildSessions: number;
    estimatedSpaceUsed: number;
    lastCleanupAt?: number;
  }> => {
    console.log('Getting cleanup statistics (mock)');
    return {
      totalDrafts: 0,
      expiredDrafts: 0,
      totalBuildSessions: 0,
      expiredBuildSessions: 0,
      estimatedSpaceUsed: 0,
      lastCleanupAt: Date.now(),
    };
  },

  subscribeTasks: (nodeId: NodeId, callback: (event: BuildTaskUpdateEvent) => void): (() => void) => {
    const key = String(nodeId);
    const existing = shapeBuildRuntimeCore.taskCallbacks.get(key);
    unconditionalEventStreamer.emitEvent(nodeId, 'worker-log', {
      nodeId,
      timestamp: Date.now(),
      level: 'log',
      message: '[subscribeTasks] start',
      data: { nodeId: String(nodeId), hadExisting: Boolean(existing) },
    });
    existing?.unsubscribe?.();
    const taskQueue = new VtTaskQueueDb();
    let snapshotInFlight = false;
    const sendSnapshot = async () => {
      if (snapshotInFlight) return;
      snapshotInFlight = true;
      unconditionalEventStreamer.emitEvent(nodeId, 'worker-log', {
        nodeId,
        timestamp: Date.now(),
        level: 'log',
        message: '[sendSnapshot] start',
        data: { nodeId: String(nodeId) },
      });
      try {
        await shapeBuildRuntimeCore.ensureTaskQueueSeeded(nodeId, taskQueue);
        const tasks = await shapeBuildRuntimeCore.buildTaskSummarySnapshot(nodeId, taskQueue);
        // Compute version from tasks; empty snapshot must carry explicit version=0
        // so the UI-side resolveSnapshotVersion contract is satisfied.
        const snapshotVersion = tasks.length > 0
          ? tasks.reduce((max, task) => Math.max(max, task.version), Number.MIN_SAFE_INTEGER)
          : 0;
        unconditionalEventStreamer.emitEvent(nodeId, 'worker-log', {
          nodeId,
          timestamp: Date.now(),
          level: 'log',
          message: '[sendSnapshot] published',
          data: { nodeId: String(nodeId), taskCount: tasks.length, snapshotVersion },
        });
        callback({ type: 'snapshot', nodeId, tasks, version: snapshotVersion } as BuildTaskUpdateEvent);
      } catch (error) {
        unconditionalEventStreamer.emitEvent(nodeId, 'worker-log', {
          nodeId,
          timestamp: Date.now(),
          level: 'error',
          message: '[sendSnapshot] failed',
          data: { nodeId: String(nodeId), error: String(error) },
        });
        console.error('[shapeBuildAPI] task snapshot failed', error);
      } finally {
        snapshotInFlight = false;
      }
    };
    void sendSnapshot();
    const unsubscribeTaskQueue = shapeBuildRuntimeCore.onTaskQueueUpdate(nodeId, (event) => {
      if (event.type !== 'update') {
        return;
      }
      void (async () => {
        try {
          const summary = shapeBuildRuntimeCore.mapTaskQueueRecordToTaskSummary(event.task);
          callback({ type: 'update', nodeId: event.nodeId, task: summary });
        } catch (error) {
          console.error('[shapeBuildAPI] task update failed', error);
        }
      })();
    });
    const unsubscribe = () => {
      unsubscribeTaskQueue();
      console.log('[shapeBuildAPI] task queue unsubscribe triggered', JSON.stringify({ nodeId }));
    };
    shapeBuildRuntimeCore.taskCallbacks.set(key, { unsubscribe, callback });

    return () => {
      const active = shapeBuildRuntimeCore.taskCallbacks.get(key);
      if (active?.unsubscribe === unsubscribe) {
        shapeBuildRuntimeCore.taskCallbacks.delete(key);
        console.log('[shapeBuildAPI] unsubscribeTasks removed active subscription', JSON.stringify({ nodeId }));
      }
      unsubscribe();
    };
  },

  // ===================================
  // Real-time Session State Subscription (4 channels)
  // ===================================

  subscribeSessionState: (nodeId: NodeId, callback: (event: SessionStatusUpdatedEvent) => void): (() => void) => {
    const key = String(nodeId);
    const existing = shapeBuildRuntimeCore.sessionStateCallbacks.get(key);
    existing?.unsubscribe?.();
    let subscriptionActive = true;

    // Subscribe to unconditional event stream
    const unsubscribeStream = unconditionalEventStreamer.subscribe(nodeId, 'session-state', (event) => {
      callback(event as SessionStatusUpdatedEvent);
    });

    const unsubscribe = () => {
      subscriptionActive = false;
      unsubscribeStream();
      shapeBuildRuntimeCore.sessionStateCallbacks.delete(key);
    };

    shapeBuildRuntimeCore.sessionStateCallbacks.set(key, { unsubscribe, callback });

    // Deliver the current session state immediately on subscription start.
    // This prevents event loss when startBuildSession emits sessionStatusUpdated
    // before subscribeAll completes (race condition on session start).
    // Per spec: "when the initial runtime snapshot is loaded on subscription start"
    void shapeQueryAPIImpl.getBuildSessionRecord(nodeId).then((record) => {
      if (!subscriptionActive) return;
      if (record) {
        emitSessionStatusUpdated(nodeId, record);
      }
    }).catch((error: unknown) => {
      if (!subscriptionActive) return;
      throw error;
    });

    return () => {
      const active = shapeBuildRuntimeCore.sessionStateCallbacks.get(key);
      if (active?.unsubscribe === unsubscribe) {
        shapeBuildRuntimeCore.sessionStateCallbacks.delete(key);
      }
      unsubscribe();
    };
  },

  subscribeStageSnapshots: (nodeId: NodeId, callback: (event: StageSnapshotUpdatedEvent) => void): (() => void) => {
    const key = String(nodeId);
    const existing = shapeBuildRuntimeCore.stageSnapshotCallbacks.get(key);
    existing?.unsubscribe?.();
    let subscriptionActive = true;

    // Subscribe to unconditional event stream
    const unsubscribeStream = unconditionalEventStreamer.subscribe(nodeId, 'stage-snapshot', (event) => {
      callback(event as StageSnapshotUpdatedEvent);
    });

    const unsubscribe = () => {
      subscriptionActive = false;
      unsubscribeStream();
      shapeBuildRuntimeCore.stageSnapshotCallbacks.delete(key);
    };

    shapeBuildRuntimeCore.stageSnapshotCallbacks.set(key, { unsubscribe, callback });

    // Deliver the current stage snapshot immediately on subscription start.
    // Per spec: "Initial snapshot on subscription start (only for stages that have started)"
    void shapeQueryAPIImpl.getBuildSessionRecord(nodeId).then(async (record) => {
      if (!subscriptionActive) return;
      if (!record) return;
      const timing = readStartedStageTiming(record);
      if (!timing) return;
      await emitStageSnapshotUpdated(
        nodeId,
        timing.stage,
        timing.stageStartedAt,
        timing.stageInactiveMs,
      );
    }).catch((error: unknown) => {
      if (!subscriptionActive) return;
      throw error;
    });

    return () => {
      const active = shapeBuildRuntimeCore.stageSnapshotCallbacks.get(key);
      if (active?.unsubscribe === unsubscribe) {
        shapeBuildRuntimeCore.stageSnapshotCallbacks.delete(key);
      }
      unsubscribe();
    };
  },

  subscribeHeartbeat: (nodeId: NodeId, callback: (event: HeartbeatEvent) => void): (() => void) => {
    const key = String(nodeId);
    const existing = shapeBuildRuntimeCore.heartbeatCallbacks.get(key);
    existing?.unsubscribe?.();

    // Subscribe to unconditional event stream
    const unsubscribeStream = unconditionalEventStreamer.subscribe(nodeId, 'heartbeat', (event) => {
      callback(event as HeartbeatEvent);
    });

    const unsubscribe = () => {
      unsubscribeStream();
      shapeBuildRuntimeCore.heartbeatCallbacks.delete(key);
    };

    shapeBuildRuntimeCore.heartbeatCallbacks.set(key, { unsubscribe, callback });

    return () => {
      const active = shapeBuildRuntimeCore.heartbeatCallbacks.get(key);
      if (active?.unsubscribe === unsubscribe) {
        shapeBuildRuntimeCore.heartbeatCallbacks.delete(key);
      }
      unsubscribe();
    };
  },

  subscribeTaskProgress: (nodeId: NodeId, callback: (event: TaskProgressUpdatedEvent) => void): (() => void) => {
    const key = String(nodeId);
    const existing = shapeBuildRuntimeCore.taskProgressCallbacks.get(key);
    existing?.unsubscribe?.();

    // Subscribe to unconditional event stream
    const unsubscribeStream = unconditionalEventStreamer.subscribe(nodeId, 'task-progress', (event) => {
      callback(event as TaskProgressUpdatedEvent);
    });

    const unsubscribe = () => {
      unsubscribeStream();
      shapeBuildRuntimeCore.taskProgressCallbacks.delete(key);
    };

    shapeBuildRuntimeCore.taskProgressCallbacks.set(key, { unsubscribe, callback });

    return () => {
      const active = shapeBuildRuntimeCore.taskProgressCallbacks.get(key);
      if (active?.unsubscribe === unsubscribe) {
        shapeBuildRuntimeCore.taskProgressCallbacks.delete(key);
      }
      unsubscribe();
    };
  },

  subscribeWorkerLog: (nodeId: NodeId, callback: (event: WorkerLogEvent) => void): (() => void) => {
    const key = String(nodeId);
    const existing = shapeBuildRuntimeCore.workerLogCallbacks.get(key);
    existing?.unsubscribe?.();

    // Subscribe to unconditional event stream
    const unsubscribeStream = unconditionalEventStreamer.subscribe(nodeId, 'worker-log', (event) => {
      callback(event as WorkerLogEvent);
    });

    const unsubscribe = () => {
      unsubscribeStream();
      shapeBuildRuntimeCore.workerLogCallbacks.delete(key);
    };

    shapeBuildRuntimeCore.workerLogCallbacks.set(key, { unsubscribe, callback });

    return () => {
      const active = shapeBuildRuntimeCore.workerLogCallbacks.get(key);
      if (active?.unsubscribe === unsubscribe) {
        shapeBuildRuntimeCore.workerLogCallbacks.delete(key);
      }
      unsubscribe();
    };
  },

  // ===================================
  // On-demand Session State Query
  // ===================================

  getSessionStateOnDemand: async (nodeId: NodeId): Promise<ShapeBuildSessionRecord | null> => {
    return shapeQueryAPIImpl.getBuildSessionRecord(nodeId);
  },

  forceCleanup: async (): Promise<{
    workingCopiesRemoved: number;
    buildSessionsRemoved: number;
    totalSpaceRecovered: number;
    timestamp: number;
  }> => {
    console.log('Force cleaning all transient data (mock)');
    return {
      workingCopiesRemoved: 0,
      buildSessionsRemoved: 0,
      totalSpaceRecovered: 0,
      timestamp: Date.now(),
    };
  },

  ...shapeBuildMonitoringAPI,
};
