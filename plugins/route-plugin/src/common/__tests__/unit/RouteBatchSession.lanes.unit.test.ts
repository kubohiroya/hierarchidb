import type { NodeId } from '@hierarchidb/core-types';
import type { RouteBuildConfig } from '@hierarchidb/route-api';
import { beforeEach, describe, expect, it, vi } from 'vitest';
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
          startCoordinates: [0, 0],
          endCoordinates: [1, 1],
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
