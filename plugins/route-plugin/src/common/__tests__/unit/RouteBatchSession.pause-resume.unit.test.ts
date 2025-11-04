import { describe, expect, it } from 'vitest';
import type { RouteBatchConfig, RouteBatchTask } from '../../src/services/RouteBatchSession.js';
import { RouteBatchSession } from '../../src/services/RouteBatchSession.js';
import { RouteDatabase } from '../../src/services/database/RouteDatabase.js';
import type { NodeId } from '@hierarchidb/common-types';

describe('RouteBatchSession pause/resume integration', () => {
  it('honors paused cursor flag and resumes processing', async () => {
    const sessionId = 's2';
    const cfg: RouteBatchConfig = {
      routeGeneration: {
        method: 'direct',
        parallel: true,
        maxConcurrent: 2,
        retryOnFailure: false,
        maxRetries: 0,
      },
    };
    const tasks: RouteBatchTask[] = Array.from({ length: 4 }, (_, i) => ({
      taskId: `t-${i}`,
      treeNodeId: 'n1' as NodeId,
      sessionId,
      taskType: 'route_generation',
      stage: 'route_generation',
      status: 'pending',
      index: i,
      routeData: { method: 'direct', startCoordinates: [0, 0], endCoordinates: [1, 1] },
    }));
    const nodeId = 'n1' as NodeId;
    const s = new RouteBatchSession(sessionId, nodeId, cfg, tasks);
    await s.initialize();
    const db = new RouteDatabase();
    // Pre-set paused
    await db.routeCursors.update(sessionId, { paused: true });
    // Unpause shortly after
    setTimeout(async () => {
      await db.routeCursors.update(sessionId, { paused: false });
    }, 60);
    await s.start();
    const cursor = await db.routeCursors.get(sessionId);
    expect(cursor?.completed).toBe(4);
  });
});
