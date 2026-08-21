import type {
  BuildStatus,
  HeartbeatEvent,
  SessionPhase,
  SessionStatusUpdatedEvent,
  StageKey,
  StageSnapshotUpdatedEvent,
  TaskProgressUpdatedEvent,
  TaskSummary,
} from '@hierarchidb/build-api';
import { unconditionalEventStreamer } from '@hierarchidb/build-runtime-services';
import type { NodeId, NodeType } from '@hierarchidb/core-types';
import { getBuildWorkerBridge } from '@hierarchidb/ui-worker-client';
import { useAtomValue, useSetAtom } from 'jotai';
import { useEffect, useMemo, useState } from 'react';
import type { BuildSessionProgressState } from '../progressTypes.js';
import {
  type BuildSessionStateTreeLifecyclePhase,
  type BuildSessionTaskItem,
  type BuildSessionTaskStatus,
  createBuildSessionStateTreeAtoms,
} from '../state-tree/createBuildSessionStateTreeAtoms.js';
import { computePercentage } from '../utils/taskProgressSummary.js';

type Config<StageId extends StageKey> = {
  nodeType: NodeType;
  nodeId: NodeId | null;
  autoSubscribe?: boolean;
  subscriptionTransport?: 'worker' | 'same-realm';
  stageIds: readonly StageId[];
  defaultActiveStageId: StageId;
  resolveStageId: (value: unknown) => StageId;
};

const requireFiniteNumber = (value: unknown, label: string): number => {
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    throw new Error(
      `[buildSessionStateTreeBridge] ${label} must be a finite number, received ${String(value)}`
    );
  }
  return value;
};

const requireNonNegativeNumber = (value: unknown, label: string): number => {
  const resolved = requireFiniteNumber(value, label);
  if (resolved < 0) {
    throw new Error(
      `[buildSessionStateTreeBridge] ${label} must be non-negative, received ${resolved}`
    );
  }
  return resolved;
};

const requireEvent = <T extends { type: string; payload: object }>(
  event: unknown,
  expectedType: T['type']
): T => {
  if (!event || typeof event !== 'object') {
    throw new Error(`[buildSessionStateTreeBridge] ${expectedType} event must be an object`);
  }
  const type = (event as { type?: unknown }).type;
  if (type !== expectedType) {
    throw new Error(
      `[buildSessionStateTreeBridge] expected ${expectedType}, received ${String(type)}`
    );
  }
  const payload = (event as { payload?: unknown }).payload;
  if (!payload || typeof payload !== 'object' || Array.isArray(payload)) {
    throw new Error(`[buildSessionStateTreeBridge] ${expectedType}.payload must be an object`);
  }
  return event as T;
};

const requireBoolean = (value: unknown, label: string): boolean => {
  if (typeof value !== 'boolean') {
    throw new Error(
      `[buildSessionStateTreeBridge] ${label} must be boolean, received ${String(value)}`
    );
  }
  return value;
};

const requireNonEmptyString = (value: unknown, label: string): string => {
  if (typeof value !== 'string' || value.length === 0) {
    throw new Error(
      `[buildSessionStateTreeBridge] ${label} must be a non-empty string, received ${String(value)}`
    );
  }
  return value;
};

const requireOptionalString = (value: unknown, label: string): string | undefined => {
  if (value === undefined) return undefined;
  if (typeof value !== 'string') {
    throw new Error(
      `[buildSessionStateTreeBridge] ${label} must be a string, received ${String(value)}`
    );
  }
  return value;
};

const requireOptionalRecord = (
  value: unknown,
  label: string
): Record<string, unknown> | undefined => {
  if (value === undefined) return undefined;
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new Error(
      `[buildSessionStateTreeBridge] ${label} must be an object, received ${String(value)}`
    );
  }
  return value as Record<string, unknown>;
};

const requireProgressValue = (value: unknown, label: string): number => {
  const resolved = requireFiniteNumber(value, label);
  if (resolved < 0 || resolved > 100) {
    throw new Error(
      `[buildSessionStateTreeBridge] ${label} must be within 0..100, received ${resolved}`
    );
  }
  return resolved;
};

const requirePositiveInteger = (value: unknown, label: string): number => {
  const resolved = requireFiniteNumber(value, label);
  if (!Number.isInteger(resolved) || resolved <= 0) {
    throw new Error(
      `[buildSessionStateTreeBridge] ${label} must be a positive integer, received ${resolved}`
    );
  }
  return resolved;
};

const resolveLifecyclePhase = (value: unknown): BuildSessionStateTreeLifecyclePhase => {
  const phases: readonly SessionPhase[] = [
    'idle',
    'starting',
    'running',
    'pausing',
    'paused',
    'resuming',
    'finalizing',
    'completed',
    'failed',
  ];
  if (typeof value === 'string' && phases.includes(value as SessionPhase)) {
    return value as BuildSessionStateTreeLifecyclePhase;
  }
  throw new Error(`[buildSessionStateTreeBridge] unsupported session phase: ${String(value)}`);
};

const mapLifecyclePhaseToBuildStatus = (
  phase: BuildSessionStateTreeLifecyclePhase
): BuildStatus => {
  if (phase === 'idle') return 'idle';
  if (phase === 'starting') return 'queued';
  if (phase === 'paused') return 'paused';
  if (phase === 'completed') return 'completed';
  if (phase === 'failed') return 'failed';
  return 'running';
};

type ValidatedSessionTiming = {
  phase: BuildSessionStateTreeLifecyclePhase;
  isActive: boolean;
  startedAt: number | undefined;
  inactiveMs: number | undefined;
  completedAt: number | undefined;
};

const validateSessionStatusEvent = (event: SessionStatusUpdatedEvent): ValidatedSessionTiming => {
  const { payload } = event;
  const phase = resolveLifecyclePhase(payload.phase);
  const isActive = requireBoolean(payload.isActive, 'session.isActive');
  const expectedIsActive =
    phase === 'starting' ||
    phase === 'running' ||
    phase === 'pausing' ||
    phase === 'resuming' ||
    phase === 'finalizing';
  if (isActive !== expectedIsActive) {
    throw new Error(
      `[buildSessionStateTreeBridge] session.isActive=${String(isActive)} is invalid for phase ${phase}`
    );
  }
  const startedAt =
    payload.startedAt === undefined
      ? undefined
      : requireNonNegativeNumber(payload.startedAt, 'session.startedAt');
  const inactiveMs =
    payload.inactiveMs === undefined
      ? undefined
      : requireNonNegativeNumber(payload.inactiveMs, 'session.inactiveMs');
  const completedAt =
    payload.completedAt === undefined
      ? undefined
      : requireNonNegativeNumber(payload.completedAt, 'session.completedAt');

  if (phase !== 'idle' && phase !== 'starting' && startedAt === undefined) {
    throw new Error(
      `[buildSessionStateTreeBridge] session.startedAt is required for phase ${phase}`
    );
  }
  if ((phase === 'completed' || phase === 'failed') && completedAt === undefined) {
    throw new Error(
      `[buildSessionStateTreeBridge] session.completedAt is required for phase ${phase}`
    );
  }
  if (startedAt !== undefined && completedAt !== undefined) {
    const durationMs = completedAt - startedAt - (inactiveMs ?? 0);
    if (!Number.isFinite(durationMs) || durationMs < 0) {
      throw new Error(
        `[buildSessionStateTreeBridge] session duration must be finite and non-negative, received ${durationMs}`
      );
    }
  }

  if (payload.stageId === undefined) {
    if (payload.stageStartedAt !== undefined || payload.stageInactiveMs !== undefined) {
      throw new Error(
        '[buildSessionStateTreeBridge] stage timing must be absent when session.stageId is absent'
      );
    }
  } else {
    requireNonNegativeNumber(payload.stageStartedAt, 'session.stageStartedAt');
    requireNonNegativeNumber(payload.stageInactiveMs, 'session.stageInactiveMs');
  }

  return { phase, isActive, startedAt, inactiveMs, completedAt };
};

const resolveTaskStatus = (value: unknown): BuildSessionTaskStatus => {
  if (
    value === 'queued' ||
    value === 'running' ||
    value === 'completed' ||
    value === 'failed' ||
    value === 'recycled' ||
    value === 'skipped'
  ) {
    return value;
  }
  throw new Error(`[buildSessionStateTreeBridge] unsupported task status: ${String(value)}`);
};

const toTaskItem = <StageId extends StageKey>(
  value: unknown,
  index: number,
  targetStageId: StageId,
  resolveStageId: (value: unknown) => StageId
): BuildSessionTaskItem<StageId> => {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new Error(
      `[buildSessionStateTreeBridge] snapshot task at index ${index} must be an object`
    );
  }
  const task = value as TaskSummary;
  const taskId = requireNonEmptyString(task.taskId, `snapshot.tasks[${index}].taskId`);
  const taskStageId = resolveStageId(task.stage);
  if (taskStageId !== targetStageId) {
    throw new Error(
      `[buildSessionStateTreeBridge] snapshot task stage mismatch: task.stage=${String(taskStageId)} snapshot.stageId=${String(targetStageId)}`
    );
  }
  return {
    taskId,
    version: requirePositiveInteger(task.version, `snapshot.tasks[${index}].version`),
    stage: taskStageId,
    status: resolveTaskStatus(task.status),
    progress: requireProgressValue(task.progress, `snapshot.tasks[${index}].progress`),
    index,
    message: requireOptionalString(task.errorMessage, `snapshot.tasks[${index}].errorMessage`),
    metadata: requireOptionalRecord(task.metadata, `snapshot.tasks[${index}].metadata`),
  };
};

type CanonicalSubscriptionHandlers = {
  onTaskEvent: (event: unknown) => void;
  onProgressEvent: (event: unknown) => void;
  onSessionState: (event: unknown) => void;
  onHeartbeat: (event: unknown) => void;
};

const subscribeSameRealmCanonicalEvents = (
  nodeId: NodeId,
  handlers: CanonicalSubscriptionHandlers
): (() => void) => {
  const unsubscribers = [
    unconditionalEventStreamer.subscribe(nodeId, 'stage-snapshot', handlers.onTaskEvent),
    unconditionalEventStreamer.subscribe(nodeId, 'task-progress', handlers.onProgressEvent),
    unconditionalEventStreamer.subscribe(nodeId, 'session-state', handlers.onSessionState),
    unconditionalEventStreamer.subscribe(nodeId, 'heartbeat', handlers.onHeartbeat),
  ];
  let disposed = false;
  return () => {
    if (disposed) return;
    disposed = true;
    for (const unsubscribe of unsubscribers) {
      unsubscribe();
    }
  };
};

export const useBuildSessionStateTreeBridge = <StageId extends StageKey>(
  config: Config<StageId>
) => {
  const { nodeType, nodeId, stageIds, defaultActiveStageId, resolveStageId } = config;
  const autoSubscribe = config.autoSubscribe ?? true;
  const subscriptionTransport = config.subscriptionTransport ?? 'worker';
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
  const [subscriptionError, setSubscriptionError] = useState<Error | null>(null);

  useEffect(() => {
    if (!nodeId) {
      dispatch({ type: 'reset' });
      setSubscriptionError(null);
      return;
    }
    dispatch({ type: 'reset' });
    setSubscriptionError(null);
    if (!autoSubscribe) return;

    const unsubscribers: Array<() => void> = [];
    const initializedStages = new Set<StageId>();
    const bufferedProgressByStage = new Map<StageId, TaskProgressUpdatedEvent[]>();
    let cancelled = false;
    let acceptedSessionStartedAt: number | undefined;
    let acceptedSessionPhase: BuildSessionStateTreeLifecyclePhase | undefined;

    const resetForNewSession = (): void => {
      initializedStages.clear();
      bufferedProgressByStage.clear();
      dispatch({ type: 'reset' });
    };

    const dispatchTaskProgress = (event: TaskProgressUpdatedEvent): void => {
      const stageId = resolveStageId(event.payload.stageId);
      dispatch({
        type: 'taskProgressUpdated',
        payload: {
          taskId: event.payload.taskId,
          version: event.payload.version,
          stageId,
          value: event.payload.value,
          message: event.payload.message,
          metadata: event.payload.metadata,
        },
      });
    };

    const handleSessionStatus = (rawEvent: unknown): void => {
      const event = requireEvent<SessionStatusUpdatedEvent>(rawEvent, 'sessionStatusUpdated');
      const eventNodeId = requireNonEmptyString(event.payload.nodeId, 'session.nodeId');
      if (eventNodeId !== nodeIdText) return;
      const stopReason = requireOptionalString(event.payload.stopReason, 'session.stopReason');
      const { phase, isActive, startedAt, inactiveMs, completedAt } =
        validateSessionStatusEvent(event);
      const enteredStarting = phase === 'starting' && acceptedSessionPhase !== 'starting';
      const startedAtChanged =
        startedAt !== undefined &&
        acceptedSessionStartedAt !== undefined &&
        startedAt !== acceptedSessionStartedAt;
      if (enteredStarting || startedAtChanged) {
        resetForNewSession();
      }
      if (enteredStarting) {
        acceptedSessionStartedAt = undefined;
      } else if (startedAt !== undefined) {
        acceptedSessionStartedAt = startedAt;
      }
      acceptedSessionPhase = phase;
      dispatch({
        type: 'sessionPatched',
        payload: {
          phase,
          isActive,
          hasAuthoritativeStatus: true,
          startedAt,
          inactiveMs,
          completedAt,
          error: phase === 'failed' ? stopReason : undefined,
        },
      });
      if (event.payload.stageId !== undefined) {
        dispatch({
          type: 'activeStageChanged',
          payload: { stageId: resolveStageId(event.payload.stageId) },
        });
      }
    };

    const handleStageSnapshot = (rawEvent: unknown): void => {
      const event = requireEvent<StageSnapshotUpdatedEvent>(rawEvent, 'stageSnapshotUpdated');
      const stageId = resolveStageId(event.payload.stageId);
      if (!Array.isArray(event.payload.tasks)) {
        throw new Error('[buildSessionStateTreeBridge] stageSnapshot.tasks must be an array');
      }
      const stageStartedAt = requireNonNegativeNumber(
        event.payload.stageStartedAt,
        'stageSnapshot.stageStartedAt'
      );
      const stageInactiveMs = requireNonNegativeNumber(
        event.payload.stageInactiveMs,
        'stageSnapshot.stageInactiveMs'
      );
      const stageCompletedAt =
        event.payload.stageCompletedAt === undefined
          ? undefined
          : requireNonNegativeNumber(
              event.payload.stageCompletedAt,
              'stageSnapshot.stageCompletedAt'
            );
      if (stageCompletedAt !== undefined) {
        const durationMs = stageCompletedAt - stageStartedAt - stageInactiveMs;
        if (!Number.isFinite(durationMs) || durationMs < 0) {
          throw new Error(
            `[buildSessionStateTreeBridge] stage duration must be finite and non-negative, received ${durationMs}`
          );
        }
      }
      dispatch({
        type: 'tasksReplaced',
        payload: {
          stageId,
          tasks: event.payload.tasks.map((task, index) =>
            toTaskItem(task, index, stageId, resolveStageId)
          ),
        },
      });
      dispatch({
        type: 'timingPatched',
        payload: {
          stageId,
          patch: {
            snapshotReceived: true,
            startedAtUtime: stageStartedAt,
            pausedTotalMs: stageInactiveMs,
            completedAtUtime: stageCompletedAt,
          },
        },
      });
      initializedStages.add(stageId);
      const buffered = bufferedProgressByStage.get(stageId) ?? [];
      bufferedProgressByStage.delete(stageId);
      for (const progressEvent of buffered) {
        dispatchTaskProgress(progressEvent);
      }
    };

    const handleTaskProgress = (rawEvent: unknown): void => {
      const event = requireEvent<TaskProgressUpdatedEvent>(rawEvent, 'taskProgressUpdated');
      const stageId = resolveStageId(event.payload.stageId);
      requireNonEmptyString(event.payload.taskId, 'taskProgress.taskId');
      requirePositiveInteger(event.payload.version, 'taskProgress.version');
      requireProgressValue(event.payload.value, 'taskProgress.value');
      requireOptionalString(event.payload.message, 'taskProgress.message');
      requireOptionalRecord(event.payload.metadata, 'taskProgress.metadata');
      if (!initializedStages.has(stageId)) {
        const buffered = bufferedProgressByStage.get(stageId) ?? [];
        buffered.push(event);
        bufferedProgressByStage.set(stageId, buffered);
        return;
      }
      dispatchTaskProgress(event);
    };

    const handleHeartbeat = (rawEvent: unknown): void => {
      const event = requireEvent<HeartbeatEvent>(rawEvent, 'heartbeat');
      const eventNodeId = requireNonEmptyString(event.payload.nodeId, 'heartbeat.nodeId');
      if (eventNodeId !== nodeIdText) return;
      dispatch({
        type: 'heartbeatReceived',
        payload: {
          heartbeatAt: requireNonNegativeNumber(event.payload.heartbeatAt, 'heartbeat.heartbeatAt'),
        },
      });
    };

    const deliverCanonicalEvent = (
      handler: (rawEvent: unknown) => void,
      rawEvent: unknown
    ): void => {
      try {
        handler(rawEvent);
      } catch (error) {
        const resolved = error instanceof Error ? error : new Error(String(error));
        if (!cancelled) {
          setSubscriptionError(resolved);
        }
        throw resolved;
      }
    };

    const handlers: CanonicalSubscriptionHandlers = {
      onTaskEvent: (event: unknown) => {
        if (!cancelled) deliverCanonicalEvent(handleStageSnapshot, event);
      },
      onProgressEvent: (event: unknown) => {
        if (!cancelled) deliverCanonicalEvent(handleTaskProgress, event);
      },
      onSessionState: (event: unknown) => {
        if (!cancelled) deliverCanonicalEvent(handleSessionStatus, event);
      },
      onHeartbeat: (event: unknown) => {
        if (!cancelled) deliverCanonicalEvent(handleHeartbeat, event);
      },
    };

    const run = async (): Promise<void> => {
      let unsubscribeAll: () => void;
      if (subscriptionTransport === 'same-realm') {
        unsubscribeAll = subscribeSameRealmCanonicalEvents(nodeId, handlers);
      } else {
        const bridge = getBuildWorkerBridge();
        await bridge.initialize();
        if (cancelled) return;
        unsubscribeAll = await bridge.subscribeAll(nodeType, nodeId, handlers);
      }
      if (cancelled) {
        unsubscribeAll();
        return;
      }
      unsubscribers.push(unsubscribeAll);
    };

    void run().catch((error: unknown) => {
      if (cancelled) return;
      setSubscriptionError(error instanceof Error ? error : new Error(String(error)));
    });

    return () => {
      cancelled = true;
      bufferedProgressByStage.clear();
      for (const unsubscribe of unsubscribers.splice(0)) {
        unsubscribe();
      }
    };
  }, [
    autoSubscribe,
    dispatch,
    nodeId,
    nodeIdText,
    nodeType,
    resolveStageId,
    subscriptionTransport,
  ]);

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
  };
};
