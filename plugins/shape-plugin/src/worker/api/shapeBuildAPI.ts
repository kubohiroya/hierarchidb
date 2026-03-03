import type { NodeId } from '@hierarchidb/core-types';
import type { BuildContinuationPolicy, BuildTaskSummary, BuildTaskUpdateEvent, BuildProgressEvent } from '@hierarchidb/build-api';
import type { ShapeBuildSessionRecord } from '@hierarchidb/shape-api';
import type {
  SessionStateChangeEvent,
  StageSnapshotEvent,
  SessionHeartbeatEvent,
  TaskProgressEvent,
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
import { Dexie } from 'dexie';
import { metadataLoader } from '~/services/metadata/MetadataLoader';
import { normalizeCountryCodeFormat } from '~/services/utils/iso3166';
import {
  generateDownloadTaskPayloads,
} from '~/services/utils/utils';
import { resolveSourceStageStrategy } from '~/services/build/strategies/resolveSourceStageStrategy';
import { VtTaskQueueDb } from '@hierarchidb/vt-orchestrator';
import { shapeQueryAPIImpl } from '~/services/build/ShapeBuildAPIClient';
import { shapeBuildMonitoringAPI } from './shapeBuildMonitoringAPI.js';
import { shapeBuildRuntime } from './shapeBuildRuntime.js';

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
    progressCallback?: (event: BuildProgressEvent) => void,
  ): Promise<NodeId> => shapeBuildRuntime.startBuildSessionInternal(
    'startBuildSession',
    draftId,
    buildConfig,
    processingConfig,
    downloadTaskPayloads,
    buildContinuationPolicy,
    progressCallback,
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
    shapeBuildRuntime.getBuildSessionInternal(nodeId)
  ),

  getBuildTasks: async (nodeId: NodeId): Promise<BuildTaskSummary[]> => {
    const taskQueue = new VtTaskQueueDb();
    await shapeBuildRuntime.ensureTaskQueueSeeded(nodeId, taskQueue);
    const vtTasks = await shapeBuildRuntime.listTasks(taskQueue, nodeId);
    if (vtTasks.length > 0) {
      return vtTasks.map((task) => shapeBuildRuntime.mapTaskQueueRecordToTaskSummary(task));
    }
    return [];
  },

  getBuildProgress: async (draftId: NodeId): Promise<ProgressInfo> => {
    const handler = shapeBuildRuntime.getShapeEntityHandler();
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
    await shapeBuildRuntime.ensureTaskQueueSeeded(nodeId, taskQueue);
    const vtTasks = await shapeBuildRuntime.listTasks(taskQueue, nodeId);
    if (vtTasks.length > 0) {
      const summary = await shapeBuildRuntime.buildTaskQueueSummary(nodeId, vtTasks);
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
    await shapeBuildRuntime.ensureTaskQueueSeeded(nodeId, taskQueue);
    const vtTasks = await shapeBuildRuntime.listTasks(taskQueue, nodeId);
    if (vtTasks.length > 0) {
      const summary = await shapeBuildRuntime.buildTaskQueueSummary(nodeId, vtTasks);
      const paused = shapeBuildRuntime.getPauseState(nodeId).paused;
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
    const sessionRecord = await shapeQueryAPIImpl.getBuildSessionRecord(nodeId).catch(() => null);
    if (sessionRecord) {
      const fallbackLastActivity = sessionRecord.updatedAt ?? Date.now();
      const lastActivity = sessionRecord.lastActivity ?? fallbackLastActivity;
      const expiresAt = sessionRecord.expiresAt ?? shapeBuildRuntime.resolveSessionExpiresAt(lastActivity);
      return {
        exists: true,
        canResume: Boolean(sessionRecord.canResume ?? sessionRecord.status === 'paused'),
        lastActivity,
        expiresAt,
      };
    }

    const taskQueue = new VtTaskQueueDb();
    const counts = await shapeBuildRuntime.countTaskQueueStatuses(taskQueue, nodeId);
    if (counts.total > 0) {
      const now = Date.now();
      const firstTask = await taskQueue.tasks
        .where('[nodeId+index]')
        .between([nodeId, Dexie.minKey], [nodeId, Dexie.maxKey])
        .first();
      const lastActivity = typeof firstTask?.updatedAt === 'number' ? firstTask.updatedAt : now;
      return {
        exists: true,
        canResume: shapeBuildRuntime.getPauseState(nodeId).paused,
        lastActivity,
        expiresAt: shapeBuildRuntime.resolveSessionExpiresAt(lastActivity),
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

  // ===================================
  // Real-time Progress Subscription
  // ===================================

  subscribeToProgress: (nodeId: NodeId, callback: (event: BuildProgressEvent) => void): (() => void) => {
    const existing = shapeBuildRuntime.progressCallbacks.get(String(nodeId));
    existing?.unsubscribe?.();
    const taskQueue = new VtTaskQueueDb();
    const unsubscribeTaskQueue = shapeBuildRuntime.onTaskQueueUpdate(nodeId, (event) => {
      if (event.type === 'delete') {
        return;
      }
      void (async () => {
        try {
          const vtTasks = await shapeBuildRuntime.listTasks(taskQueue, event.nodeId);
          callback({
            nodeId: event.nodeId,
            stage: event.task.stage,
            phase: shapeBuildRuntime.resolveProgressPhase(event.nodeId, vtTasks),
            timestamp: Date.now(),
            message: event.task.errorMessage,
            payload: await shapeBuildRuntime.buildProgressPayloadFromTasks(nodeId, vtTasks, {
              eventTask: event.task,
              source: 'event',
            }),
          });
        } catch (error) {
          console.error('[shapeBuildAPI] progress payload build failed', error);
        }
      })();
    });
    const unsubscribe = () => {
      unsubscribeTaskQueue();
    };
    shapeBuildRuntime.progressCallbacks.set(String(nodeId), { unsubscribe, callback });

    return () => {
      const active = shapeBuildRuntime.progressCallbacks.get(String(nodeId));
      active?.unsubscribe?.();
      shapeBuildRuntime.progressCallbacks.delete(String(nodeId));
    };
  },

  subscribeToTasks: (nodeId: NodeId, callback: (event: BuildTaskUpdateEvent) => void): (() => void) => {
    const key = String(nodeId);
    const existing = shapeBuildRuntime.taskCallbacks.get(key);
    console.log('[shapeBuildAPI] subscribeToTasks start', JSON.stringify({
      nodeId,
      hadExisting: Boolean(existing),
      hasExistingUnsub: typeof existing?.unsubscribe === 'function',
    }));
    existing?.unsubscribe?.();
    const taskQueue = new VtTaskQueueDb();
    let snapshotInFlight = false;
    const sendSnapshot = async () => {
      if (snapshotInFlight) return;
      snapshotInFlight = true;
      try {
        await shapeBuildRuntime.ensureTaskQueueSeeded(nodeId, taskQueue);
        const tasks = await shapeBuildRuntime.buildTaskSummarySnapshot(nodeId, taskQueue);
        console.log('[shapeBuildAPI] task snapshot published', JSON.stringify({
          nodeId,
          taskCount: tasks.length,
          snapshotInFlight,
        }));
        callback({ type: 'snapshot', nodeId, tasks });
      } catch (error) {
        console.error('[shapeBuildAPI] task snapshot failed', error);
      } finally {
        snapshotInFlight = false;
      }
    };
    void sendSnapshot();
    const unsubscribeTaskQueue = shapeBuildRuntime.onTaskQueueUpdate(nodeId, (event) => {
      if (event.type !== 'update') {
        return;
      }
      void (async () => {
        try {
          const summary = shapeBuildRuntime.mapTaskQueueRecordToTaskSummary(event.task);
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
    shapeBuildRuntime.taskCallbacks.set(key, { unsubscribe, callback });

    return () => {
      const active = shapeBuildRuntime.taskCallbacks.get(key);
      if (active?.unsubscribe === unsubscribe) {
        shapeBuildRuntime.taskCallbacks.delete(key);
        console.log('[shapeBuildAPI] unsubscribeToTasks removed active subscription', JSON.stringify({ nodeId }));
      }
      unsubscribe();
    };
  },

  // ===================================
  // Real-time Session State Subscription (4 channels)
  // ===================================

  subscribeToSessionState: (nodeId: NodeId, callback: (event: SessionStateChangeEvent) => void): (() => void) => {
    const key = String(nodeId);
    const existing = shapeBuildRuntime.sessionStateCallbacks.get(key);
    existing?.unsubscribe?.();

    const unsubscribe = () => {
      shapeBuildRuntime.sessionStateCallbacks.delete(key);
    };

    shapeBuildRuntime.sessionStateCallbacks.set(key, { unsubscribe, callback });

    return () => {
      const active = shapeBuildRuntime.sessionStateCallbacks.get(key);
      if (active?.unsubscribe === unsubscribe) {
        shapeBuildRuntime.sessionStateCallbacks.delete(key);
      }
      unsubscribe();
    };
  },

  subscribeToStageSnapshots: (nodeId: NodeId, callback: (event: StageSnapshotEvent) => void): (() => void) => {
    const key = String(nodeId);
    const existing = shapeBuildRuntime.stageSnapshotCallbacks.get(key);
    existing?.unsubscribe?.();

    const unsubscribe = () => {
      shapeBuildRuntime.stageSnapshotCallbacks.delete(key);
    };

    shapeBuildRuntime.stageSnapshotCallbacks.set(key, { unsubscribe, callback });

    return () => {
      const active = shapeBuildRuntime.stageSnapshotCallbacks.get(key);
      if (active?.unsubscribe === unsubscribe) {
        shapeBuildRuntime.stageSnapshotCallbacks.delete(key);
      }
      unsubscribe();
    };
  },

  subscribeToHeartbeat: (nodeId: NodeId, callback: (event: SessionHeartbeatEvent) => void): (() => void) => {
    const key = String(nodeId);
    const existing = shapeBuildRuntime.heartbeatCallbacks.get(key);
    existing?.unsubscribe?.();

    const unsubscribe = () => {
      shapeBuildRuntime.heartbeatCallbacks.delete(key);
    };

    shapeBuildRuntime.heartbeatCallbacks.set(key, { unsubscribe, callback });

    return () => {
      const active = shapeBuildRuntime.heartbeatCallbacks.get(key);
      if (active?.unsubscribe === unsubscribe) {
        shapeBuildRuntime.heartbeatCallbacks.delete(key);
      }
      unsubscribe();
    };
  },

  subscribeToTaskProgress: (nodeId: NodeId, callback: (event: TaskProgressEvent) => void): (() => void) => {
    const key = String(nodeId);
    const existing = shapeBuildRuntime.taskProgressCallbacks.get(key);
    existing?.unsubscribe?.();

    const unsubscribe = () => {
      shapeBuildRuntime.taskProgressCallbacks.delete(key);
    };

    shapeBuildRuntime.taskProgressCallbacks.set(key, { unsubscribe, callback });

    return () => {
      const active = shapeBuildRuntime.taskProgressCallbacks.get(key);
      if (active?.unsubscribe === unsubscribe) {
        shapeBuildRuntime.taskProgressCallbacks.delete(key);
      }
      unsubscribe();
    };
  },

  // ===================================
  // On-demand Session State Query
  // ===================================

  getSessionStateOnDemand: async (nodeId: NodeId): Promise<ShapeBuildSessionRecord | null> => {
    return shapeQueryAPIImpl.getBuildSessionRecord(nodeId).catch(() => null);
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
