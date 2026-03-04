import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { NodeId } from '@hierarchidb/core-types';

const sessionStateCallbacks = vi.hoisted(() => new Map<string, { unsubscribe?: () => void; callback?: (event: unknown) => void }>());
const stageSnapshotCallbacks = vi.hoisted(() => new Map<string, { unsubscribe?: () => void; callback?: (event: unknown) => void }>());
const heartbeatCallbacks = vi.hoisted(() => new Map<string, { unsubscribe?: () => void; callback?: (event: unknown) => void }>());
const taskProgressCallbacks = vi.hoisted(() => new Map<string, { unsubscribe?: () => void; callback?: (event: unknown) => void }>());

vi.mock('../../worker/api/shapeBuildRuntime.js', () => ({
  shapeBuildRuntime: {
    sessionStateCallbacks,
    stageSnapshotCallbacks,
    heartbeatCallbacks,
    taskProgressCallbacks,
    taskCallbacks: new Map(),
    progressCallbacks: new Map(),
    invokeShapeBuildCommand: async () => undefined,
    startBuildSessionInternal: async () => 'node-1' as NodeId,
    getBuildSessionInternal: async () => undefined,
    ensureTaskQueueSeeded: async () => undefined,
    listTasks: async () => [],
    mapTaskQueueRecordToTaskSummary: () => ({}),
    buildTaskSummarySnapshot: async () => [],
    getShapeEntityHandler: () => ({ getEntity: async () => null }),
    getPauseState: () => ({ paused: false, waiters: [] }),
    buildTaskQueueSummary: async () => ({ progress: { percentage: 0, total: 0, completed: 0, failed: 0, skipped: 0 }, status: 'idle' }),
    onTaskQueueUpdate: () => () => {},
  },
}));

import { shapeBuildAPI } from '../../worker/api/shapeBuildAPI';

const asNodeId = (value: string): NodeId => value as NodeId;

describe('shapeBuildAPI 4-channel subscriptions', () => {
  beforeEach(() => {
    sessionStateCallbacks.clear();
    stageSnapshotCallbacks.clear();
    heartbeatCallbacks.clear();
    taskProgressCallbacks.clear();
  });

  it('registers and dispatches all subscription channels', () => {
    const nodeId = asNodeId('shape-sub-1');
    const sessionCallback = vi.fn();
    const snapshotCallback = vi.fn();
    const heartbeatCallback = vi.fn();
    const taskProgressCallback = vi.fn();

    const offSession = shapeBuildAPI.subscribeToSessionState(nodeId, sessionCallback as never);
    const offSnapshot = shapeBuildAPI.subscribeToStageSnapshots(nodeId, snapshotCallback as never);
    const offHeartbeat = shapeBuildAPI.subscribeToHeartbeat(nodeId, heartbeatCallback as never);
    const offTaskProgress = shapeBuildAPI.subscribeToTaskProgress(nodeId, taskProgressCallback as never);

    sessionStateCallbacks.get(String(nodeId))?.callback?.({ kind: 'session' });
    stageSnapshotCallbacks.get(String(nodeId))?.callback?.({ kind: 'snapshot' });
    heartbeatCallbacks.get(String(nodeId))?.callback?.({ kind: 'heartbeat' });
    taskProgressCallbacks.get(String(nodeId))?.callback?.({ kind: 'task-progress' });

    expect(sessionCallback).toHaveBeenCalledWith({ kind: 'session' });
    expect(snapshotCallback).toHaveBeenCalledWith({ kind: 'snapshot' });
    expect(heartbeatCallback).toHaveBeenCalledWith({ kind: 'heartbeat' });
    expect(taskProgressCallback).toHaveBeenCalledWith({ kind: 'task-progress' });

    offSession();
    offSnapshot();
    offHeartbeat();
    offTaskProgress();

    expect(sessionStateCallbacks.has(String(nodeId))).toBe(false);
    expect(stageSnapshotCallbacks.has(String(nodeId))).toBe(false);
    expect(heartbeatCallbacks.has(String(nodeId))).toBe(false);
    expect(taskProgressCallbacks.has(String(nodeId))).toBe(false);
  });
});
