/**
 * Integration coverage for the canonical Worker-to-UI delivery contract.
 *
 * - session-state and stage-snapshot are delivered through independent FIFO queues.
 * - task-progress is accepted only when its per-task version advances.
 * - heartbeat bypasses buffering and is delivered synchronously.
 */

import { beforeEach, describe, expect, it } from 'vitest';
import {
  type BufferedEvent,
  ImmediateHeartbeatProcessor,
  UIEventBufferManager,
} from '../../eventBufferingUI';

interface TaskProgressEvent {
  notificationType: 'task-progress';
  taskId: string;
  version: number;
  progress: number;
}

interface HeartbeatEvent {
  notificationType: 'heartbeat';
  nodeId: string;
  heartbeatAt: number;
}

type IncomingEvent = BufferedEvent | TaskProgressEvent | HeartbeatEvent;

interface AcceptedTaskProgress {
  taskId: string;
  version: number;
  progress: number;
}

const unreachableEvent = (event: never): never => {
  throw new Error(`Unhandled event: ${JSON.stringify(event)}`);
};

describe('canonical Worker-to-UI event delivery', () => {
  let bufferManager: UIEventBufferManager;
  let acceptedTaskProgress: AcceptedTaskProgress[];
  let receivedHeartbeats: Array<{ nodeId: string; heartbeatAt?: number }>;
  let heartbeatProcessor: ImmediateHeartbeatProcessor;

  beforeEach(() => {
    bufferManager = new UIEventBufferManager();
    acceptedTaskProgress = [];
    receivedHeartbeats = [];
    heartbeatProcessor = new ImmediateHeartbeatProcessor((event) => {
      receivedHeartbeats.push(event);
    });
  });

  const receive = (event: IncomingEvent): void => {
    switch (event.notificationType) {
      case 'session-state':
      case 'stage-snapshot':
        bufferManager.enqueue(event);
        return;
      case 'task-progress':
        if (bufferManager.applyTaskProgress(event.taskId, event.version)) {
          acceptedTaskProgress.push({
            taskId: event.taskId,
            version: event.version,
            progress: event.progress,
          });
        }
        return;
      case 'heartbeat':
        heartbeatProcessor.processHeartbeat({
          nodeId: event.nodeId,
          heartbeatAt: event.heartbeatAt,
        });
        return;
      default:
        unreachableEvent(event);
    }
  };

  it('routes an interleaved event stream through each canonical delivery path', () => {
    const baseTimestamp = 1_000;
    const events: IncomingEvent[] = [
      {
        notificationType: 'session-state',
        payload: { status: 'starting' },
        timestamp: baseTimestamp,
      },
      {
        notificationType: 'task-progress',
        taskId: 'source:JP',
        version: 1,
        progress: 10,
      },
      {
        notificationType: 'heartbeat',
        nodeId: 'node-1',
        heartbeatAt: baseTimestamp + 2,
      },
      {
        notificationType: 'stage-snapshot',
        payload: { stage: 'source', taskCount: 1 },
        timestamp: baseTimestamp + 3,
      },
      {
        notificationType: 'task-progress',
        taskId: 'source:JP',
        version: 2,
        progress: 40,
      },
      {
        notificationType: 'session-state',
        payload: { status: 'running' },
        timestamp: baseTimestamp + 5,
      },
    ];

    events.forEach(receive);

    expect(receivedHeartbeats).toEqual([{ nodeId: 'node-1', heartbeatAt: baseTimestamp + 2 }]);
    expect(acceptedTaskProgress).toEqual([
      { taskId: 'source:JP', version: 1, progress: 10 },
      { taskId: 'source:JP', version: 2, progress: 40 },
    ]);
    expect(bufferManager.flushFifo('session-state').map((event) => event.payload)).toEqual([
      { status: 'starting' },
      { status: 'running' },
    ]);
    expect(bufferManager.flushFifo('stage-snapshot').map((event) => event.payload)).toEqual([
      { stage: 'source', taskCount: 1 },
    ]);
  });

  it('keeps session and stage FIFO queues independent and drains them on flush', () => {
    receive({
      notificationType: 'stage-snapshot',
      payload: { stage: 'source' },
      timestamp: 1,
    });
    receive({
      notificationType: 'session-state',
      payload: { status: 'running' },
      timestamp: 2,
    });
    receive({
      notificationType: 'stage-snapshot',
      payload: { stage: 'geometry' },
      timestamp: 3,
    });

    expect(bufferManager.flushFifo('session-state').map((event) => event.payload)).toEqual([
      { status: 'running' },
    ]);
    expect(bufferManager.flushFifo('stage-snapshot').map((event) => event.payload)).toEqual([
      { stage: 'source' },
      { stage: 'geometry' },
    ]);
    expect(bufferManager.flushFifo('session-state')).toEqual([]);
    expect(bufferManager.flushFifo('stage-snapshot')).toEqual([]);
  });

  it('applies task progress only when the version advances for that task', () => {
    const taskEvents: TaskProgressEvent[] = [
      { notificationType: 'task-progress', taskId: 'task-A', version: 3, progress: 30 },
      { notificationType: 'task-progress', taskId: 'task-A', version: 2, progress: 20 },
      { notificationType: 'task-progress', taskId: 'task-B', version: 1, progress: 10 },
      { notificationType: 'task-progress', taskId: 'task-A', version: 3, progress: 35 },
      { notificationType: 'task-progress', taskId: 'task-A', version: 4, progress: 40 },
      { notificationType: 'task-progress', taskId: 'task-B', version: 2, progress: 20 },
    ];

    taskEvents.forEach(receive);

    expect(acceptedTaskProgress).toEqual([
      { taskId: 'task-A', version: 3, progress: 30 },
      { taskId: 'task-B', version: 1, progress: 10 },
      { taskId: 'task-A', version: 4, progress: 40 },
      { taskId: 'task-B', version: 2, progress: 20 },
    ]);
  });

  it('delivers heartbeat synchronously without touching buffered event state', () => {
    receive({
      notificationType: 'session-state',
      payload: { status: 'running' },
      timestamp: 1,
    });

    receive({ notificationType: 'heartbeat', nodeId: 'node-1', heartbeatAt: 2 });

    expect(receivedHeartbeats).toEqual([{ nodeId: 'node-1', heartbeatAt: 2 }]);
    expect(bufferManager.flushFifo('session-state').map((event) => event.payload)).toEqual([
      { status: 'running' },
    ]);
    expect(bufferManager.flushFifo('stage-snapshot')).toEqual([]);
  });
});
