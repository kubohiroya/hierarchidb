import type { NodeId } from '@hierarchidb/core-types';
import { initializeEphemeralDB } from '@hierarchidb/gis-sdk';
import { ROUTE_MODES, type RouteBuildConfig } from '@hierarchidb/route-api';
import { describe, expect, it } from 'vitest';
import { DEFAULT_ROUTE_BUILD_CONFIG } from '../../../common/config/buildConfig.js';
import { RouteBuildManager, type RouteBuildRouteInput } from '../../../services/RouteBuildManager';

initializeEphemeralDB('route-batch-manager-idempotency-test');

describe('RouteBuildManager idempotency', () => {
  it('returns the same nodeId for identical input payload', async () => {
    const mgr = new RouteBuildManager();
    const cfg: RouteBuildConfig = {
      ...DEFAULT_ROUTE_BUILD_CONFIG,
      routeGeneration: {
        method: 'direct',
        parallel: true,
        maxConcurrent: 2,
        retryOnFailure: false,
        maxRetries: 0,
      },
    };
    const routes: RouteBuildRouteInput[] = [
      {
        startLocationId: 'location-start' as NodeId,
        endLocationId: 'location-end' as NodeId,
        startCoordinates: [0, 0] as [number, number],
        endCoordinates: [1, 1] as [number, number],
        routeMode: ROUTE_MODES.ROAD,
        method: 'direct',
      },
    ];
    const nodeId = 'n1' as NodeId;
    const a = await mgr.startRouteBuildSession(nodeId, cfg, routes);
    const b = await mgr.startRouteBuildSession(nodeId, cfg, routes);
    expect(a).toBe(b);
  });
});
