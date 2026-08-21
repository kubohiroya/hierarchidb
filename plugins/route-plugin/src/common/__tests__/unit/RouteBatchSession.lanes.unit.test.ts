import type { NodeId } from '@hierarchidb/core-types';
import { ROUTE_MODES, type RouteBuildConfig } from '@hierarchidb/route-api';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { DEFAULT_ROUTE_BUILD_CONFIG } from '../../../common/config/buildConfig.js';
import { RouteBuildSession, type RouteBuildTask } from '../../../services/RouteBuildSession';

const { runStageTasksMock } = vi.hoisted(() => ({
  runStageTasksMock: vi.fn(async () => undefined),
}));

vi.mock('@hierarchidb/vt-orchestrator', () => ({
  runStageTasks: runStageTasksMock,
}));

type CapturedRunStageOptions = {
  stage?: string;
  lanePolicy?: {
    enabled?: boolean;
    maxConcurrentForLane?: (lane: string) => number;
  };
};

describe('RouteBuildSession lane gating', () => {
  beforeEach(() => {
    runStageTasksMock.mockClear();
  });

  it('sets the osm_route lane concurrency to 1 even when maxConcurrent is high', async () => {
    const config: RouteBuildConfig = {
      ...DEFAULT_ROUTE_BUILD_CONFIG,
      routeGeneration: {
        method: 'osm_route',
        parallel: true,
        maxConcurrent: 8,
        retryOnFailure: false,
        maxRetries: 0,
      },
    };
    const nodeId = 'route-lane-test-node' as NodeId;
    const tasks: RouteBuildTask[] = [
      {
        taskId: 'route-lane-test-source',
        treeNodeId: nodeId,
        nodeId,
        stage: 'source',
        status: 'pending',
        progress: 0,
        version: 1,
        index: 0,
        routeData: {
          method: 'osm_route',
          routeMode: ROUTE_MODES.ROAD,
          startLocationId: 'location-start' as NodeId,
          endLocationId: 'location-end' as NodeId,
          startCoordinates: [0, 0],
          endCoordinates: [1, 1],
          sourceKey: 'road:location-start:location-end',
          inputHash: 'route-source-input',
          bidirectional: false,
        },
      },
    ];

    const session = new RouteBuildSession(nodeId, config, tasks);
    await session.initialize();
    await session.start();

    const sourceOptions = runStageTasksMock.mock.calls
      .map(([options]) => options as CapturedRunStageOptions)
      .find((options) => options.stage === 'source');
    if (!sourceOptions?.lanePolicy?.maxConcurrentForLane) {
      throw new Error('Route source stage did not provide a lane policy');
    }

    expect(sourceOptions.lanePolicy.enabled).toBe(true);
    expect(sourceOptions.lanePolicy.maxConcurrentForLane('osm_route')).toBe(1);
  });
});
