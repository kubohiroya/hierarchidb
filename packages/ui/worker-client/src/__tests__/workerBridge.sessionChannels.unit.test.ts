import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { NodeId, NodeType } from '@hierarchidb/core-types';
import { __setWorkerBridgeClientRef, getBuildWorkerBridge } from '../workerBridge';

const SHAPE_NODE_TYPE = 'shape' as NodeType;
const FOLDER_NODE_TYPE = 'folder' as NodeType;
const NODE_ID = 'node-1' as NodeId;

describe('WorkerBridge session channels', () => {
  let subscribeToSessionStateMock: ReturnType<typeof vi.fn>;
  let subscribeToHeartbeatMock: ReturnType<typeof vi.fn>;
  let subscribeToTaskProgressMock: ReturnType<typeof vi.fn>;
  let getShapeQueryAPIMock: ReturnType<typeof vi.fn>;
  let sessionStateProxyCallback: ((event: unknown) => void) | null;
  let heartbeatProxyCallback: ((event: unknown) => void) | null;
  let taskProgressProxyCallback: ((event: unknown) => void) | null;
  let sessionStateUnsubscribeMock: ReturnType<typeof vi.fn>;
  let heartbeatUnsubscribeMock: ReturnType<typeof vi.fn>;
  let taskProgressUnsubscribeMock: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    sessionStateProxyCallback = null;
    heartbeatProxyCallback = null;
    taskProgressProxyCallback = null;
    sessionStateUnsubscribeMock = vi.fn();
    heartbeatUnsubscribeMock = vi.fn();
    taskProgressUnsubscribeMock = vi.fn();

    subscribeToSessionStateMock = vi.fn(async (_nodeId: NodeId, callback: (event: unknown) => void) => {
      sessionStateProxyCallback = callback;
      return sessionStateUnsubscribeMock;
    });

    subscribeToHeartbeatMock = vi.fn(async (_nodeId: NodeId, callback: (event: unknown) => void) => {
      heartbeatProxyCallback = callback;
      return heartbeatUnsubscribeMock;
    });

    subscribeToTaskProgressMock = vi.fn(async (_nodeId: NodeId, callback: (event: unknown) => void) => {
      taskProgressProxyCallback = callback;
      return taskProgressUnsubscribeMock;
    });

    getShapeQueryAPIMock = vi.fn(async () => ({
      subscribeToSessionState: subscribeToSessionStateMock,
      subscribeToHeartbeat: subscribeToHeartbeatMock,
      subscribeToTaskProgress: subscribeToTaskProgressMock,
    }));

    __setWorkerBridgeClientRef({
      client: {
        getShapeQueryAPI: getShapeQueryAPIMock,
      } as never,
      isInitialized: true,
      initialize: async () => {
        // no-op
      },
      getAPI: () => ({
        getShapeQueryAPI: getShapeQueryAPIMock,
      } as never),
    });
  });

  afterEach(() => {
    __setWorkerBridgeClientRef(null);
  });

  it('forwards session-state events from worker to UI callback', async () => {
    const bridge = getBuildWorkerBridge();
    const callback = vi.fn();

    const unsubscribe = await bridge.subscribeSessionState(SHAPE_NODE_TYPE, NODE_ID, callback);

    expect(getShapeQueryAPIMock).toHaveBeenCalledTimes(1);
    expect(subscribeToSessionStateMock).toHaveBeenCalledTimes(1);

    sessionStateProxyCallback?.({
      nodeId: NODE_ID,
      timestamp: 123n,
      sessionRecord: {
        nodeId: NODE_ID,
        status: 'running',
        stageId: 'geometry',
      },
    });

    expect(callback).toHaveBeenCalledWith(
      expect.objectContaining({
        nodeId: NODE_ID,
        timestamp: '123',
      }),
    );

    unsubscribe();
    expect(sessionStateUnsubscribeMock).toHaveBeenCalledTimes(1);
  });

  it('forwards heartbeat and task-progress events from worker to UI callback', async () => {
    const bridge = getBuildWorkerBridge();
    const heartbeatCallback = vi.fn();
    const taskProgressCallback = vi.fn();

    const unsubscribeHeartbeat = await bridge.subscribeSessionHeartbeat(
      SHAPE_NODE_TYPE,
      NODE_ID,
      heartbeatCallback,
    );
    const unsubscribeTaskProgress = await bridge.subscribeTaskProgress(
      SHAPE_NODE_TYPE,
      NODE_ID,
      taskProgressCallback,
    );

    expect(subscribeToHeartbeatMock).toHaveBeenCalledTimes(1);
    expect(subscribeToTaskProgressMock).toHaveBeenCalledTimes(1);

    heartbeatProxyCallback?.({ nodeId: NODE_ID, heartbeatAt: 200n });
    taskProgressProxyCallback?.({ nodeId: NODE_ID, taskId: 't1', progress: 40, sequence: 10n });

    expect(heartbeatCallback).toHaveBeenCalledWith(
      expect.objectContaining({
        heartbeatAt: '200',
      }),
    );
    expect(taskProgressCallback).toHaveBeenCalledWith(
      expect.objectContaining({
        taskId: 't1',
        progress: 40,
        sequence: '10',
      }),
    );

    unsubscribeHeartbeat();
    unsubscribeTaskProgress();
    expect(heartbeatUnsubscribeMock).toHaveBeenCalledTimes(1);
    expect(taskProgressUnsubscribeMock).toHaveBeenCalledTimes(1);
  });

  it('returns no-op unsubscribe for non-shape node type', async () => {
    const bridge = getBuildWorkerBridge();
    const callback = vi.fn();

    const unsubscribe = await bridge.subscribeSessionState(FOLDER_NODE_TYPE, NODE_ID, callback);

    expect(getShapeQueryAPIMock).not.toHaveBeenCalled();
    expect(() => unsubscribe()).not.toThrow();
  });

  it('does not expose a dedicated stage-snapshot subscription API on bridge', () => {
    const bridge = getBuildWorkerBridge() as { subscribeStageSnapshots?: unknown };
    expect(bridge.subscribeStageSnapshots).toBeUndefined();
  });
});
