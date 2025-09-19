import { describe, expect, it } from 'vitest';
import { RouteBatchManager, type RouteBatchRouteInput } from '../../src/services/RouteBatchManager.js';
import type { RouteBatchConfig } from '../../src/services/RouteBatchSession.js';
import type { NodeId } from '@hierarchidb/common-type';

describe('RouteBatchManager idempotency', () => {
  it('returns the same sessionId for identical input payload', async () => {
    const mgr = new RouteBatchManager();
    const cfg: RouteBatchConfig = {
      routeGeneration: {
        method: 'direct',
        parallel: true,
        maxConcurrent: 2,
        retryOnFailure: false,
        maxRetries: 0,
      },
    };
    const routes: RouteBatchRouteInput[] = [{
      startCoordinates: [0, 0] as [number, number],
      endCoordinates: [1, 1] as [number, number],
      method: 'direct',
    }];
    const nodeId = 'n1' as NodeId;
    const a = await mgr.startRouteBatchSession(nodeId, cfg, routes);
    const b = await mgr.startRouteBatchSession(nodeId, cfg, routes);
    expect(a).toBe(b);
  });
});
