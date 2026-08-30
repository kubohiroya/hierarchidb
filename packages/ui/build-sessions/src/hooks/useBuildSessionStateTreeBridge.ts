import type { BuildStatus, StageKey } from '@hierarchidb/build-api';
import type { NodeId, NodeType } from '@hierarchidb/core-types';
import { useAtomValue, useSetAtom } from 'jotai';
import { useCallback, useMemo } from 'react';
import type {
  ValidatedCanonicalHeartbeat,
  ValidatedCanonicalSessionStatus,
  ValidatedCanonicalStageSnapshot,
  ValidatedCanonicalTaskProgress,
} from '../kernel/createCanonicalBuildSessionSubscriptionKernel.js';
import type { BuildSessionProgressState } from '../progressTypes.js';
import {
  type BuildSessionStateTreeLifecyclePhase,
  createBuildSessionStateTreeAtoms,
} from '../state-tree/createBuildSessionStateTreeAtoms.js';
import { computePercentage } from '../utils/taskProgressSummary.js';
import {
  type CanonicalBuildSessionSubscriptionTransport,
  useCanonicalBuildSessionSubscription,
} from './useCanonicalBuildSessionSubscription.js';

type Config<StageId extends StageKey> = {
  nodeType: NodeType;
  nodeId: NodeId | null;
  autoSubscribe?: boolean;
  subscriptionTransport: CanonicalBuildSessionSubscriptionTransport;
  stageIds: readonly StageId[];
  defaultActiveStageId: StageId;
  resolveStageId: (value: unknown) => StageId;
};

const mapLifecyclePhaseToBuildStatus = (
  phase: BuildSessionStateTreeLifecyclePhase
): BuildStatus => {
  if (phase === 'idle') return 'idle';
  if (phase === 'starting') return 'queued';
  if (phase === 'paused') return 'paused';
  if (phase === 'canceled') return 'canceled';
  if (phase === 'completed') return 'completed';
  if (phase === 'failed') return 'failed';
  return 'running';
};

export const useBuildSessionStateTreeBridge = <StageId extends StageKey>(
  config: Config<StageId>
) => {
  const {
    nodeType,
    nodeId,
    stageIds,
    defaultActiveStageId,
    resolveStageId,
    subscriptionTransport,
  } = config;
  const autoSubscribe = config.autoSubscribe ?? true;
  const nodeIdText = nodeId ? String(nodeId) : '';

  const stateTree = useMemo(
    () =>
      createBuildSessionStateTreeAtoms<StageId>({
        nodeId: nodeIdText,
        stageIds,
        defaultActiveStageId,
        initialSession: {
          phase: 'idle',
          isActive: false,
        },
      }),
    [defaultActiveStageId, nodeIdText, stageIds]
  );

  const dispatch = useSetAtom(stateTree.dispatchBuildSessionStateTreeEventAtom);
  const state = useAtomValue(stateTree.buildSessionStateTreeAtom);
  const activeStageCounts = useAtomValue(stateTree.activeStageCountsAtom);

  const handleReset = useCallback((): void => {
    dispatch({ type: 'reset' });
  }, [dispatch]);

  const handleSessionStatus = useCallback(
    (status: ValidatedCanonicalSessionStatus<StageId>): void => {
      dispatch({
        type: 'sessionPatched',
        payload: {
          phase: status.phase,
          isActive: status.isActive,
          hasAuthoritativeStatus: true,
          startedAt: status.startedAt,
          inactiveMs: status.inactiveMs,
          completedAt: status.completedAt,
          ...(status.pausedAt === undefined ? {} : { lastHeartbeatAt: status.pausedAt }),
          error: status.phase === 'failed' ? status.stopReason : undefined,
        },
      });
      if (status.stageId !== undefined) {
        dispatch({
          type: 'activeStageChanged',
          payload: { stageId: status.stageId },
        });
      }
    },
    [dispatch]
  );

  const handleStageSnapshot = useCallback(
    (snapshot: ValidatedCanonicalStageSnapshot<StageId>): void => {
      dispatch({
        type: 'tasksReplaced',
        payload: {
          stageId: snapshot.stageId,
          tasks: snapshot.tasks.map((task) => ({
            taskId: task.taskId,
            version: task.version,
            stage: task.stage,
            status: task.status,
            progress: task.progress,
            index: task.index,
            message: task.errorMessage,
            metadata: task.metadata,
          })),
        },
      });
      dispatch({
        type: 'timingPatched',
        payload: {
          stageId: snapshot.stageId,
          patch: {
            snapshotReceived: true,
            startedAtUtime: snapshot.stageStartedAt,
            pausedTotalMs: snapshot.stageInactiveMs,
            completedAtUtime: snapshot.stageCompletedAt,
          },
        },
      });
    },
    [dispatch]
  );

  const handleTaskProgress = useCallback(
    (progress: ValidatedCanonicalTaskProgress<StageId>): void => {
      dispatch({
        type: 'taskProgressUpdated',
        payload: progress,
      });
    },
    [dispatch]
  );

  const handleHeartbeat = useCallback(
    (heartbeat: ValidatedCanonicalHeartbeat): void => {
      dispatch({
        type: 'heartbeatReceived',
        payload: heartbeat,
      });
    },
    [dispatch]
  );

  const subscriptionConsumer = useMemo(
    () => ({
      onReset: handleReset,
      onSessionStatus: handleSessionStatus,
      onStageSnapshot: handleStageSnapshot,
      onTaskProgress: handleTaskProgress,
      onHeartbeat: handleHeartbeat,
    }),
    [handleHeartbeat, handleReset, handleSessionStatus, handleStageSnapshot, handleTaskProgress]
  );

  const { subscriptionError, subscriptionReady } = useCanonicalBuildSessionSubscription({
    nodeType,
    nodeId,
    autoSubscribe,
    subscriptionTransport,
    resolveStageId,
    consumer: subscriptionConsumer,
  });

  const taskCounts = useMemo(
    () => ({
      total: activeStageCounts.total - activeStageCounts.recycled,
      completed: activeStageCounts.completed,
      failed: activeStageCounts.failed,
      skipped: activeStageCounts.skipped,
    }),
    [activeStageCounts]
  );
  const percentage = useMemo(() => computePercentage(taskCounts), [taskCounts]);
  const buildStatus = mapLifecyclePhaseToBuildStatus(state.session.phase);
  const activeTaskMessage = state.tasks.orderedIdsByStage[state.ui.activeStageId]
    .map((taskId) => state.tasks.byId[taskId])
    .find((task) => task?.message)?.message;
  const explicitActivityTimes = [
    state.session.lastHeartbeatAt,
    state.session.completedAt,
    state.session.startedAt,
    ...stageIds.flatMap((stageId) => {
      const timing = state.timing.byStage[stageId];
      return [timing.startedAtUtime, timing.completedAtUtime];
    }),
  ].filter((value): value is number => value !== undefined);
  const lastActivity =
    explicitActivityTimes.length > 0 ? Math.max(...explicitActivityTimes) : undefined;
  const activeStageSnapshotReceived = state.timing.byStage[state.ui.activeStageId].snapshotReceived;

  const progressState = useMemo<BuildSessionProgressState>(() => {
    if (!nodeId) {
      return { progress: null, status: null, error: subscriptionError };
    }
    const message = state.session.error ?? activeTaskMessage;
    return {
      progress:
        state.session.hasAuthoritativeStatus &&
        activeStageSnapshotReceived &&
        lastActivity !== undefined
          ? {
              nodeId,
              stage: state.ui.activeStageId,
              status: buildStatus,
              timestamp: lastActivity,
              taskCounts,
              percentage,
              message,
            }
          : null,
      status: state.session.hasAuthoritativeStatus
        ? {
            nodeId,
            status: buildStatus,
            startedAt: state.session.startedAt,
            completedAt: state.session.completedAt,
            lastActivity,
            error: state.session.error,
          }
        : null,
      error: subscriptionError,
    };
  }, [
    activeTaskMessage,
    activeStageSnapshotReceived,
    buildStatus,
    lastActivity,
    nodeId,
    percentage,
    state.session.completedAt,
    state.session.error,
    state.session.hasAuthoritativeStatus,
    state.session.startedAt,
    state.ui.activeStageId,
    subscriptionError,
    taskCounts,
  ]);

  return {
    atoms: stateTree,
    tree: state,
    activeStageCounts,
    progressState,
    subscriptionReady,
  };
};
