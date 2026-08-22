/**
 * Unit tests for UI-side event buffering.
 *
 * session-state and stage-snapshot use FIFO queues (unconditional, arrival order).
 * task-progress uses per-taskId version deduplication via applyTaskProgress().
 * Per build-session-worker-ui-event-spec.md:
 * "Per-task deduplication: if a taskProgressUpdated event arrives with a version
 * <= the last applied version for that taskId, it is dropped."
 */

import { beforeEach, describe, expect, it } from 'vitest';
import {
  type BufferedEvent,
  ImmediateHeartbeatProcessor,
  UIEventBufferManager,
} from '../../eventBufferingUI';

const makeFifoEvent = (
  notificationType: 'session-state' | 'stage-snapshot',
  payload: unknown
): BufferedEvent => ({
  notificationType,
  payload,
  timestamp: Date.now(),
});

describe('UIEventBufferManager -- FIFO queues (session-state / stage-snapshot)', () => {
  let mgr: UIEventBufferManager;

  beforeEach(() => {
    mgr = new UIEventBufferManager();
  });

  it('returns events in arrival order', () => {
    mgr.enqueue(makeFifoEvent('session-state', 'a'));
    mgr.enqueue(makeFifoEvent('session-state', 'b'));
    mgr.enqueue(makeFifoEvent('session-state', 'c'));

    const flushed = mgr.flushFifo('session-state');
    expect(flushed.map((e) => e.payload)).toEqual(['a', 'b', 'c']);
  });

  it('flushFifo drains the queue completely', () => {
    mgr.enqueue(makeFifoEvent('stage-snapshot', 'snap1'));
    mgr.enqueue(makeFifoEvent('stage-snapshot', 'snap2'));

    const first = mgr.flushFifo('stage-snapshot');
    expect(first).toHaveLength(2);

    const second = mgr.flushFifo('stage-snapshot');
    expect(second).toHaveLength(0);
  });

  it('session-state and stage-snapshot queues are independent', () => {
    mgr.enqueue(makeFifoEvent('session-state', 'ss1'));
    mgr.enqueue(makeFifoEvent('stage-snapshot', 'sn1'));
    mgr.enqueue(makeFifoEvent('session-state', 'ss2'));

    expect(mgr.flushFifo('session-state').map((e) => e.payload)).toEqual(['ss1', 'ss2']);
    expect(mgr.flushFifo('stage-snapshot').map((e) => e.payload)).toEqual(['sn1']);
  });

  it('enqueue rejects task-progress (must use applyTaskProgress)', () => {
    expect(() =>
      mgr.enqueue({
        notificationType: 'task-progress',
        payload: {},
        timestamp: Date.now(),
      })
    ).toThrow();
  });

  it('enqueue rejects unknown notification type', () => {
    expect(() =>
      mgr.enqueue({
        notificationType: 'unknown' as BufferedEvent['notificationType'],
        payload: {},
        timestamp: Date.now(),
      })
    ).toThrow();
  });

  it('reset clears all FIFO queues', () => {
    mgr.enqueue(makeFifoEvent('session-state', 'x'));
    mgr.enqueue(makeFifoEvent('stage-snapshot', 'y'));
    mgr.reset();

    expect(mgr.flushFifo('session-state')).toHaveLength(0);
    expect(mgr.flushFifo('stage-snapshot')).toHaveLength(0);
  });
});

describe('UIEventBufferManager -- task-progress per-taskId version deduplication', () => {
  let mgr: UIEventBufferManager;

  beforeEach(() => {
    mgr = new UIEventBufferManager();
  });

  it('accepts first event for a taskId regardless of version', () => {
    const result = mgr.applyTaskProgress('task-1', 1);
    expect(result).toBe(true);
  });

  it('accepts event with higher version', () => {
    mgr.applyTaskProgress('task-1', 5);
    const result = mgr.applyTaskProgress('task-1', 7);
    expect(result).toBe(true);
  });

  it('drops event with equal version (duplicate)', () => {
    mgr.applyTaskProgress('task-1', 5);
    const result = mgr.applyTaskProgress('task-1', 5);
    expect(result).toBe(false);
  });

  it('drops event with lower version (stale)', () => {
    mgr.applyTaskProgress('task-1', 10);
    const result = mgr.applyTaskProgress('task-1', 3);
    expect(result).toBe(false);
  });

  it('tracks versions independently per taskId', () => {
    // task-A at version 10
    mgr.applyTaskProgress('task-A', 10);
    // task-B at version 1 — independent from task-A, must be accepted
    const acceptedB = mgr.applyTaskProgress('task-B', 1);
    // task-A at version 9 — stale for task-A
    const staleA = mgr.applyTaskProgress('task-A', 9);

    expect(acceptedB).toBe(true);
    expect(staleA).toBe(false);
  });

  it('accepts monotonically increasing versions for same taskId', () => {
    const versions = [1, 2, 3, 4, 5];
    const results = versions.map((v) => mgr.applyTaskProgress('task-1', v));
    expect(results.every((r) => r === true)).toBe(true);
  });

  it('reset clears per-taskId version state', () => {
    mgr.applyTaskProgress('task-1', 10);
    mgr.reset();
    // After reset, version 1 must be accepted again (state cleared)
    const result = mgr.applyTaskProgress('task-1', 1);
    expect(result).toBe(true);
  });

  it('multiple tasks interleaved: each tracked independently', () => {
    // Simulate 3 parallel tasks emitting interleaved progress
    const accepted: number[] = [];
    const dropped: number[] = [];

    const emit = (taskId: string, version: number, value: number) => {
      const r = mgr.applyTaskProgress(taskId, version);
      if (r) accepted.push(value);
      else dropped.push(value);
    };

    emit('task-A', 1, 10);
    emit('task-B', 1, 20);
    emit('task-C', 1, 30);
    emit('task-A', 3, 40); // accepted (3 > 1)
    emit('task-B', 2, 50); // accepted (2 > 1)
    emit('task-A', 2, 60); // dropped  (2 < 3)
    emit('task-C', 1, 70); // dropped  (1 === 1)
    emit('task-C', 5, 80); // accepted (5 > 1)

    expect(accepted).toEqual([10, 20, 30, 40, 50, 80]);
    expect(dropped).toEqual([60, 70]);
  });
});

describe('ImmediateHeartbeatProcessor', () => {
  it('passes heartbeat events through immediately', () => {
    const received: Array<{ nodeId: string; heartbeatAt?: number }> = [];
    const proc = new ImmediateHeartbeatProcessor((e) => received.push(e));

    proc.processHeartbeat({ nodeId: 'n1', heartbeatAt: 1000 });
    proc.processHeartbeat({ nodeId: 'n1', heartbeatAt: 2000 });

    expect(received).toEqual([
      { nodeId: 'n1', heartbeatAt: 1000 },
      { nodeId: 'n1', heartbeatAt: 2000 },
    ]);
  });

  it('handles heartbeat without heartbeatAt', () => {
    const received: Array<{ nodeId: string; heartbeatAt?: number }> = [];
    const proc = new ImmediateHeartbeatProcessor((e) => received.push(e));
    proc.processHeartbeat({ nodeId: 'n1' });
    expect(received).toEqual([{ nodeId: 'n1' }]);
  });
});
