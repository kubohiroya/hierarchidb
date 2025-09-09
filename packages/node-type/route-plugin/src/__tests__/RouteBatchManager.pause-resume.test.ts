import { describe, expect, it } from 'vitest';
import { RouteBatchManager } from '../../src/services/RouteBatchManager';
import { RouteDatabase } from '../../src/database/RouteDatabase';

describe('RouteBatchManager pause/resume (smoke)', () => {
  it('creates cursor and toggles paused flag', async () => {
    const mgr = new (RouteBatchManager as any)();
    const cfg = {
      routeGeneration: {
        method: 'direct',
        parallel: true,
        maxConcurrent: 1,
        retryOnFailure: false,
        maxRetries: 0,
      },
    } as any;
    const routes = new Array(3).fill(0).map((_, i) => ({
      startCoordinates: [i, i] as [number, number],
      endCoordinates: [i + 1, i + 1] as [number, number],
      method: 'direct',
    }));
    const sessionId = await mgr.startRouteBatchSession('n1', cfg, routes);
    const db = new RouteDatabase();
    await mgr.pauseRouteBatchSession(sessionId);
    const paused = await (db as any).routeCursors.get(sessionId);
    expect(paused?.paused).toBe(true);
    await mgr.resumeRouteBatchSession(sessionId);
    const resumed = await (db as any).routeCursors.get(sessionId);
    expect(resumed?.paused).toBe(false);
  });
});

