import { describe, expect, it } from 'vitest';
import { RouteBatchManager, type RouteBatchRouteInput } from '../../src/services/RouteBatchManager.js';
import type { RouteBatchConfig } from '../../src/common/types/ObsolateBuildConfig.js';
import type { NodeId } from '@hierarchidb/core-types';

describe('RouteBatchManager idempotency', () => {
  it('returns the same nodeId for identical input payload', async () => {
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
