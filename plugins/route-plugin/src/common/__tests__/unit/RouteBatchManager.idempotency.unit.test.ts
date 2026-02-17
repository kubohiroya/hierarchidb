import { describe, expect, it } from 'vitest';
import { RouteBuildManager, type RouteBuildRouteInput } from '../../src/services/RouteBuildManager.js';
import type { RouteBuildConfig } from '@hierarchidb/route-api';
import type { NodeId } from '@hierarchidb/core-types';

describe('RouteBuildManager idempotency', () => {
  it('returns the same nodeId for identical input payload', async () => {
    const mgr = new RouteBuildManager();
    const cfg: RouteBuildConfig = {
      routeGeneration: {
        method: 'direct',
        parallel: true,
        maxConcurrent: 2,
        retryOnFailure: false,
        maxRetries: 0,
      },
    };
    const routes: RouteBuildRouteInput[] = [{
      startCoordinates: [0, 0] as [number, number],
      endCoordinates: [1, 1] as [number, number],
      method: 'direct',
    }];
    const nodeId = 'n1' as NodeId;
    const a = await mgr.startRouteBuildSession(nodeId, cfg, routes);
    const b = await mgr.startRouteBuildSession(nodeId, cfg, routes);
    expect(a).toBe(b);
  });
});
