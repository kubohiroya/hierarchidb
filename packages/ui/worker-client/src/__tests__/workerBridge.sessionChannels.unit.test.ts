import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { NodeId, NodeType } from '@hierarchidb/core-types';
import type { BuildProgressEvent, BuildTaskUpdateEvent } from '@hierarchidb/build-api';
import { __setWorkerBridgeClientRef, getBuildWorkerBridge } from '../workerBridge';

const SHAPE_NODE_TYPE = 'shape' as NodeType;
const FOLDER_NODE_TYPE = 'folder' as NodeType;
const NODE_ID = 'node-1' as NodeId;

describe('WorkerBridge subscribeAll', () => {
  let subscribeToSessionStateMock: ReturnType<typeof vi.fn>;
  let subscribeToHeartbeatMock: ReturnType<typeof vi.fn>;
  let subscribeToWorkerLogMock: ReturnType<typeof vi.fn>;
  let subscribeBuildTasksMock: ReturnType<typeof vi.fn>;
  let subscribeBuildProgressMock: ReturnType<typeof vi.fn>;
  let getShapeQueryAPIMock: ReturnType<typeof vi.fn>;

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

    subscribeBuildTasksMock = vi.fn(async (_nodeType: NodeType, _nodeId: NodeId, callback: (event: unknown) => void) => {
      taskEventProxyCallback = callback;
      return tasksUnsubscribeMock;
    });

    subscribeBuildProgressMock = vi.fn(async (_nodeType: NodeType, _nodeId: NodeId, callback: (event: unknown) => void) => {
      progressEventProxyCallback = callback;
      return progressUnsubscribeMock;
    });

    subscribeToSessionStateMock = vi.fn(async (_nodeId: NodeId, callback: (event: unknown) => void) => {
      sessionStateProxyCallback = callback;
      return sessionStateUnsubscribeMock;
    });

    subscribeToHeartbeatMock = vi.fn(async (_nodeId: NodeId, callback: (event: unknown) => void) => {
      heartbeatProxyCallback = callback;
      return heartbeatUnsubscribeMock;
    });

    subscribeToWorkerLogMock = vi.fn(async (_nodeId: NodeId, callback: (event: unknown) => void) => {
      workerLogProxyCallback = callback;
      return workerLogUnsubscribeMock;
    });

    getShapeQueryAPIMock = vi.fn(async () => ({
      subscribeToSessionState: subscribeToSessionStateMock,
      subscribeToHeartbeat: subscribeToHeartbeatMock,
      subscribeToWorkerLog: subscribeToWorkerLogMock,
    }));

    __setWorkerBridgeClientRef({
      client: {
        subscribeBuildTasks: subscribeBuildTasksMock,
        subscribeBuildProgress: subscribeBuildProgressMock,
        getShapeQueryAPI: getShapeQueryAPIMock,
      } as never,
      isInitialized: true,
      initialize: async () => { },
      getAPI: () => ({
        subscribeBuildTasks: subscribeBuildTasksMock,
        subscribeBuildProgress: subscribeBuildProgressMock,
        getShapeQueryAPI: getShapeQueryAPIMock,
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

    expect(subscribeBuildTasksMock).toHaveBeenCalledTimes(1);
    expect(subscribeBuildProgressMock).toHaveBeenCalledTimes(1);
    expect(subscribeToSessionStateMock).toHaveBeenCalledTimes(1);
    expect(subscribeToHeartbeatMock).toHaveBeenCalledTimes(1);
    expect(subscribeToWorkerLogMock).toHaveBeenCalledTimes(1);

    const taskEvent = { type: 'snapshot', nodeId: NODE_ID, tasks: [] } as unknown as BuildTaskUpdateEvent;
    taskEventProxyCallback?.(taskEvent);
    expect(onTaskEvent).toHaveBeenCalledWith(expect.objectContaining({ type: 'snapshot' }));

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

    expect(subscribeBuildTasksMock).toHaveBeenCalledTimes(1);
    expect(subscribeBuildProgressMock).toHaveBeenCalledTimes(1);
    expect(getShapeQueryAPIMock).not.toHaveBeenCalled();

    expect(() => unsubscribe()).not.toThrow();
    expect(tasksUnsubscribeMock).toHaveBeenCalledTimes(1);
    expect(progressUnsubscribeMock).toHaveBeenCalledTimes(1);
  });

  it('does not expose individual subscribeSessionHeartbeat or subscribeTaskProgress on bridge', () => {
    const bridge = getBuildWorkerBridge() as Record<string, unknown>;
    expect(bridge['subscribeSessionHeartbeat']).toBeUndefined();
    expect(bridge['subscribeTaskProgress']).toBeUndefined();
  });
});
