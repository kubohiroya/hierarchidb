import { useEffect } from 'react';
import type { NodeId, NodeType } from '@hierarchidb/core-types';
import type { BuildProgressEvent, BuildTaskSummary, BuildTaskUpdateEvent } from '@hierarchidb/build-api';
import { getBuildWorkerBridge } from '@hierarchidb/ui-worker-client';
import { useSetAtom, useAtomValue } from 'jotai';
import { dispatchBuildSessionEventAtom, buildSessionSnapshotHandshakeReceivedAtom } from '~/ui/atoms/buildSessionStateAtoms';
import { createBuildSessionWorkerEventAdapter } from '~/ui/atoms/buildSessionWorkerEventAdapter';
import type { ShapeStageId } from '~/ui/atoms/buildSessionStateAtoms';
import { shapeBuildAPI } from '~/worker/api/shapeBuildAPI';
import { unconditionalEventStreamer } from '~/worker/api/eventBuffering';
import type { WorkerLogEvent, CriticalErrorEvent } from '~/common/types/session-events';

const SHAPE_NODE_TYPE = 'shape' as NodeType;
const SHAPE_STAGE_IDS = ['source', 'geometry', 'tileEmit'] as const satisfies readonly ShapeStageId[];

type UiSyncPhase = 'ui-initializing' | 'running';
type TaskUpdateEvent = Extract<BuildTaskUpdateEvent, { type: 'update' }>;
type TaskSnapshotEvent = Extract<BuildTaskUpdateEvent, { type: 'snapshot' }> & {
  version?: unknown;
  stage?: unknown;
};

export const isTaskUpdateVersionAfterSnapshot = (
  snapshotVersionMax: number,
  taskVersion: number,
): boolean => taskVersion > snapshotVersionMax;

export const resolveTaskVersionAction = (
  lastAppliedVersion: number | undefined,
  nextVersion: number,
): 'accept' | 'drop' | 'error' => {
  if (typeof lastAppliedVersion !== 'number') return 'accept';
  if (nextVersion > lastAppliedVersion) return 'accept';
  if (nextVersion === lastAppliedVersion) return 'drop';
  return 'error';
};

export const resolveTaskIdentityAction = (
  isKnownTaskId: boolean,
  snapshotVersionMax: number,
  taskVersion: number,
): 'accept-known' | 'accept-new' | 'drop-known-stale' | 'error-unknown-stale' => {
  if (isTaskUpdateVersionAfterSnapshot(snapshotVersionMax, taskVersion)) {
    return isKnownTaskId ? 'accept-known' : 'accept-new';
  }
  if (isKnownTaskId) return 'drop-known-stale';
  return 'error-unknown-stale';
};

const resolveShapeStageId = (value: unknown): ShapeStageId | undefined => {
  if (value === 'source' || value === 'geometry' || value === 'tileEmit') {
    return value;
  }
  return undefined;
};

const resolveUiSyncSignalFromSessionStageId = (
  value: unknown,
): { stageId: ShapeStageId; phase: UiSyncPhase } | undefined => {
  if (value === 'source' || value === 'geometry' || value === 'tileEmit') {
    return { stageId: value, phase: 'running' };
  }
  if (value === 'source-stage') return { stageId: 'source', phase: 'running' };
  if (value === 'geometry-stage') return { stageId: 'geometry', phase: 'running' };
  if (value === 'tile-emit-stage') return { stageId: 'tileEmit', phase: 'running' };
  if (typeof value !== 'string') return undefined;
  if (!value.startsWith('ui-sync:')) return undefined;
  const [, rawStage, rawPhase] = value.split(':');
  const stageId = resolveShapeStageId(rawStage);
  if (!stageId) return undefined;
  if (rawPhase === 'ui-initializing' || rawPhase === 'running') {
    return { stageId, phase: rawPhase };
  }
  return undefined;
};

const resolveSnapshotVersion = (event: TaskSnapshotEvent): number => {
  if (event.type !== 'snapshot') {
    throw new Error('[shape buildSessionStateAtomBridge] resolveSnapshotVersion requires snapshot event');
  }
  if (event.tasks.length > 0) {
    return event.tasks.reduce((max, task) => Math.max(max, task.version), Number.MIN_SAFE_INTEGER);
  }
  const explicitVersion = event.version;
  if (typeof explicitVersion !== 'number' || !Number.isFinite(explicitVersion) || explicitVersion < 0) {
    throw new Error('[shape buildSessionStateAtomBridge] empty snapshot requires finite snapshot version');
  }
  return Math.floor(explicitVersion);
};

export const resolveSnapshotTargetStages = (event: TaskSnapshotEvent): ShapeStageId[] => {
  const snapshotStages = new Set<ShapeStageId>();
  for (const task of event.tasks) {
    const stageId = resolveShapeStageId(task.stage);
    if (stageId) snapshotStages.add(stageId);
  }
  const stageFromEvent = resolveShapeStageId(event.stage);
  if (snapshotStages.size === 0 && stageFromEvent) {
    snapshotStages.add(stageFromEvent);
  }
  if (snapshotStages.size === 0) {
    for (const stageId of SHAPE_STAGE_IDS) {
      snapshotStages.add(stageId);
    }
  }
  return Array.from(snapshotStages);
};

export const useShapeBuildSessionStateAtomBridge = (nodeId: NodeId | undefined): void => {
  const dispatch = useSetAtom(dispatchBuildSessionEventAtom);
  const buildSessionSnapshotHandshakeReceived = useAtomValue(buildSessionSnapshotHandshakeReceivedAtom);

  useEffect(() => {
    if (!nodeId) {
      dispatch({ type: 'reset' });
      return;
    }

    const nodeIdText = String(nodeId);
    const bridge = getBuildWorkerBridge();
    const adapter = createBuildSessionWorkerEventAdapter(nodeIdText, (event) => {
      dispatch(event);
    });
    let cancelled = false;
    const unsubscribers: Array<() => void> = [];
    const uiSyncByStage: Record<ShapeStageId, UiSyncPhase> = {
      source: 'ui-initializing',
      geometry: 'ui-initializing',
      tileEmit: 'ui-initializing',
    };
    const progressBufferByStage: Record<ShapeStageId, BuildProgressEvent[]> = {
      source: [],
      geometry: [],
      tileEmit: [],
    };
    const taskUpdateBufferByStage: Record<ShapeStageId, TaskUpdateEvent[]> = {
      source: [],
      geometry: [],
      tileEmit: [],
    };
    const snapshotTaskIdsByStage: Record<ShapeStageId, Set<string>> = {
      source: new Set<string>(),
      geometry: new Set<string>(),
      tileEmit: new Set<string>(),
    };
    const snapshotVersionMaxByStage: Record<ShapeStageId, number | null> = {
      source: null,
      geometry: null,
      tileEmit: null,
    };
    const lastAppliedVersionByTaskId = new Map<string, number>();
    const lastAppliedFingerprintByTaskVersion = new Map<string, string>();
    let fatalContractError = false;
    let activeStageId: ShapeStageId = 'source';
    let flushTimerId: number | null = null;

    const buildTaskFingerprint = (event: TaskUpdateEvent): string => JSON.stringify({
      taskId: event.task.taskId,
      version: event.task.version,
      stage: event.task.stage,
      status: event.task.status,
      progress: event.task.progress,
      sequence: event.task.sequence,
      display: event.task.display,
      metadata: event.task.metadata,
    });

    const stopWithContractError = (message: string): never => {
      fatalContractError = true;
      for (const unsubscribe of unsubscribers) {
        try {
          unsubscribe();
        } catch {
          // no-op
        }
      }
      throw new Error(message);
    };

    const resolveStageOrStop = (value: unknown, message: string): ShapeStageId => {
      const stageId = resolveShapeStageId(value);
      if (!stageId) {
        stopWithContractError(message);
      }
      return stageId as ShapeStageId;
    };

    const dispatchUiSyncPhase = (stageId: ShapeStageId, phase: UiSyncPhase): void => {
      if (uiSyncByStage[stageId] === phase) return;
      uiSyncByStage[stageId] = phase;
      dispatch({
        type: 'uiSyncPhaseChanged',
        payload: {
          stageId,
          phase,
        },
      });
    };

    const flushProgressBuffer = (): void => {
      flushTimerId = null;
      const startTime = performance.now();
      let processedEvents = 0;
      const MAX_PROCESSING_TIME = 8; // 8ms limit to prevent blocking
      
      for (const stageId of SHAPE_STAGE_IDS) {
        if (performance.now() - startTime > MAX_PROCESSING_TIME) {
          // Reschedule if taking too long
          scheduleProgressFlush();
          return;
        }
        
        if (uiSyncByStage[stageId] !== 'running') continue;
        const bufferedUpdates = taskUpdateBufferByStage[stageId];
        if (bufferedUpdates.length <= 0) continue;
        
        // Process in smaller batches to prevent blocking
        const batchSize = Math.min(50, bufferedUpdates.length);
        const batch = bufferedUpdates.splice(0, batchSize);
        
        batch.sort((left, right) => left.task.version - right.task.version);
        for (const event of batch) {
          const stage = resolveStageOrStop(
            event.task.stage,
            `[shape buildSessionStateAtomBridge] task update stage is unsupported: ${String(event.task.stage)}`,
          );
          const snapshotVersionMax = snapshotVersionMaxByStage[stage];
          if (snapshotVersionMax == null) {
            stopWithContractError(
              `[shape buildSessionStateAtomBridge] task update arrived before snapshot handshake: ${event.task.taskId}`,
            );
          }
          const snapshotVersionBoundary = snapshotVersionMax as number;
          const knownTaskIds = snapshotTaskIdsByStage[stage];
          const taskIdentityAction = resolveTaskIdentityAction(
            knownTaskIds.has(event.task.taskId),
            snapshotVersionBoundary,
            event.task.version,
          );
          if (taskIdentityAction === 'error-unknown-stale') {
            stopWithContractError(
              `[shape buildSessionStateAtomBridge] task update references unknown taskId at-or-before snapshot boundary: ${event.task.taskId} (taskVersion=${event.task.version}, snapshotVersionMax=${snapshotVersionBoundary})`,
            );
          }
          if (taskIdentityAction === 'drop-known-stale') {
            continue;
          }
          if (taskIdentityAction === 'accept-new') {
            knownTaskIds.add(event.task.taskId);
          }
          const lastAppliedVersion = lastAppliedVersionByTaskId.get(event.task.taskId);
          const versionAction = resolveTaskVersionAction(lastAppliedVersion, event.task.version);
          if (versionAction === 'error') {
            stopWithContractError(
              `[shape buildSessionStateAtomBridge] task version regressed: taskId=${event.task.taskId} next=${event.task.version} current=${lastAppliedVersion}`,
            );
          }
          if (versionAction === 'drop') {
            const key = `${event.task.taskId}:${event.task.version}`;
            const nextFingerprint = buildTaskFingerprint(event);
            const previousFingerprint = lastAppliedFingerprintByTaskVersion.get(key);
            if (typeof previousFingerprint === 'string' && previousFingerprint !== nextFingerprint) {
              stopWithContractError(
                `[shape buildSessionStateAtomBridge] conflicting payload for identical taskId/version: ${key}`,
              );
            }
            continue;
          }
          adapter.onTaskEvent(event);
          lastAppliedVersionByTaskId.set(event.task.taskId, event.task.version);
          lastAppliedFingerprintByTaskVersion.set(
            `${event.task.taskId}:${event.task.version}`,
            buildTaskFingerprint(event),
          );
          processedEvents++;
        }
        
        // If there are still buffered updates, reschedule
        if (taskUpdateBufferByStage[stageId].length > 0) {
          scheduleProgressFlush();
        }
      }

      for (const stageId of SHAPE_STAGE_IDS) {
        if (uiSyncByStage[stageId] !== 'running') continue;
        const queue = progressBufferByStage[stageId];
        if (queue.length <= 0) continue;
        
        // Process progress events in batches too
        const batchSize = Math.min(20, queue.length);
        const batch = queue.splice(0, batchSize);
        
        for (const progressEvent of batch) {
          adapter.onProgressEvent(progressEvent);
          processedEvents++;
        }
        
        // If there are still progress events, reschedule
        if (progressBufferByStage[stageId].length > 0) {
          scheduleProgressFlush();
        }
      }
      
      const processingTime = performance.now() - startTime;
      if (processingTime > 5) {
        console.debug(`[BuildSessionBridge] Processed ${processedEvents} events in ${processingTime.toFixed(1)}ms`);
      }
    };

    const scheduleProgressFlush = (): void => {
      if (fatalContractError) return;
      if (flushTimerId !== null) return;
      
      // Use requestIdleCallback for better performance if available
      if (typeof window !== 'undefined' && typeof (window as any).requestIdleCallback === 'function') {
        flushTimerId = (window as any).requestIdleCallback(flushProgressBuffer, { timeout: 16 });
        return;
      }
      
      if (typeof window !== 'undefined' && typeof window.requestAnimationFrame === 'function') {
        flushTimerId = window.requestAnimationFrame(flushProgressBuffer);
        return;
      }
      flushTimerId = window.setTimeout(flushProgressBuffer, 0);
    };

    const onTaskEvent = (event: BuildTaskUpdateEvent): void => {
      if (fatalContractError) return;
      if (event.type === 'update') {
        const stageId = resolveStageOrStop(
          event.task.stage,
          `[shape buildSessionStateAtomBridge] task update stage is unsupported: ${String(event.task.stage)}`,
        );
        const snapshotVersionMax = snapshotVersionMaxByStage[stageId];
        if (snapshotVersionMax == null) {
          if (!buildSessionSnapshotHandshakeReceived) {
            // Drop task updates before initial snapshot handshake
            return;
          }
          stopWithContractError(
            `[shape buildSessionStateAtomBridge] task update arrived before snapshot handshake: ${event.task.taskId}`,
          );
        }
        const snapshotVersionBoundary = snapshotVersionMax as number;
        if (!isTaskUpdateVersionAfterSnapshot(snapshotVersionBoundary, event.task.version)) {
          return;
        }
        taskUpdateBufferByStage[stageId].push(event);
        scheduleProgressFlush();
        return;
      }
      if (event.type !== 'snapshot') {
        adapter.onTaskEvent(event);
        return;
      }
      const snapshotEvent = event as TaskSnapshotEvent;
      const snapshotVersion = resolveSnapshotVersion(snapshotEvent);
      const snapshotStages = new Set<ShapeStageId>(resolveSnapshotTargetStages(snapshotEvent));
      for (const stageId of snapshotStages) {
        snapshotVersionMaxByStage[stageId] = snapshotVersion;
        snapshotTaskIdsByStage[stageId].clear();
      }
      for (const task of snapshotEvent.tasks) {
        const stageId = resolveStageOrStop(
          task.stage,
          `[shape buildSessionStateAtomBridge] task snapshot stage is unsupported: ${String(task.stage)}`,
        );
        snapshotTaskIdsByStage[stageId].add(task.taskId);
        lastAppliedVersionByTaskId.set(task.taskId, task.version);
        lastAppliedFingerprintByTaskVersion.set(
          `${task.taskId}:${task.version}`,
          JSON.stringify({
            taskId: task.taskId,
            version: task.version,
            stage: task.stage,
            status: task.status,
            progress: task.progress,
            sequence: task.sequence,
            display: task.display,
            metadata: task.metadata,
          }),
        );
      }
      adapter.onTaskEvent({
        ...snapshotEvent,
        version: snapshotVersion,
      } as BuildTaskUpdateEvent);
      for (const stageId of SHAPE_STAGE_IDS) {
        if (snapshotStages.size > 0 && !snapshotStages.has(stageId)) continue;
        dispatchUiSyncPhase(stageId, 'running');
      }
      scheduleProgressFlush();
    };

    const onProgressEvent = (event: BuildProgressEvent): void => {
      const stageId = resolveShapeStageId(event.stage);
      if (!stageId) {
        adapter.onProgressEvent(event);
        return;
      }
      if (activeStageId !== stageId) {
        activeStageId = stageId;
        dispatchUiSyncPhase(stageId, 'ui-initializing');
      }
      progressBufferByStage[stageId].push(event);
      if (uiSyncByStage[stageId] !== 'running') return;
      scheduleProgressFlush();
    };

    const onSessionState = (event: { nodeId: string; sessionRecord?: Record<string, unknown> | null }): void => {
      adapter.onSessionState(event);
      const signal = resolveUiSyncSignalFromSessionStageId(event.sessionRecord?.stageId);
      if (!signal) {
        return;
      }
      const stageId = signal.stageId;
      if (activeStageId !== stageId) {
        activeStageId = stageId;
      }
      dispatchUiSyncPhase(stageId, signal.phase);
      if (signal.phase === 'running') {
        scheduleProgressFlush();
      }
    };

    const run = async () => {
      await bridge.initialize();
      if (cancelled) return;

      const toSnapshotEvent = (tasks: BuildTaskSummary[]): TaskSnapshotEvent => ({
        type: 'snapshot',
        nodeId,
        tasks,
        version: tasks.length > 0
          ? tasks.reduce((max, task) => Math.max(max, task.version), Number.MIN_SAFE_INTEGER)
          : 0,
      } as TaskSnapshotEvent);

      const runtime = await bridge.getBuildSessionRuntime(SHAPE_NODE_TYPE, nodeId);
      if (cancelled) return;
      if (runtime) {
        adapter.onRuntimeRecord(runtime);
      }

      const [unsubscribeTasks, unsubscribeProgress, unsubscribeSessionState, unsubscribeHeartbeat] = await Promise.all([
        bridge.subscribeBuildTasks(SHAPE_NODE_TYPE, nodeId, (event) => {
          onTaskEvent(event);
        }),
        bridge.subscribeBuildProgress(SHAPE_NODE_TYPE, nodeId, (event) => {
          onProgressEvent(event);
        }),
        bridge.subscribeSessionState(SHAPE_NODE_TYPE, nodeId, (event) => {
          onSessionState(event as { nodeId: string; sessionRecord?: Record<string, unknown> | null });
        }),
        bridge.subscribeSessionHeartbeat(SHAPE_NODE_TYPE, nodeId, (event) => {
          adapter.onHeartbeat(event as { nodeId: string; heartbeatAt?: number });
        }),
      ]);

      // Subscribe to Worker logs via ShapeBuildAPI directly
      const unsubscribeWorkerLog = shapeBuildAPI.subscribeToWorkerLog(nodeId, (event: WorkerLogEvent) => {
        const logLevel = event.level.toUpperCase();
        const logMessage = `[WorkerLog][${logLevel}] ${event.message}`;
        const logData = event.data || '';
        
        // Always log to console
        console.log(logMessage, logData);
        
        // For critical errors with contract violations, ensure visibility
        if (event.level === 'error' && event.data?.contractViolation) {
          console.error('🚨 CRITICAL CONTRACT VIOLATION DETECTED 🚨');
          console.error('Error Details:', {
            message: event.message,
            data: event.data,
            timestamp: event.timestamp,
            nodeId: event.nodeId,
          });
          
          // Emit to build session event system for UI visibility
          dispatch({
            type: 'criticalError',
            payload: {
              message: event.message,
              error: typeof event.data?.error === 'string' ? event.data.error : 'Unknown error',
              errorName: typeof event.data?.errorName === 'string' ? event.data.errorName : 'Unknown',
              timestamp: event.timestamp,
              severity: 'critical',
              contractViolation: true,
            },
          });
        }
      });

      // Subscribe to Critical Error events directly via unconditionalEventStreamer
      const unsubscribeCriticalError = unconditionalEventStreamer.subscribe(nodeId, 'critical-error', (event) => {
        const { payload } = event as { payload: CriticalErrorEvent };
        console.error('🚨 CRITICAL ERROR EVENT RECEIVED 🚨');
        console.error('Critical Error Details:', payload);
        
        // Emit to build session event system for UI visibility
        dispatch({
          type: 'criticalError',
          payload: {
            message: payload.message,
            error: payload.error,
            errorName: payload.errorName,
            timestamp: payload.timestamp,
            severity: payload.severity,
            contractViolation: payload.contractViolation,
          },
        });
      });

      if (cancelled) {
        unsubscribeTasks();
        unsubscribeProgress();
        unsubscribeSessionState();
        unsubscribeHeartbeat();
        unsubscribeWorkerLog();
        unsubscribeCriticalError();
        return;
      }
      adapter.onTaskStreamConnectionChanged(true);
      const tasks = await bridge.getBuildTasks(SHAPE_NODE_TYPE, nodeId);
      if (cancelled) {
        unsubscribeTasks();
        unsubscribeProgress();
        unsubscribeSessionState();
        unsubscribeHeartbeat();
        unsubscribeWorkerLog();
        unsubscribeCriticalError();
        return;
      }
      onTaskEvent(toSnapshotEvent(tasks));

      unsubscribers.push(unsubscribeTasks, unsubscribeProgress, unsubscribeSessionState, unsubscribeHeartbeat, unsubscribeWorkerLog, unsubscribeCriticalError);
    };

    void run().catch((error) => {
      if (cancelled) return;
      console.warn('[shape buildSessionStateAtomBridge] failed to start subscriptions', error);
    });

    return () => {
      cancelled = true;
      if (flushTimerId !== null) {
        if (typeof window !== 'undefined' && typeof window.cancelAnimationFrame === 'function') {
          window.cancelAnimationFrame(flushTimerId);
        } else {
          window.clearTimeout(flushTimerId);
        }
        flushTimerId = null;
      }
      adapter.onTaskStreamConnectionChanged(false);
      for (const unsubscribe of unsubscribers) {
        unsubscribe();
      }
    };
  }, [dispatch, nodeId, buildSessionSnapshotHandshakeReceived]);
};
