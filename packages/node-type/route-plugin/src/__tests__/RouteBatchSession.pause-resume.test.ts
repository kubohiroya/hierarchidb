import { describe, it, expect } from 'vitest';
import { RouteBatchSession } from '../../src/services/RouteBatchSession';
import type { RouteBatchTask, RouteBatchConfig } from '../../src/services/RouteBatchSession';
import { RouteDatabase } from '../../src/database/RouteDatabase';

describe('RouteBatchSession pause/resume integration', () => {
  it('honors paused cursor flag and resumes processing', async () => {
    const sessionId = 's2';
    const cfg = { routeGeneration: { method: 'direct', parallel: true, maxConcurrent: 2, retryOnFailure: false, maxRetries: 0 } } as RouteBatchConfig;
    const tasks: RouteBatchTask[] = Array.from({ length: 4 }, (_, i) => ({
      taskId: `t-${i}`,
      treeNodeId: 'n1' as any,
      sessionId,
      taskType: 'route_generation',
      stage: 'route_generation',
      status: 'pending',
      index: i,
      routeData: { method: 'direct', startCoordinates: [0,0], endCoordinates: [1,1] },
    }));
    const s = new RouteBatchSession(sessionId, 'n1' as any, cfg, tasks);
    await s.initialize();
    const db = new RouteDatabase();
    // Pre-set paused
    // @ts-ignore
    await (db.table('routeCursors') as any).update(sessionId, { paused: true });
    // Unpause shortly after
    setTimeout(async () => {
      // @ts-ignore
      await (db.table('routeCursors') as any).update(sessionId, { paused: false });
    }, 60);
    await s.start();
    const cursor = await (db as any).routeCursors.get(sessionId);
    expect(cursor?.completed).toBe(4);
  });
});

