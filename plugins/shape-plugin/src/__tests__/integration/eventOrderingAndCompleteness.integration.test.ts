import type {
  HeartbeatEvent,
  SessionStatusUpdatedEvent,
  StageSnapshotUpdatedEvent,
  TaskProgressUpdatedEvent,
} from '@hierarchidb/build-api';
import type { EventPayload, NotificationType } from '@hierarchidb/build-runtime-services';
import { UnconditionalEventStreamer } from '@hierarchidb/build-runtime-services';
import type { NodeId } from '@hierarchidb/core-types';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import {
  ImmediateHeartbeatProcessor,
  UIEventBufferManager,
} from '../../ui/components/build-progress/eventBufferingUI';

const NODE_ID = 'event-ordering-node' as NodeId;

const createSessionEvent = (
  phase: SessionStatusUpdatedEvent['payload']['phase'],
  isActive: boolean
): SessionStatusUpdatedEvent => ({
  type: 'sessionStatusUpdated',
  payload: {
    nodeId: NODE_ID,
    phase,
    isActive,
    ...(phase === 'starting' ? {} : { startedAt: 1_000 }),
  },
});

const createStageEvent = (
  stageId: StageSnapshotUpdatedEvent['payload']['stageId'],
  stageStartedAt: number
): StageSnapshotUpdatedEvent => ({
  type: 'stageSnapshotUpdated',
  payload: {
    stageId,
    tasks: [],
    stageStartedAt,
    stageInactiveMs: 0,
  },
});

const createProgressEvent = (taskId: string, version: number): TaskProgressUpdatedEvent => ({
  type: 'taskProgressUpdated',
  payload: {
    taskId,
    version,
    stageId: 'source',
    value: version,
  },
});

describe('canonical event ordering and completeness', () => {
  let streamer: UnconditionalEventStreamer;
  let unsubscribers: Array<() => void>;

  beforeEach(() => {
    streamer = new UnconditionalEventStreamer();
    unsubscribers = [];
  });

  afterEach(() => {
    for (const unsubscribe of unsubscribers) {
      unsubscribe();
    }
    streamer.cleanup(NODE_ID);
  });

  const subscribe = (type: NotificationType, callback: (event: EventPayload) => void): void => {
    unsubscribers.push(streamer.subscribe(NODE_ID, type, callback));
  };

  it('preserves FIFO arrival order independently for session and stage snapshots', () => {
    const buffer = new UIEventBufferManager();

    subscribe('session-state', (event) => {
      buffer.enqueue({
        notificationType: 'session-state',
        payload: event,
        timestamp: Date.now(),
      });
    });
    subscribe('stage-snapshot', (event) => {
      buffer.enqueue({
        notificationType: 'stage-snapshot',
        payload: event,
        timestamp: Date.now(),
      });
    });

    const sessionEvents = [
      createSessionEvent('starting', true),
      createSessionEvent('running', true),
      createSessionEvent('pausing', true),
    ];
    const stageEvents = [
      createStageEvent('source', 100),
      createStageEvent('geometry', 200),
      createStageEvent('tileEmit', 300),
    ];

    for (let index = 0; index < sessionEvents.length; index += 1) {
      const sessionEvent = sessionEvents[index];
      const stageEvent = stageEvents[index];
      if (sessionEvent === undefined || stageEvent === undefined) {
        throw new Error('canonical event fixture length mismatch');
      }
      streamer.emitEvent(NODE_ID, 'session-state', sessionEvent);
      streamer.emitEvent(NODE_ID, 'stage-snapshot', stageEvent);
    }

    const receivedSessionPhases = buffer
      .flushFifo('session-state')
      .map(({ payload }) => (payload as SessionStatusUpdatedEvent).payload.phase);
    const receivedStageIds = buffer
      .flushFifo('stage-snapshot')
      .map(({ payload }) => (payload as StageSnapshotUpdatedEvent).payload.stageId);

    expect(receivedSessionPhases).toEqual(['starting', 'running', 'pausing']);
    expect(receivedStageIds).toEqual(['source', 'geometry', 'tileEmit']);
  });

  it('applies task progress versions independently for each task', () => {
    const buffer = new UIEventBufferManager();
    const accepted: Array<{ taskId: string; version: number }> = [];

    subscribe('task-progress', (event) => {
      if (event.type !== 'taskProgressUpdated') {
        throw new Error(`unexpected task progress event: ${event.type}`);
      }
      const { taskId, version } = event.payload;
      if (buffer.applyTaskProgress(taskId, version)) {
        accepted.push({ taskId, version });
      }
    });

    const events = [
      createProgressEvent('task-a', 1),
      createProgressEvent('task-a', 3),
      createProgressEvent('task-a', 2),
      createProgressEvent('task-a', 3),
      createProgressEvent('task-b', 1),
      createProgressEvent('task-b', 2),
    ];
    for (const event of events) {
      streamer.emitEvent(NODE_ID, 'task-progress', event);
    }

    expect(accepted).toEqual([
      { taskId: 'task-a', version: 1 },
      { taskId: 'task-a', version: 3 },
      { taskId: 'task-b', version: 1 },
      { taskId: 'task-b', version: 2 },
    ]);
  });

  it('delivers heartbeat immediately without entering a FIFO queue', () => {
    const buffer = new UIEventBufferManager();
    const heartbeatValues: number[] = [];
    const processor = new ImmediateHeartbeatProcessor((event) => {
      if (event.heartbeatAt === undefined) {
        throw new Error('heartbeatAt is required');
      }
      heartbeatValues.push(event.heartbeatAt);
    });

    subscribe('heartbeat', (event) => {
      if (event.type !== 'heartbeat') {
        throw new Error(`unexpected heartbeat event: ${event.type}`);
      }
      processor.processHeartbeat(event.payload);
    });

    const heartbeatEvents: HeartbeatEvent[] = [1_000, 2_000, 3_000].map((heartbeatAt) => ({
      type: 'heartbeat',
      payload: { nodeId: NODE_ID, heartbeatAt },
    }));
    for (const event of heartbeatEvents) {
      streamer.emitHeartbeat(NODE_ID, event);
    }

    expect(heartbeatValues).toEqual([1_000, 2_000, 3_000]);
    expect(buffer.flushFifo('session-state')).toEqual([]);
    expect(buffer.flushFifo('stage-snapshot')).toEqual([]);
  });

  it('does not lose rapid FIFO events or monotonic task progress updates', () => {
    const buffer = new UIEventBufferManager();
    const acceptedProgressVersions: number[] = [];

    subscribe('session-state', (event) => {
      buffer.enqueue({
        notificationType: 'session-state',
        payload: event,
        timestamp: Date.now(),
      });
    });
    subscribe('stage-snapshot', (event) => {
      buffer.enqueue({
        notificationType: 'stage-snapshot',
        payload: event,
        timestamp: Date.now(),
      });
    });
    subscribe('task-progress', (event) => {
      if (event.type !== 'taskProgressUpdated') {
        throw new Error(`unexpected task progress event: ${event.type}`);
      }
      const { taskId, version } = event.payload;
      if (buffer.applyTaskProgress(taskId, version)) {
        acceptedProgressVersions.push(version);
      }
    });

    for (let index = 1; index <= 100; index += 1) {
      streamer.emitEvent(
        NODE_ID,
        'session-state',
        createSessionEvent(index % 2 === 0 ? 'running' : 'pausing', true)
      );
      streamer.emitEvent(NODE_ID, 'stage-snapshot', createStageEvent('source', index));
      streamer.emitEvent(NODE_ID, 'task-progress', createProgressEvent('stress-task', index));
    }

    expect(buffer.flushFifo('session-state')).toHaveLength(100);
    expect(buffer.flushFifo('stage-snapshot')).toHaveLength(100);
    expect(acceptedProgressVersions).toEqual(
      Array.from({ length: 100 }, (_value, index) => index + 1)
    );
  });

  it('stops delivery after unsubscribe', () => {
    const received: EventPayload[] = [];
    const unsubscribe = streamer.subscribe(NODE_ID, 'session-state', (event) => {
      received.push(event);
    });

    streamer.emitEvent(NODE_ID, 'session-state', createSessionEvent('running', true));
    unsubscribe();
    streamer.emitEvent(NODE_ID, 'session-state', createSessionEvent('pausing', true));

    expect(received).toHaveLength(1);
  });
});
