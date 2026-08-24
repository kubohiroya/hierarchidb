import type { TaskProgressUpdatedEvent } from '@hierarchidb/build-api';
import type { NodeId, NodeType } from '@hierarchidb/core-types';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { __setWorkerBridgeClientRef, getBuildWorkerBridge } from '../workerBridge';

const SHAPE_NODE_TYPE = 'shape' as NodeType;
const FOLDER_NODE_TYPE = 'folder' as NodeType;
const NODE_ID = 'node-1' as NodeId;

describe('WorkerBridge subscribeAll', () => {
  let startBuildSessionMock: ReturnType<typeof vi.fn>;
  let runStagedFolderActionMock: ReturnType<typeof vi.fn>;
  let subscribeSessionStateMock: ReturnType<typeof vi.fn>;
  let subscribeSessionHeartbeatMock: ReturnType<typeof vi.fn>;
  let subscribeWorkerLogMock: ReturnType<typeof vi.fn>;
  let subscribeStageSnapshotsMock: ReturnType<typeof vi.fn>;
  let subscribeTaskProgressMock: ReturnType<typeof vi.fn>;

  let taskEventProxyCallback: ((event: unknown) => void) | null;
  let progressEventProxyCallback: ((event: unknown) => void) | null;
  let sessionStateProxyCallback: ((event: unknown) => void) | null;
  let heartbeatProxyCallback: ((event: unknown) => void) | null;

  let tasksUnsubscribeMock: ReturnType<typeof vi.fn>;
  let progressUnsubscribeMock: ReturnType<typeof vi.fn>;
  let sessionStateUnsubscribeMock: ReturnType<typeof vi.fn>;
  let heartbeatUnsubscribeMock: ReturnType<typeof vi.fn>;
  let workerLogUnsubscribeMock: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    startBuildSessionMock = vi.fn(async () => ({
      nodeId: NODE_ID,
      status: 'running',
      progress: { total: 0, completed: 0, failed: 0, skipped: 0, percentage: 0 },
    }));
    runStagedFolderActionMock = vi.fn(async (input) => ({
      runId: input.runId,
      sourceNodeId: input.sourceNodeId,
      status: 'completed',
      phase: 'completed',
      progress: { total: 0, completed: 0, failed: 0, skipped: 0, percentage: 100 },
      startedAt: 1,
      updatedAt: 2,
      completedAt: 2,
      revision: 1,
    }));
    taskEventProxyCallback = null;
    progressEventProxyCallback = null;
    sessionStateProxyCallback = null;
    heartbeatProxyCallback = null;

    tasksUnsubscribeMock = vi.fn();
    progressUnsubscribeMock = vi.fn();
    sessionStateUnsubscribeMock = vi.fn();
    heartbeatUnsubscribeMock = vi.fn();
    workerLogUnsubscribeMock = vi.fn();

    // subscribeAll acquires the authoritative stage snapshot channel for task state.
    subscribeStageSnapshotsMock = vi.fn(
      async (_nodeType: NodeType, _nodeId: NodeId, callback: (event: unknown) => void) => {
        taskEventProxyCallback = callback;
        return tasksUnsubscribeMock;
      }
    );

    subscribeTaskProgressMock = vi.fn(
      async (_nodeType: NodeType, _nodeId: NodeId, callback: (event: unknown) => void) => {
        progressEventProxyCallback = callback;
        return progressUnsubscribeMock;
      }
    );

    // WorkerApi direct methods: subscribeSessionState(nodeType, nodeId, cb)
    subscribeSessionStateMock = vi.fn(
      async (_nodeType: NodeType, _nodeId: NodeId, callback: (event: unknown) => void) => {
        sessionStateProxyCallback = callback;
        return sessionStateUnsubscribeMock;
      }
    );

    subscribeSessionHeartbeatMock = vi.fn(
      async (_nodeType: NodeType, _nodeId: NodeId, callback: (event: unknown) => void) => {
        heartbeatProxyCallback = callback;
        return heartbeatUnsubscribeMock;
      }
    );

    subscribeWorkerLogMock = vi.fn(
      async (_nodeType: NodeType, _nodeId: NodeId, _callback: (event: unknown) => void) => {
        return workerLogUnsubscribeMock;
      }
    );

    __setWorkerBridgeClientRef({
      client: {
        startBuildSession: startBuildSessionMock,
        runStagedFolderAction: runStagedFolderActionMock,
        subscribeStageSnapshots: subscribeStageSnapshotsMock,
        subscribeTaskProgress: subscribeTaskProgressMock,
        subscribeSessionState: subscribeSessionStateMock,
        subscribeSessionHeartbeat: subscribeSessionHeartbeatMock,
        subscribeWorkerLog: subscribeWorkerLogMock,
      } as never,
      isInitialized: true,
      initialize: async () => {},
      getAPI: () =>
        ({
          subscribeStageSnapshots: subscribeStageSnapshotsMock,
          startBuildSession: startBuildSessionMock,
          runStagedFolderAction: runStagedFolderActionMock,
          subscribeTaskProgress: subscribeTaskProgressMock,
          subscribeSessionState: subscribeSessionStateMock,
          subscribeSessionHeartbeat: subscribeSessionHeartbeatMock,
          subscribeWorkerLog: subscribeWorkerLogMock,
        }) as never,
    });
  });

  afterEach(() => {
    __setWorkerBridgeClientRef(null);
  });

  it('forwards staged-folder-action execution requests to WorkerAPI', async () => {
    const bridge = getBuildWorkerBridge();
    const input = {
      runId: 'run-1' as NodeId,
      sourceNodeId: NODE_ID,
      config: {
        version: 1,
        staging: { mode: 'patch-source', cleanup: 'retain' },
        overlay: { nodes: [] },
        actions: [],
      },
    } as const;

    const result = await bridge.runStagedFolderAction(input);

    expect(runStagedFolderActionMock).toHaveBeenCalledWith(input);
    expect(result.runId).toBe('run-1');
    expect(result.status).toBe('completed');
  });

  it('subscribes the four canonical channels and routes events to correct handlers', async () => {
    const bridge = getBuildWorkerBridge();
    const onTaskEvent = vi.fn();
    const onProgressEvent = vi.fn();
    const onSessionState = vi.fn();
    const onHeartbeat = vi.fn();

    const unsubscribe = await bridge.subscribeAll(SHAPE_NODE_TYPE, NODE_ID, {
      onTaskEvent,
      onProgressEvent,
      onSessionState,
      onHeartbeat,
    });

    expect(subscribeStageSnapshotsMock).toHaveBeenCalledTimes(1);
    expect(subscribeTaskProgressMock).toHaveBeenCalledTimes(1);
    expect(subscribeSessionStateMock).toHaveBeenCalledTimes(1);
    expect(subscribeSessionHeartbeatMock).toHaveBeenCalledTimes(1);
    expect(subscribeWorkerLogMock).not.toHaveBeenCalled();

    const taskEvent = { type: 'stageSnapshotUpdated', payload: { stageId: 'source', tasks: [] } };
    taskEventProxyCallback?.(taskEvent);
    expect(onTaskEvent).toHaveBeenCalledWith(
      expect.objectContaining({ type: 'stageSnapshotUpdated' })
    );

    const progressEvent: TaskProgressUpdatedEvent = {
      type: 'taskProgressUpdated',
      payload: {
        taskId: 'task-1',
        version: 1,
        stageId: 'source',
        value: 50,
      },
    };
    progressEventProxyCallback?.(progressEvent);
    expect(onProgressEvent).toHaveBeenCalledWith(progressEvent);

    sessionStateProxyCallback?.({ nodeId: NODE_ID, sessionRecord: { stageId: 'geometry' } });
    expect(onSessionState).toHaveBeenCalledWith(expect.objectContaining({ nodeId: NODE_ID }));

    heartbeatProxyCallback?.({ nodeId: NODE_ID, heartbeatAt: 200n });
    expect(onHeartbeat).toHaveBeenCalledWith(expect.objectContaining({ heartbeatAt: '200' }));

    unsubscribe();
    expect(tasksUnsubscribeMock).toHaveBeenCalledTimes(1);
    expect(progressUnsubscribeMock).toHaveBeenCalledTimes(1);
    expect(sessionStateUnsubscribeMock).toHaveBeenCalledTimes(1);
    expect(heartbeatUnsubscribeMock).toHaveBeenCalledTimes(1);
    expect(workerLogUnsubscribeMock).not.toHaveBeenCalled();
  });

  it('forwards explicit start input source to the Worker API', async () => {
    const bridge = getBuildWorkerBridge();

    await bridge.startBuildSession(SHAPE_NODE_TYPE, NODE_ID, 'committed');
    await bridge.startBuildSession(SHAPE_NODE_TYPE, NODE_ID, 'working-copy');

    expect(startBuildSessionMock).toHaveBeenNthCalledWith(1, SHAPE_NODE_TYPE, NODE_ID, 'committed');
    expect(startBuildSessionMock).toHaveBeenNthCalledWith(
      2,
      SHAPE_NODE_TYPE,
      NODE_ID,
      'working-copy'
    );
  });

  it('subscribes all channels for non-shape node types', async () => {
    const bridge = getBuildWorkerBridge();
    const onTaskEvent = vi.fn();
    const onProgressEvent = vi.fn();
    const onSessionState = vi.fn();
    const onHeartbeat = vi.fn();

    const unsubscribe = await bridge.subscribeAll(FOLDER_NODE_TYPE, NODE_ID, {
      onTaskEvent,
      onProgressEvent,
      onSessionState,
      onHeartbeat,
    });

    // subscribeAll is restricted to the four canonical channels regardless of nodeType.
    expect(subscribeStageSnapshotsMock).toHaveBeenCalledTimes(1);
    expect(subscribeTaskProgressMock).toHaveBeenCalledTimes(1);
    expect(subscribeSessionStateMock).toHaveBeenCalledTimes(1);
    expect(subscribeSessionHeartbeatMock).toHaveBeenCalledTimes(1);
    expect(subscribeWorkerLogMock).not.toHaveBeenCalled();

    expect(() => unsubscribe()).not.toThrow();
    expect(tasksUnsubscribeMock).toHaveBeenCalledTimes(1);
    expect(progressUnsubscribeMock).toHaveBeenCalledTimes(1);
    expect(sessionStateUnsubscribeMock).toHaveBeenCalledTimes(1);
    expect(heartbeatUnsubscribeMock).toHaveBeenCalledTimes(1);
    expect(workerLogUnsubscribeMock).not.toHaveBeenCalled();
  });

  it('disposes every acquired channel when subscription setup fails', async () => {
    const subscriptionError = new Error('session state subscription failed');
    subscribeSessionStateMock.mockRejectedValueOnce(subscriptionError);
    const bridge = getBuildWorkerBridge();

    await expect(
      bridge.subscribeAll(SHAPE_NODE_TYPE, NODE_ID, {
        onTaskEvent: vi.fn(),
        onProgressEvent: vi.fn(),
        onSessionState: vi.fn(),
        onHeartbeat: vi.fn(),
      })
    ).rejects.toBe(subscriptionError);

    expect(tasksUnsubscribeMock).toHaveBeenCalledTimes(1);
    expect(progressUnsubscribeMock).toHaveBeenCalledTimes(1);
    expect(sessionStateUnsubscribeMock).not.toHaveBeenCalled();
    expect(heartbeatUnsubscribeMock).toHaveBeenCalledTimes(1);
    expect(workerLogUnsubscribeMock).not.toHaveBeenCalled();
  });

  it('disposes a channel that resolves after another subscription failed', async () => {
    let resolveTaskSubscription: ((unsubscribe: () => void) => void) | null = null;
    subscribeStageSnapshotsMock.mockImplementationOnce(
      async (_nodeType: NodeType, _nodeId: NodeId, callback: (event: unknown) => void) => {
        taskEventProxyCallback = callback;
        return new Promise<() => void>((resolve) => {
          resolveTaskSubscription = resolve;
        });
      }
    );
    const subscriptionError = new Error('session state subscription failed');
    subscribeSessionStateMock.mockRejectedValueOnce(subscriptionError);
    const bridge = getBuildWorkerBridge();

    await expect(
      bridge.subscribeAll(SHAPE_NODE_TYPE, NODE_ID, {
        onTaskEvent: vi.fn(),
        onProgressEvent: vi.fn(),
        onSessionState: vi.fn(),
        onHeartbeat: vi.fn(),
      })
    ).rejects.toBe(subscriptionError);

    const resolvePendingSubscription = resolveTaskSubscription;
    if (!resolvePendingSubscription) {
      throw new Error('Task subscription resolver was not registered.');
    }
    resolvePendingSubscription(tasksUnsubscribeMock);

    await vi.waitFor(() => {
      expect(tasksUnsubscribeMock).toHaveBeenCalledTimes(1);
    });
  });

  it('exposes task-progress subscription and delegates delivery', async () => {
    const bridge = getBuildWorkerBridge();
    const onProgressEvent = vi.fn();
    const unsubscribe = await bridge.subscribeTaskProgress(
      SHAPE_NODE_TYPE,
      NODE_ID,
      onProgressEvent
    );
    const progressEvent: TaskProgressUpdatedEvent = {
      type: 'taskProgressUpdated',
      payload: {
        taskId: 'task-2',
        version: 2,
        stageId: 'geometry',
        value: 75,
      },
    };

    expect(subscribeTaskProgressMock).toHaveBeenCalledTimes(1);
    progressEventProxyCallback?.(progressEvent);
    expect(onProgressEvent).toHaveBeenCalledWith(progressEvent);

    unsubscribe();
    expect(progressUnsubscribeMock).toHaveBeenCalledTimes(1);
    expect(
      (bridge as unknown as Record<string, unknown>).subscribeSessionHeartbeat
    ).toBeUndefined();
  });
});
