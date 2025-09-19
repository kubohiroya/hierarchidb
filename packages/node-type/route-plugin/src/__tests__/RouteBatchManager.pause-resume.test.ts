import { describe, expect, it } from 'vitest';
import { RouteBatchManager, type RouteBatchRouteInput } from '../../src/services/RouteBatchManager.js';
import { RouteDatabase } from '../../src/database/RouteDatabase.js';
import type { RouteBatchConfig } from '../../src/services/RouteBatchSession.js';
import type { NodeId } from '@hierarchidb/common-type';

describe('RouteBatchManager pause/resume (smoke)', () => {
  it('creates cursor and toggles paused flag', async () => {
    const mgr = new RouteBatchManager();
    const cfg: RouteBatchConfig = {
      routeGeneration: {
        method: 'direct',
        parallel: true,
        maxConcurrent: 1,
        retryOnFailure: false,
        maxRetries: 0,
      },
    };
    const routes: RouteBatchRouteInput[] = new Array(3).fill(0).map((_, i) => ({
      startCoordinates: [i, i],
      endCoordinates: [i + 1, i + 1],
      method: 'direct',
    }));
    const nodeId = 'n1' as NodeId;
    const sessionId = await mgr.startRouteBatchSession(nodeId, cfg, routes);
    const db = new RouteDatabase();
    await mgr.pauseRouteBatchSession(sessionId);
    const paused = await db.routeCursors.get(sessionId);
    expect(paused?.paused).toBe(true);
    await mgr.resumeRouteBatchSession(sessionId);
    const resumed = await db.routeCursors.get(sessionId);
    expect(resumed?.paused).toBe(false);
  });
});
