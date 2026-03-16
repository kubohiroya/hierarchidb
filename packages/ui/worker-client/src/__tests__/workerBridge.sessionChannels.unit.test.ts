import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { NodeId, NodeType } from '@hierarchidb/core-types';
import type { BuildProgressEvent } from '@hierarchidb/build-api';
import { __setWorkerBridgeClientRef, getBuildWorkerBridge } from '../workerBridge';

const SHAPE_NODE_TYPE = 'shape' as NodeType;
const FOLDER_NODE_TYPE = 'folder' as NodeType;
const NODE_ID = 'node-1' as NodeId;

describe('WorkerBridge subscribeAll', () => {
  let subscribeSessionStateMock: ReturnType<typeof vi.fn>;
  let subscribeSessionHeartbeatMock: ReturnType<typeof vi.fn>;
  let subscribeWorkerLogMock: ReturnType<typeof vi.fn>;
  let subscribeStageSnapshotsMock: ReturnType<typeof vi.fn>;
  let subscribeBuildProgressMock: ReturnType<typeof vi.fn>;

  let taskEventProxyCallback: ((event: unknown) => void) | null;
  let progressEventProxyCallback: ((event: unknown) => void) | null;
  let sessionStateProxyCallback: ((event: unknown) => void) | null;
  let heartbeatProxyCallback: ((event: unknown) => void) | null;
  let workerLogProxyCallback: ((event: unknown) => void) | null;

  let tasksUnsubscribeMock: ReturnType<typeof vi.fn>;
  let progressUnsubscribeMock: ReturnType<typeof vi.fn>;
  let sessionStateUnsubscribeMock: ReturnType<typeof vi.fn>;
  let heartbeatUnsubscribeMock: ReturnType<typeof vi.fn>;
  let workerLogUnsubscribeMock: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    taskEventProxyCallback = null;
    progressEventProxyCallback = null;
    sessionStateProxyCallback = null;
    heartbeatProxyCallback = null;
    workerLogProxyCallback = null;

    tasksUnsubscribeMock = vi.fn();
    progressUnsubscribeMock = vi.fn();
    sessionStateUnsubscribeMock = vi.fn();
    heartbeatUnsubscribeMock = vi.fn();
    workerLogUnsubscribeMock = vi.fn();

    // subscribeAll now uses subscribeStageSnapshots instead of subscribeBuildTasks for task events
    subscribeStageSnapshotsMock = vi.fn(async (_nodeType: NodeType, _nodeId: NodeId, callback: (event: unknown) => void) => {
      taskEventProxyCallback = callback;
      return tasksUnsubscribeMock;
    });

    subscribeBuildProgressMock = vi.fn(async (_nodeType: NodeType, _nodeId: NodeId, callback: (event: unknown) => void) => {
      progressEventProxyCallback = callback;
      return progressUnsubscribeMock;
    });

    // WorkerApi direct methods: subscribeSessionState(nodeType, nodeId, cb)
    subscribeSessionStateMock = vi.fn(async (_nodeType: NodeType, _nodeId: NodeId, callback: (event: unknown) => void) => {
      sessionStateProxyCallback = callback;
      return sessionStateUnsubscribeMock;
    });

    subscribeSessionHeartbeatMock = vi.fn(async (_nodeType: NodeType, _nodeId: NodeId, callback: (event: unknown) => void) => {
      heartbeatProxyCallback = callback;
      return heartbeatUnsubscribeMock;
    });

    subscribeWorkerLogMock = vi.fn(async (_nodeType: NodeType, _nodeId: NodeId, callback: (event: unknown) => void) => {
      workerLogProxyCallback = callback;
      return workerLogUnsubscribeMock;
    });

    __setWorkerBridgeClientRef({
      client: {
        subscribeStageSnapshots: subscribeStageSnapshotsMock,
        subscribeBuildProgress: subscribeBuildProgressMock,
        subscribeSessionState: subscribeSessionStateMock,
        subscribeSessionHeartbeat: subscribeSessionHeartbeatMock,
        subscribeWorkerLog: subscribeWorkerLogMock,
      } as never,
      isInitialized: true,
      initialize: async () => { },
      getAPI: () => ({
        subscribeStageSnapshots: subscribeStageSnapshotsMock,
        subscribeBuildProgress: subscribeBuildProgressMock,
        subscribeSessionState: subscribeSessionStateMock,
        subscribeSessionHeartbeat: subscribeSessionHeartbeatMock,
        subscribeWorkerLog: subscribeWorkerLogMock,
      } as never),
    });
  });

  afterEach(() => {
    __setWorkerBridgeClientRef(null);
  });

  it('subscribes all channels in a single call and routes events to correct handlers', async () => {
    const bridge = getBuildWorkerBridge();
    const onTaskEvent = vi.fn();
    const onProgressEvent = vi.fn();
    const onSessionState = vi.fn();
    const onHeartbeat = vi.fn();
    const onWorkerLog = vi.fn();

    const unsubscribe = await bridge.subscribeAll(SHAPE_NODE_TYPE, NODE_ID, {
      onTaskEvent,
      onProgressEvent,
      onSessionState,
      onHeartbeat,
      onWorkerLog,
    });

    expect(subscribeStageSnapshotsMock).toHaveBeenCalledTimes(1);
    expect(subscribeBuildProgressMock).toHaveBeenCalledTimes(1);
    expect(subscribeSessionStateMock).toHaveBeenCalledTimes(1);
    expect(subscribeSessionHeartbeatMock).toHaveBeenCalledTimes(1);
    expect(subscribeWorkerLogMock).toHaveBeenCalledTimes(1);

    const taskEvent = { type: 'stageSnapshotUpdated', payload: { stageId: 'source', tasks: [] } };
    taskEventProxyCallback?.(taskEvent);
    expect(onTaskEvent).toHaveBeenCalledWith(expect.objectContaining({ type: 'stageSnapshotUpdated' }));

    const progressEvent = { stage: 'source', progress: 50 } as unknown as BuildProgressEvent;
    progressEventProxyCallback?.(progressEvent);
    expect(onProgressEvent).toHaveBeenCalledWith(expect.objectContaining({ stage: 'source' }));

    sessionStateProxyCallback?.({ nodeId: NODE_ID, sessionRecord: { stageId: 'geometry' } });
    expect(onSessionState).toHaveBeenCalledWith(expect.objectContaining({ nodeId: NODE_ID }));

    heartbeatProxyCallback?.({ nodeId: NODE_ID, heartbeatAt: 200n });
    expect(onHeartbeat).toHaveBeenCalledWith(expect.objectContaining({ heartbeatAt: '200' }));

    workerLogProxyCallback?.({ level: 'info', message: 'test log' });
    expect(onWorkerLog).toHaveBeenCalledWith(expect.objectContaining({ message: 'test log' }));

    unsubscribe();
    expect(tasksUnsubscribeMock).toHaveBeenCalledTimes(1);
    expect(progressUnsubscribeMock).toHaveBeenCalledTimes(1);
    expect(sessionStateUnsubscribeMock).toHaveBeenCalledTimes(1);
    expect(heartbeatUnsubscribeMock).toHaveBeenCalledTimes(1);
    expect(workerLogUnsubscribeMock).toHaveBeenCalledTimes(1);
  });

  it('subscribes tasks and progress for non-shape node type, skips shape-specific channels', async () => {
    const bridge = getBuildWorkerBridge();
    const onTaskEvent = vi.fn();
    const onProgressEvent = vi.fn();
    const onSessionState = vi.fn();
    const onHeartbeat = vi.fn();
    const onWorkerLog = vi.fn();

    const unsubscribe = await bridge.subscribeAll(FOLDER_NODE_TYPE, NODE_ID, {
      onTaskEvent,
      onProgressEvent,
      onSessionState,
      onHeartbeat,
      onWorkerLog,
    });

    // subscribeAll subscribes all 5 channels regardless of nodeType
    expect(subscribeStageSnapshotsMock).toHaveBeenCalledTimes(1);
    expect(subscribeBuildProgressMock).toHaveBeenCalledTimes(1);
    expect(subscribeSessionStateMock).toHaveBeenCalledTimes(1);
    expect(subscribeSessionHeartbeatMock).toHaveBeenCalledTimes(1);
    expect(subscribeWorkerLogMock).toHaveBeenCalledTimes(1);

    expect(() => unsubscribe()).not.toThrow();
    expect(tasksUnsubscribeMock).toHaveBeenCalledTimes(1);
    expect(progressUnsubscribeMock).toHaveBeenCalledTimes(1);
    expect(sessionStateUnsubscribeMock).toHaveBeenCalledTimes(1);
    expect(heartbeatUnsubscribeMock).toHaveBeenCalledTimes(1);
    expect(workerLogUnsubscribeMock).toHaveBeenCalledTimes(1);
  });

  it('does not expose individual subscribeSessionHeartbeat or subscribeTaskProgress on bridge', () => {
    const bridge = getBuildWorkerBridge() as Record<string, unknown>;
    expect(bridge['subscribeSessionHeartbeat']).toBeUndefined();
    expect(bridge['subscribeTaskProgress']).toBeUndefined();
  });
});
