import type { NodeId } from '@hierarchidb/core-types';
import { initializeEphemeralDB } from '@hierarchidb/gis-sdk';
import { ROUTE_MODES, type RouteBuildConfig } from '@hierarchidb/route-api';
import { afterAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { DEFAULT_ROUTE_BUILD_CONFIG } from '../../../common/config/buildConfig.js';
import { RouteBuildSession, type RouteBuildTask } from '../../../services/RouteBuildSession';

const { runStageTasksMock } = vi.hoisted(() => ({
  runStageTasksMock: vi.fn(async () => undefined),
}));

vi.mock('@hierarchidb/vt-orchestrator', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@hierarchidb/vt-orchestrator')>()),
  runStageTasks: runStageTasksMock,
}));

type CapturedRunStageOptions = {
  stage?: string;
  lanePolicy?: {
    enabled?: boolean;
    maxConcurrentForLane?: (lane: string) => number;
  };
};

const ephemeralStore = initializeEphemeralDB('route-lane-gating-test');

describe('RouteBuildSession lane gating', () => {
  afterAll(async () => {
    ephemeralStore.close();
    await ephemeralStore.delete();
  });

  beforeEach(() => {
    runStageTasksMock.mockClear();
  });

  it('sets the osm_route lane concurrency to 1 even when maxConcurrent is high', async () => {
    let releaseSourceStage: (() => void) | null = null;
    runStageTasksMock.mockImplementationOnce(
      () =>
        new Promise<void>((resolve) => {
          releaseSourceStage = resolve;
        })
    );
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
        status: 'queued',
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

    const session = new RouteBuildSession(nodeId, config, tasks, { ephemeralStore });
    await session.initialize();
    const startPromise = session.start();
    await vi.waitFor(() => expect(runStageTasksMock).toHaveBeenCalledOnce());

    const sourceOptions = runStageTasksMock.mock.calls
      .map(([options]) => options as CapturedRunStageOptions)
      .find((options) => options.stage === 'source');
    if (!sourceOptions?.lanePolicy?.maxConcurrentForLane) {
      throw new Error('Route source stage did not provide a lane policy');
    }

    expect(sourceOptions.lanePolicy.enabled).toBe(true);
    expect(sourceOptions.lanePolicy.maxConcurrentForLane('osm_route')).toBe(1);

    const pausePromise = session.pause('lane-test-complete');
    const release = releaseSourceStage;
    if (!release) throw new Error('Source stage release callback is unavailable');
    release();
    await pausePromise;
    await startPromise;
  });
});
