import { useEffect, useMemo } from 'react';
import { useAtomValue, useSetAtom } from 'jotai';
import type {
  BuildSessionStatus,
  BuildTaskSummary,
  BuildTaskUpdateEvent,
  BuildUnifiedProgressInfo,
} from '@hierarchidb/build-api';
import type { NodeId, NodeType } from '@hierarchidb/core-types';
import { getBuildWorkerBridge } from '@hierarchidb/ui-worker-client';
import {
  createBuildSessionStateTreeAtoms,
  type BuildSessionStateTreeLifecyclePhase,
  type BuildSessionTaskStatus,
} from '../state-tree/createBuildSessionStateTreeAtoms.js';
import { usePluginBuildProgress } from './usePluginBuildProgress.js';

type Config<StageId extends string> = {
  nodeType: NodeType;
  nodeId: NodeId | null;
  autoSubscribe?: boolean;
  stageIds: readonly StageId[];
  defaultActiveStageId: StageId;
  resolveStageId: (value: unknown) => StageId;
  mapBuildStatusToPhase: (status: BuildSessionStatus['status']) => BuildSessionStateTreeLifecyclePhase;
};

const asFiniteNumber = (value: unknown, label: string): number => {
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    throw new Error(`[buildSessionStateTreeBridge] ${label} must be a finite number, received ${String(value)}`);
  }
  return value;
};

const resolveSessionEventVersion = (sessionRecord: Record<string, unknown>): number => {
  const stageHeartbeatAt = sessionRecord.stageHeartbeatAt;
  if (typeof stageHeartbeatAt === 'number' && Number.isFinite(stageHeartbeatAt)) {
    return stageHeartbeatAt;
  }
  const completedAt = sessionRecord.completedAt;
  if (typeof completedAt === 'number' && Number.isFinite(completedAt)) {
    return completedAt;
  }
  const startedAt = sessionRecord.startedAt;
  if (typeof startedAt === 'number' && Number.isFinite(startedAt)) {
    return startedAt;
  }
  throw new Error('[buildSessionStateTreeBridge] session record event version must come from stageHeartbeatAt/completedAt/startedAt');
};

const resolveSnapshotVersion = (event: BuildTaskUpdateEvent): number => {
  if (event.type !== 'snapshot') {
    throw new Error('[buildSessionStateTreeBridge] resolveSnapshotVersion requires snapshot event');
  }
  if (event.tasks.length > 0) {
    return event.tasks.reduce((max, task) => Math.max(max, task.version), Number.MIN_SAFE_INTEGER);
  }
  return asFiniteNumber((event as { version?: unknown }).version, 'task snapshot event.version');
};

const mapTaskStatus = (status: BuildTaskSummary['status']): BuildSessionTaskStatus => {
  if (status === 'queued') return 'queued';
  if (status === 'running') return 'running';
  if (status === 'completed') return 'completed';
  if (status === 'failed') return 'failed';
  if (status === 'recycled') return 'recycled';
  throw new Error(`[buildSessionStateTreeBridge] unsupported task status: ${String(status)}`);
};

const toTaskItem = <StageId extends string>(task: BuildTaskSummary, resolveStageId: (value: unknown) => StageId) => ({
  taskId: task.taskId,
  version: task.version,
  stage: resolveStageId(task.stage),
  status: mapTaskStatus(task.status),
  progress: task.progress,
  index: typeof task.sequence === 'number' ? task.sequence : Number.MAX_SAFE_INTEGER,
  message: undefined,
  display: task.display,
  metadata: task.metadata,
});

export const useBuildSessionStateTreeBridge = <StageId extends string>(
  config: Config<StageId>,
) => {
  const nodeIdText = config.nodeId ? String(config.nodeId) : '';
  const stageIds = config.stageIds;

  const stateTree = useMemo(() => (
    createBuildSessionStateTreeAtoms<StageId>({
      nodeId: nodeIdText,
      stageIds,
      defaultActiveStageId: config.defaultActiveStageId,
      initialSession: {
        phase: 'idle',
        isActive: false,
      },
    })
  ), [config.defaultActiveStageId, nodeIdText, stageIds]);

  const dispatch = useSetAtom(stateTree.dispatchBuildSessionStateTreeEventAtom);
  const state = useAtomValue(stateTree.buildSessionStateTreeAtom);
  const activeStageCounts = useAtomValue(stateTree.activeStageCountsAtom);
  const totalElapsedMs = useAtomValue(stateTree.totalElapsedMsAtom);

  const progressState = usePluginBuildProgress<BuildUnifiedProgressInfo, BuildSessionStatus>(
    config.nodeType,
    config.nodeId,
    {
      autoSubscribe: config.autoSubscribe ?? true,
      mapUnifiedToProgress: (info) => info ?? null,
      mapUnifiedToStatus: (info) => {
        if (!config.nodeId || !info) return null;
        const payload = info.payload as { total: number; completed: number; failed: number; skipped?: number; estimatedTimeRemaining?: number } | undefined;
        if (!payload) {
          throw new Error(`[useBuildSessionStateTreeBridge] info.payload is required but was absent (nodeId=${String(info.nodeId)}, stage=${String(info.stage)})`);
        }
        const status = info.phase;
        return {
          nodeId: config.nodeId,
          status,
          progress: {
            total: payload.total,
            completed: payload.completed,
            failed: payload.failed,
            skipped: payload.skipped,
            percentage: (() => {
              const t = payload.total;
              const c = payload.completed;
              return t > 0 ? Math.round((c / t) * 100) : 0;
            })(),
            stage: info.stage,
            estimatedTimeRemaining: payload.estimatedTimeRemaining,
          },
          lastActivity: info.timestamp,
          error: info.message,
        };
      },
    },
  );

  useEffect(() => {
    if (!config.nodeId) {
      dispatch({ type: 'reset' });
      return;
    }
    dispatch({
      type: 'sessionPatched',
      eventVersion: Date.now(),
      payload: {
        phase: 'idle',
        isActive: false,
        error: undefined,
      },
    });
  }, [config.nodeId, dispatch]);

  useEffect(() => {
    const info = progressState.unifiedProgress;
    if (!config.nodeId || !info) return;
    dispatch({
      type: 'activeStageChanged',
      payload: { stageId: config.resolveStageId(info.stage) },
    });
    dispatch({
      type: 'sessionPatched',
      eventVersion: asFiniteNumber(info.timestamp, 'progress.timestamp'),
      payload: {
        phase: config.mapBuildStatusToPhase(info.phase),
        isActive: info.phase === 'queued' || info.phase === 'running',
        error: info.phase === 'failed' ? (info.message ?? 'Build failed') : undefined,
      },
    });
  }, [config, dispatch, progressState.unifiedProgress]);

  useEffect(() => {
    const nodeId = config.nodeId;
    if (!nodeId) return;
    let cancelled = false;
    let unsubscribeTasks: (() => void) | null = null;
    let unsubscribeSession: (() => void) | null = null;

    const run = async () => {
      const bridge = getBuildWorkerBridge();
      await bridge.initialize();
      const tasks = await bridge.getBuildTasks(config.nodeType, nodeId);
      if (!cancelled) {
        const grouped = new Map<StageId, BuildTaskSummary[]>();
        for (const task of tasks) {
          const stageId = config.resolveStageId(task.stage);
          const current = grouped.get(stageId) ?? [];
          current.push(task);
          grouped.set(stageId, current);
        }
        for (const stageId of stageIds) {
          const stageTasks = grouped.get(stageId) ?? [];
          dispatch({
            type: 'tasksReplaced',
            eventVersion: stageTasks.length > 0
              ? stageTasks.reduce((max, task) => Math.max(max, task.version), Number.MIN_SAFE_INTEGER)
              : Date.now(),
            payload: {
              stageId,
              tasks: stageTasks.map((task) => toTaskItem(task, config.resolveStageId)),
            },
          });
        }
      }
      unsubscribeTasks = await bridge.subscribeBuildTasks(
        config.nodeType,
        nodeId,
        (event) => {
          if (cancelled) return;
          if (event.type === 'snapshot') {
            const grouped = new Map<StageId, BuildTaskSummary[]>();
            for (const task of event.tasks) {
              const stageId = config.resolveStageId(task.stage);
              const current = grouped.get(stageId) ?? [];
              current.push(task);
              grouped.set(stageId, current);
            }
            for (const stageId of stageIds) {
              const stageTasks = grouped.get(stageId) ?? [];
              dispatch({
                type: 'tasksReplaced',
                eventVersion: resolveSnapshotVersion(event),
                payload: {
                  stageId,
                  tasks: stageTasks.map((task) => toTaskItem(task, config.resolveStageId)),
                },
              });
            }
            return;
          }
          if (event.type === 'update') {
            dispatch({
              type: 'taskUpserted',
              eventVersion: asFiniteNumber(event.task.version, 'task.version'),
              payload: {
                task: toTaskItem(event.task, config.resolveStageId),
              },
            });
            return;
          }
          dispatch({
            type: 'taskDeleted',
            eventVersion: asFiniteNumber((event as { version?: unknown }).version, 'task delete event.version'),
            payload: {
              stageId: config.defaultActiveStageId,
              taskId: event.taskId,
            },
          });
        },
      );
      unsubscribeSession = await bridge.subscribeSessionState(
        config.nodeType,
        nodeId,
        (event: { sessionRecord?: Record<string, unknown> | null }) => {
          if (cancelled) return;
          const sessionRecord = event.sessionRecord;
          if (!sessionRecord || typeof sessionRecord !== 'object') return;
          const status = sessionRecord.status as BuildSessionStatus['status'] | undefined;
          const stage = sessionRecord.stage as unknown;
          const eventVersion = resolveSessionEventVersion(sessionRecord);
          if (status) {
            dispatch({
              type: 'sessionPatched',
              eventVersion,
              payload: {
                phase: config.mapBuildStatusToPhase(status),
                isActive: status === 'queued' || status === 'running',
              },
            });
          }
          if (stage !== undefined) {
            const stageId = config.resolveStageId(stage);
            dispatch({
              type: 'timingPatched',
              eventVersion,
              payload: {
                stageId,
                patch: {
                  startedAtUtime: sessionRecord.stageStartedAt as number | undefined,
                  pausedTotalMs: sessionRecord.stageInactiveMs as number | undefined,
                  completedAtUtime: sessionRecord.completedAt as number | undefined,
                },
              },
            });
          }
        },
      );
    };

    void run();
    return () => {
      cancelled = true;
      unsubscribeTasks?.();
      unsubscribeSession?.();
    };
  }, [config, dispatch, stageIds]);

  return {
    atoms: stateTree,
    tree: state,
    activeStageCounts,
    totalElapsedMs,
    progressState,
  };
};
