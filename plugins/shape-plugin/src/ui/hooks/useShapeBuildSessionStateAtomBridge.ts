import type {
  BuildStatus,
  BuildTaskSummary,
  TaskProgressUpdatedEvent,
  TaskStage,
} from '@hierarchidb/build-api';
import type { NodeId, NodeType } from '@hierarchidb/core-types';
import type { AdapterStageSnapshotUpdatedEvent } from '@hierarchidb/ui-build-sessions';
import { getBuildWorkerBridge } from '@hierarchidb/ui-worker-client';
import { useAtomValue, useSetAtom } from 'jotai';
import { useEffect } from 'react';
import type {
  HeartbeatEvent,
  SessionStatusUpdatedEvent,
  StageSnapshotUpdatedEvent,
} from '~/common/types/session-events';
import type { ShapeStageId } from '~/ui/atoms/buildSessionStateAtoms';
import {
  buildSessionRecoveryRevisionAtom,
  dispatchBuildSessionEventAtom,
} from '~/ui/atoms/buildSessionStateAtoms';
import { createBuildSessionWorkerEventAdapter } from '~/ui/atoms/buildSessionWorkerEventAdapterConstants';
import {
  type BufferedEvent,
  UIEventBufferManager,
} from '~/ui/components/build-progress/eventBufferingUI';

const SHAPE_NODE_TYPE = 'shape' as NodeType;
const SHAPE_STAGE_IDS = [
  'source',
  'geometry',
  'tileEmit',
] as const satisfies readonly ShapeStageId[];

type UiSyncPhase = 'ui-initializing' | 'running';

const resolveShapeStageId = (value: unknown): ShapeStageId | undefined => {
  if (value === 'source' || value === 'geometry' || value === 'tileEmit') {
    return value;
  }
  return undefined;
};

export const resolveSnapshotTargetStages = (event: StageSnapshotUpdatedEvent): ShapeStageId[] => {
  const snapshotStages = new Set<ShapeStageId>();
  for (const task of event.payload.tasks) {
    const stageId = resolveShapeStageId(task.stage);
    if (stageId) snapshotStages.add(stageId);
  }
  const stageFromEvent = resolveShapeStageId(event.payload.stageId);
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
  const recoveryRevision = useAtomValue(buildSessionRecoveryRevisionAtom);

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
    let unsubscribeAll: (() => void) | null = null;

    const uiSyncByStage: Record<ShapeStageId, UiSyncPhase> = {
      source: 'ui-initializing',
      geometry: 'ui-initializing',
      tileEmit: 'ui-initializing',
    };
    const progressBufferByStage: Record<ShapeStageId, TaskProgressUpdatedEvent[]> = {
      source: [],
      geometry: [],
      tileEmit: [],
    };
    let flushTimerId: number | null = null;

    // Per-stage buffer manager for task-progress version gating.
    // session-state and stage-snapshot use FIFO queues inside the manager.
    const eventBufferManager = new UIEventBufferManager();

    const dispatchUiSyncPhase = (stageId: ShapeStageId, phase: UiSyncPhase): void => {
      if (uiSyncByStage[stageId] === phase) return;
      uiSyncByStage[stageId] = phase;
      dispatch({
        type: 'uiSyncPhaseChanged',
        payload: { stageId, phase },
      });
    };

    const flushProgressBuffer = (): void => {
      flushTimerId = null;
      for (const stageId of SHAPE_STAGE_IDS) {
        if (uiSyncByStage[stageId] !== 'running') continue;
        const queue = progressBufferByStage[stageId];
        if (queue.length <= 0) continue;
        progressBufferByStage[stageId] = [];
        for (const progressEvent of queue) {
          adapter.onProgressEvent(progressEvent);
        }
      }
    };

    const scheduleFlush = (): void => {
      if (flushTimerId !== null) return;
      // Always use requestAnimationFrame — this code runs exclusively in browser context
      // (inside useEffect). The setTimeout fallback was dead code that caused test/prod divergence.
      flushTimerId = window.requestAnimationFrame(flushProgressBuffer);
    };

    const resolveBuildStatus = (value: string): BuildStatus => {
      if (
        value === 'idle' ||
        value === 'queued' ||
        value === 'running' ||
        value === 'paused' ||
        value === 'completed' ||
        value === 'failed' ||
        value === 'recycled'
      ) {
        return value;
      }
      throw new Error(`[useShapeBuildSessionStateAtomBridge] unknown task status: ${value}`);
    };

    const toAdapterStageSnapshotEvent = (
      event: StageSnapshotUpdatedEvent
    ): AdapterStageSnapshotUpdatedEvent => {
      const tasks: BuildTaskSummary[] = event.payload.tasks.map((task) => {
        const stage = resolveShapeStageId(task.stage);
        if (stage === undefined) {
          throw new Error(
            `[useShapeBuildSessionStateAtomBridge] unknown stage in snapshot: ${String(task.stage)}`
          );
        }
        return {
          taskId: task.taskId,
          version: task.version,
          stage: stage as TaskStage,
          status: resolveBuildStatus(task.status),
          progress: task.progress,
          errorMessage: task.errorMessage,
          metadata: task.metadata,
        };
      });
      return {
        type: 'stageSnapshotUpdated',
        payload: {
          stageId: event.payload.stageId,
          tasks,
          stageStartedAt: event.payload.stageStartedAt,
          stageInactiveMs: event.payload.stageInactiveMs,
          stageCompletedAt: event.payload.stageCompletedAt,
        },
      };
    };

    const processStageSnapshotEvent = (event: StageSnapshotUpdatedEvent): void => {
      const snapshotStages = resolveSnapshotTargetStages(event);
      adapter.onTaskEvent(toAdapterStageSnapshotEvent(event));
      for (const stageId of snapshotStages) {
        dispatchUiSyncPhase(stageId, 'running');
      }
      scheduleFlush();
    };

    const processProgressEvent = (event: TaskProgressUpdatedEvent): void => {
      const stageId = resolveShapeStageId(event.payload.stageId);
      if (!stageId) {
        throw new Error(
          `[useShapeBuildSessionStateAtomBridge] unknown stageId in taskProgressUpdated: ${String(event.payload.stageId)}`
        );
      }
      progressBufferByStage[stageId].push(event);
      if (uiSyncByStage[stageId] !== 'running') return;
      scheduleFlush();
    };

    const processSessionStatusEvent = (event: SessionStatusUpdatedEvent): void => {
      adapter.onSessionState(event);
      // Derive UI sync signal from the canonical phase and stageId fields.
      // 'startup:*' and 'ui-sync:*' stageId values are not part of the spec
      // and must not be interpreted here.
      const stageId = resolveShapeStageId(event.payload.stageId);
      if (!stageId) return;
      dispatch({
        type: 'viewSelectionChanged',
        payload: { activeStageId: stageId },
      });
      const uiSyncPhase = uiSyncByStage[stageId];
      if (event.payload.phase === 'running' && uiSyncPhase === 'running') {
        scheduleFlush();
      }
    };

    // ---------------------------------------------------------------------------
    // Incoming event handlers — all events are enqueued immediately on arrival.
    // No seqNum-based gap detection; session-state and stage-snapshot are FIFO.
    // task-progress goes through version gating only.
    // ---------------------------------------------------------------------------

    const onTaskEvent = (event: StageSnapshotUpdatedEvent): void => {
      // Enqueue into FIFO queue, then flush immediately via rAF
      const buffered: BufferedEvent = {
        notificationType: 'stage-snapshot',
        payload: event,
        timestamp: Date.now(),
      };
      eventBufferManager.enqueue(buffered);
      flushFifoQueues();
    };

    const onProgressEvent = (event: TaskProgressUpdatedEvent): void => {
      const accepted = eventBufferManager.applyTaskProgress(
        event.payload.taskId,
        event.payload.version
      );
      if (!accepted) return; // stale or duplicate — drop
      processProgressEvent(event);
    };

    const onSessionState = (event: SessionStatusUpdatedEvent): void => {
      // Enqueue into FIFO queue, then flush immediately via rAF
      const buffered: BufferedEvent = {
        notificationType: 'session-state',
        payload: event,
        timestamp: Date.now(),
      };
      eventBufferManager.enqueue(buffered);
      flushFifoQueues();
    };

    const flushFifoQueues = (): void => {
      // Drain session-state FIFO
      for (const ev of eventBufferManager.flushFifo('session-state')) {
        processSessionStatusEvent(ev.payload as SessionStatusUpdatedEvent);
      }
      // Drain stage-snapshot FIFO
      for (const ev of eventBufferManager.flushFifo('stage-snapshot')) {
        processStageSnapshotEvent(ev.payload as StageSnapshotUpdatedEvent);
      }
    };

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

    const requireEventShape = <T extends { type: string }>(
      event: unknown,
      expectedType: T['type'],
      context: string
    ): T => {
      if (!event || typeof event !== 'object') {
        throw new Error(`[${context}] event must be an object, received ${safeStringify(event)}`);
      }
      const rec = event as Record<string, unknown>;
      if (rec.type !== expectedType) {
        throw new Error(
          `[${context}] unexpected event type: expected "${expectedType}", received ${safeStringify(rec.type)}`
        );
      }
      return event as T;
    };

    const run = async () => {
      await bridge.initialize();
      if (cancelled) return;

      const shapeQueryAPI = await bridge.getShapeQueryAPI();
      const probe = await shapeQueryAPI.probeBuildSession(nodeId);
      if (cancelled) return;
      if (probe.kind === 'recoverable-contract-error') {
        dispatch({
          type: 'criticalError',
          payload: {
            nodeId: nodeIdText,
            message: probe.error.message,
            error: probe.error.message,
            errorName: 'ShapeBuildSessionContractError',
            timestamp: Date.now(),
            severity: 'critical',
            contractViolation: true,
            recovery: probe.error,
          },
        });
        return;
      }

      const runtime = await bridge.getBuildSessionRuntime(SHAPE_NODE_TYPE, nodeId);
      if (cancelled) return;
      if (runtime) {
        adapter.onRuntimeRecord(runtime);
      }

      unsubscribeAll = await bridge.subscribeAll(SHAPE_NODE_TYPE, nodeId, {
        onTaskEvent: (event) => {
          if (cancelled) return;
          onTaskEvent(
            requireEventShape<StageSnapshotUpdatedEvent>(
              event,
              'stageSnapshotUpdated',
              'onTaskEvent'
            )
          );
        },
        onProgressEvent: (event) => {
          if (cancelled) return;
          onProgressEvent(
            requireEventShape<TaskProgressUpdatedEvent>(
              event,
              'taskProgressUpdated',
              'onProgressEvent'
            )
          );
        },
        onSessionState: (event) => {
          if (cancelled) return;
          onSessionState(
            requireEventShape<SessionStatusUpdatedEvent>(
              event,
              'sessionStatusUpdated',
              'onSessionState'
            )
          );
        },
        onHeartbeat: (event) => {
          if (cancelled) return;
          adapter.onHeartbeat(requireEventShape<HeartbeatEvent>(event, 'heartbeat', 'onHeartbeat'));
        },
      });

      if (cancelled) {
        unsubscribeAll();
        unsubscribeAll = null;
        return;
      }

      adapter.onTaskStreamConnectionChanged(true);
    };

    void run().catch((error) => {
      if (cancelled) return;
      const errorName = error instanceof Error ? error.name : 'UnknownError';
      const message = error instanceof Error ? error.message : String(error);
      console.error('[shape buildSessionStateAtomBridge] initialization failed', {
        nodeId: nodeIdText,
        recoveryRevision,
        error,
      });
      dispatch({
        type: 'criticalError',
        payload: {
          nodeId: nodeIdText,
          message,
          error: String(error),
          errorName,
          timestamp: Date.now(),
          severity: 'critical',
          contractViolation: false,
        },
      });
    });

    return () => {
      cancelled = true;
      if (flushTimerId !== null) {
        window.cancelAnimationFrame(flushTimerId);
        flushTimerId = null;
      }
      adapter.onTaskStreamConnectionChanged(false);
      eventBufferManager.reset();
      unsubscribeAll?.();
    };
  }, [dispatch, nodeId, recoveryRevision]);
};
