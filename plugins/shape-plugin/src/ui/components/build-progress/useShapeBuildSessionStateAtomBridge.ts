import { useEffect } from 'react';
import type { NodeId, NodeType } from '@hierarchidb/core-types';
import type { BuildProgressEvent, BuildTaskUpdateEvent } from '@hierarchidb/build-api';
import { getBuildWorkerBridge } from '@hierarchidb/ui-worker-client';
import { useSetAtom } from 'jotai';
import { dispatchBuildSessionEventAtom } from '~/ui/atoms/buildSessionStateAtoms';
import { createBuildSessionWorkerEventAdapter } from '~/ui/atoms/buildSessionWorkerEventAdapter';
import type { ShapeStageId } from '~/ui/atoms/buildSessionStateAtoms';

const SHAPE_NODE_TYPE = 'shape' as NodeType;
const SHAPE_STAGE_IDS = ['source', 'geometry', 'tileEmit'] as const satisfies readonly ShapeStageId[];

type UiSyncPhase = 'ui-initializing' | 'running';

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

const resolveSnapshotVersion = (event: BuildTaskUpdateEvent): number => {
  if (event.type !== 'snapshot') {
    throw new Error('[shape buildSessionStateAtomBridge] resolveSnapshotVersion requires snapshot event');
  }
  if (event.tasks.length > 0) {
    return event.tasks.reduce((max, task) => Math.max(max, task.version), Number.MIN_SAFE_INTEGER);
  }
  return Date.now();
};

export const useShapeBuildSessionStateAtomBridge = (nodeId: NodeId | undefined): void => {
  const dispatch = useSetAtom(dispatchBuildSessionEventAtom);

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
    let activeStageId: ShapeStageId = 'source';
    let flushTimerId: number | null = null;

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

    const scheduleProgressFlush = (): void => {
      if (flushTimerId !== null) return;
      if (typeof window !== 'undefined' && typeof window.requestAnimationFrame === 'function') {
        flushTimerId = window.requestAnimationFrame(flushProgressBuffer);
        return;
      }
      flushTimerId = window.setTimeout(flushProgressBuffer, 0);
    };

    const onTaskEvent = (event: BuildTaskUpdateEvent): void => {
      adapter.onTaskEvent(event);
      if (event.type !== 'snapshot') return;
      const snapshotStages = new Set<ShapeStageId>();
      for (const task of event.tasks) {
        const stageId = resolveShapeStageId(task.stage);
        if (stageId) snapshotStages.add(stageId);
      }
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

      const runtime = await bridge.getBuildSessionRuntime(SHAPE_NODE_TYPE, nodeId);
      if (cancelled) return;
      if (runtime) {
        adapter.onRuntimeRecord(runtime);
      }

      const tasks = await bridge.getBuildTasks(SHAPE_NODE_TYPE, nodeId);
      if (cancelled) return;
      const snapshotEvent = {
        type: 'snapshot',
        nodeId,
        tasks,
        version: resolveSnapshotVersion({ type: 'snapshot', nodeId, tasks }),
      } as BuildTaskUpdateEvent;
      onTaskEvent(snapshotEvent);
      adapter.onTaskStreamConnectionChanged(true);

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

      if (cancelled) {
        unsubscribeTasks();
        unsubscribeProgress();
        unsubscribeSessionState();
        unsubscribeHeartbeat();
        return;
      }

      unsubscribers.push(unsubscribeTasks, unsubscribeProgress, unsubscribeSessionState, unsubscribeHeartbeat);
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
  }, [dispatch, nodeId]);
};
