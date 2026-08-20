import type { NodeId } from '@hierarchidb/core-types';
import { afterEach, describe, expect, it, vi } from 'vitest';
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
  });
});
