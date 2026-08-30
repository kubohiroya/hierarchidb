import type { BuildSessionState } from '@hierarchidb/build-api';
import type { NodeId } from '@hierarchidb/core-types';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { createSessionStatusUpdatedPayload } from '../createSessionStatusUpdatedPayload.js';
import { emitSessionStatusUpdated } from '../emitSessionStatusUpdated.js';
import { emitStageSnapshotUpdated } from '../emitStageSnapshotUpdated.js';
import { emitHeartbeat, emitTaskProgressUpdated } from '../eventEmissionUtils.js';
import { unconditionalEventStreamer } from '../eventStreamer.js';

const nodeId = 'canonical-event-node' as NodeId;

describe('canonical session event emission', () => {
  afterEach(() => {
    unconditionalEventStreamer.cleanup(nodeId);
    vi.restoreAllMocks();
  });

  it('delivers strictly validated session and stage events', () => {
    const sessionEvents: unknown[] = [];
    const stageEvents: unknown[] = [];
    unconditionalEventStreamer.subscribe(nodeId, 'session-state', (event) => {
      sessionEvents.push(event);
    });
    unconditionalEventStreamer.subscribe(nodeId, 'stage-snapshot', (event) => {
      stageEvents.push(event);
    });

    emitSessionStatusUpdated({
      nodeId,
      phase: 'running',
      isActive: true,
      startedAt: 100,
      stageId: 'source',
      stageStartedAt: 110,
      stageInactiveMs: 0,
    });
    emitStageSnapshotUpdated(nodeId, {
      stageId: 'source',
      tasks: [
        {
          taskId: 'task-1',
          stage: 'source',
          status: 'running',
          progress: 25,
          version: 2,
        },
      ],
      stageStartedAt: 110,
      stageInactiveMs: 0,
    });

    expect(sessionEvents).toHaveLength(1);
    expect(stageEvents).toHaveLength(1);
  });

  it('carries the persisted pause endpoint in the paused status event', () => {
    const state: BuildSessionState = {
      nodeId,
      status: 'paused',
      startedAt: 100,
      lastActivity: 250,
      stopReason: 'user-pause',
    };
    const payload = createSessionStatusUpdatedPayload(state, null);

    expect(payload).toEqual({
      nodeId,
      phase: 'paused',
      isActive: false,
      startedAt: 100,
      completedAt: undefined,
      pausedAt: 250,
      stopReason: 'user-pause',
      stageId: undefined,
      stageStartedAt: undefined,
      stageInactiveMs: undefined,
    });
    expect(() => emitSessionStatusUpdated(payload)).not.toThrow();
  });

  it('maps cancellation states to canonical session phases', () => {
    const cancelingPayload = createSessionStatusUpdatedPayload(
      {
        nodeId,
        status: 'canceling',
        startedAt: 100,
      },
      null
    );
    const canceledPayload = createSessionStatusUpdatedPayload(
      {
        nodeId,
        status: 'canceled',
        startedAt: 100,
        completedAt: 200,
      },
      null
    );

    expect(cancelingPayload.phase).toBe('canceling');
    expect(cancelingPayload.isActive).toBe(true);
    expect(canceledPayload.phase).toBe('canceled');
    expect(canceledPayload.isActive).toBe(false);
    expect(() => emitSessionStatusUpdated(cancelingPayload)).not.toThrow();
    expect(() => emitSessionStatusUpdated(canceledPayload)).not.toThrow();
  });

  it('rejects timing and task progress contract violations', () => {
    expect(() =>
      emitSessionStatusUpdated({
        nodeId,
        phase: 'running',
        isActive: false,
        startedAt: 100,
      })
    ).toThrow('isActive must be true');

    expect(() =>
      emitStageSnapshotUpdated(nodeId, {
        stageId: 'source',
        tasks: [
          {
            taskId: 'task-1',
            stage: 'source',
            status: 'running',
            progress: 101,
            version: 2,
          },
        ],
        stageStartedAt: 110,
        stageInactiveMs: 0,
      })
    ).toThrow('task.progress must be finite 0..100');

    expect(() => emitTaskProgressUpdated(nodeId, '', 1, 'source', 50)).toThrow(
      'taskId must be a non-empty string'
    );

    expect(() => emitHeartbeat(nodeId, Number.NaN)).toThrow('heartbeatAt must be finite');

    expect(() =>
      emitSessionStatusUpdated({
        nodeId,
        phase: 'paused',
        isActive: false,
        startedAt: 100,
      })
    ).toThrow('pausedAt is required for phase paused');

    expect(() =>
      emitSessionStatusUpdated({
        nodeId,
        phase: 'running',
        isActive: true,
        startedAt: 100,
        pausedAt: 200,
      })
    ).toThrow('pausedAt must be absent for phase running');
  });
});
