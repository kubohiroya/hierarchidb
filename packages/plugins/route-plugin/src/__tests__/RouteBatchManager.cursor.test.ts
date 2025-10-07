import { describe, expect, it } from 'vitest';
import { RouteBatchManager, type RouteBatchRouteInput } from '../services/RouteBatchManager.js';
import type { RouteBatchConfig } from '../services/RouteBatchSession.js';
import { RouteDatabase } from '../database/RouteDatabase.js';
import type { NodeId } from '@hierarchidb/common-types';

const BASE_CONFIG: RouteBatchConfig = {
  routeGeneration: {
    method: 'direct',
    parallel: true,
    maxConcurrent: 2,
    retryOnFailure: false,
    maxRetries: 0,
  },
};

describe('RouteBatchManager basics', () => {
  it('persists cursor metadata when session starts', async () => {
    const mgr = new RouteBatchManager();
    const routes: RouteBatchRouteInput[] = [
      { startCoordinates: [0, 0], endCoordinates: [1, 1], method: 'direct' },
      { startCoordinates: [1, 1], endCoordinates: [2, 2], method: 'direct' },
    ];
    const sessionId = await mgr.startRouteBatchSession('node-1' as NodeId, BASE_CONFIG, routes);

    const db = new RouteDatabase();
    const cursor = await db.routeCursors.get(sessionId);
    expect(cursor).toBeTruthy();
    expect(cursor?.total).toBeGreaterThanOrEqual(routes.length); // includes optimization task
    expect(cursor?.completed).toBe(cursor?.total);
    expect(cursor?.paused).toBe(false);
  });
});
