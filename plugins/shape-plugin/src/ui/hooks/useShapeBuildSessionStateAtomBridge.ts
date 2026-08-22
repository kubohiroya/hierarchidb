import type { BuildStatus, BuildTaskSummary, WorkerLogEvent } from '@hierarchidb/build-api';
import type { NodeId, NodeType } from '@hierarchidb/core-types';
import type { ShapeBuildStopReason } from '@hierarchidb/shape-api';
import {
  createCanonicalBuildSessionSubscriptionKernel,
  type ValidatedCanonicalHeartbeat,
  type ValidatedCanonicalSessionStatus,
  type ValidatedCanonicalStageSnapshot,
  type ValidatedCanonicalTaskProgress,
} from '@hierarchidb/ui-build-sessions';
import { getBuildWorkerBridge } from '@hierarchidb/ui-worker-client';
import { useAtomValue, useSetAtom } from 'jotai';
import { useEffect } from 'react';
import type { StageSnapshotUpdatedEvent } from '~/common/types/session-events';
import type { ShapeStageId } from '~/ui/atoms/ShapeStageId';
import {
  buildSessionRecoveryRevisionAtom,
  dispatchBuildSessionEventAtom,
} from '~/ui/atoms/buildSessionStateAtoms';
import { createBuildSessionWorkerEventAdapter } from '~/ui/atoms/buildSessionWorkerEventAdapterConstants';

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

const requireShapeStageId = (value: unknown): ShapeStageId => {
  const stageId = resolveShapeStageId(value);
  if (stageId === undefined) {
    throw new Error(`[useShapeBuildSessionStateAtomBridge] unknown stage: ${String(value)}`);
  }
  return stageId;
};

const isShapeBuildStopReason = (value: unknown): value is ShapeBuildStopReason =>
  value === 'route-leave' ||
  value === 'user-pause' ||
  value === 'failed' ||
  value === 'completed' ||
  value === 'unknown';

const resolveShapeBuildStopReason = (
  value: string | undefined
): ShapeBuildStopReason | undefined => {
  if (value === undefined) return undefined;
  if (isShapeBuildStopReason(value)) return value;
  throw new Error(`[useShapeBuildSessionStateAtomBridge] unsupported stopReason: ${value}`);
};

const resolveShapeTaskStatus = (value: string): BuildStatus => {
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
  throw new Error(`[useShapeBuildSessionStateAtomBridge] unsupported task status: ${value}`);
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

    const kernel = createCanonicalBuildSessionSubscriptionKernel<ShapeStageId>({
      nodeId,
      resolveStageId: requireShapeStageId,
      consumer: {
        onReset: () => {
          dispatch({ type: 'reset' });
        },
        onSessionStatus: (status: ValidatedCanonicalSessionStatus<ShapeStageId>) => {
          dispatch({
            type: 'sessionStatusUpdated',
            payload: {
              nodeId: nodeIdText,
              phase: status.phase,
              isActive: status.isActive,
              startedAt: status.startedAt,
              inactiveMs: status.inactiveMs,
              completedAt: status.completedAt,
              pausedAt: status.pausedAt,
              stopReason: resolveShapeBuildStopReason(status.stopReason),
            },
          });
          if (status.stageId !== undefined) {
            dispatch({
              type: 'viewSelectionChanged',
              payload: { activeStageId: status.stageId },
            });
          }
        },
        onStageSnapshot: (snapshot: ValidatedCanonicalStageSnapshot<ShapeStageId>) => {
          dispatch({
            type: 'stageSnapshotUpdated',
            payload: {
              stageId: snapshot.stageId,
              tasks: snapshot.tasks.map(
                (task): BuildTaskSummary => ({
                  taskId: task.taskId,
                  version: task.version,
                  stage: task.stage,
                  status: resolveShapeTaskStatus(task.status),
                  progress: task.progress,
                  errorMessage: task.errorMessage,
                  metadata: task.metadata,
                })
              ),
              stageStartedAt: snapshot.stageStartedAt,
              stageInactiveMs: snapshot.stageInactiveMs,
              stageCompletedAt: snapshot.stageCompletedAt,
            },
          });
          dispatchUiSyncPhase(snapshot.stageId, 'running');
        },
        onTaskProgress: (progress: ValidatedCanonicalTaskProgress<ShapeStageId>) => {
          dispatch({
            type: 'taskProgressUpdated',
            payload: {
              stageId: progress.stageId,
              value: progress.value,
              message: progress.message,
              metadata: progress.metadata,
            },
          });
        },
        onHeartbeat: (heartbeat: ValidatedCanonicalHeartbeat) => {
          dispatch({
            type: 'heartbeat',
            payload: {
              nodeId: nodeIdText,
              heartbeatAt: heartbeat.heartbeatAt,
            },
          });
        },
        onError: (error: Error) => {
          throw error;
        },
      },
    });

    const uiSyncByStage: Record<ShapeStageId, UiSyncPhase> = {
      source: 'ui-initializing',
      geometry: 'ui-initializing',
      tileEmit: 'ui-initializing',
    };

    const dispatchUiSyncPhase = (stageId: ShapeStageId, phase: UiSyncPhase): void => {
      if (uiSyncByStage[stageId] === phase) return;
      uiSyncByStage[stageId] = phase;
      dispatch({
        type: 'uiSyncPhaseChanged',
        payload: { stageId, phase },
      });
    };

    const logWorkerEvent = (event: WorkerLogEvent): void => {
      if (event.level === 'error') {
        console.error('[Worker]', event.message, event.data);
      } else if (event.level === 'warn') {
        console.warn('[Worker]', event.message, event.data);
      } else {
        console.log('[Worker]', event.message, event.data);
      }
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

      const unsubscribeCanonical = await bridge.subscribeAll(SHAPE_NODE_TYPE, nodeId, {
        onTaskEvent: (event) => {
          if (cancelled) return;
          kernel.handlers.onTaskEvent(event);
        },
        onProgressEvent: (event) => {
          if (cancelled) return;
          kernel.handlers.onProgressEvent(event);
        },
        onSessionState: (event) => {
          if (cancelled) return;
          kernel.handlers.onSessionState(event);
        },
        onHeartbeat: (event) => {
          if (cancelled) return;
          kernel.handlers.onHeartbeat(event);
        },
      });

      if (cancelled) {
        unsubscribeCanonical();
        return;
      }

      let unsubscribeWorkerLog: () => void;
      try {
        unsubscribeWorkerLog = await bridge.subscribeWorkerLog(
          SHAPE_NODE_TYPE,
          nodeId,
          (event: WorkerLogEvent) => {
            if (!cancelled) logWorkerEvent(event);
          }
        );
      } catch (error) {
        unsubscribeCanonical();
        throw error;
      }

      if (cancelled) {
        unsubscribeWorkerLog();
        unsubscribeCanonical();
        return;
      }

      let subscriptionsDisposed = false;
      unsubscribeAll = () => {
        if (subscriptionsDisposed) return;
        subscriptionsDisposed = true;
        unsubscribeWorkerLog();
        unsubscribeCanonical();
      };

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
      kernel.dispose();
      adapter.onTaskStreamConnectionChanged(false);
      unsubscribeAll?.();
    };
  }, [dispatch, nodeId, recoveryRevision]);
};
