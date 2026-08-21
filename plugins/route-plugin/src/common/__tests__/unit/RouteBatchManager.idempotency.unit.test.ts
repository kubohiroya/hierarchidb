// @vitest-environment node

import type { NodeId } from '@hierarchidb/core-types';
import { initializeEphemeralDB } from '@hierarchidb/gis-sdk';
import { ROUTE_MODES, type RouteBuildConfig } from '@hierarchidb/route-api';
import { RouteDB } from '@hierarchidb/route-store';
import { deleteTasksByNode, VtTaskQueueDb } from '@hierarchidb/vt-orchestrator';
import { afterAll, describe, expect, it } from 'vitest';
import { DEFAULT_ROUTE_BUILD_CONFIG } from '../../../common/config/buildConfig.js';
import type { RouteBuildRouteInput } from '../../../services/RouteBuildManager.js';
import { RouteBuildSessionOrchestrator } from '../../../services/RouteBuildSessionOrchestrator.js';

const ephemeralStore = initializeEphemeralDB('route-session-idempotency-test');
const routeStore = new RouteDB('route-session-idempotency-tiles-test');
const taskQueue = new VtTaskQueueDb();
const nodeId = 'route-idempotency-node' as NodeId;

describe('RouteBuildSessionOrchestrator idempotency', () => {
  afterAll(async () => {
    await deleteTasksByNode(taskQueue, nodeId);
    ephemeralStore.close();
    await ephemeralStore.delete();
    routeStore.close();
    await routeStore.delete();
  });

  it('keeps one running session per node and routes cancel through canonical pause', async () => {
    let generatorCalls = 0;
    let markGenerationStarted: (() => void) | null = null;
    const generationStarted = new Promise<void>((resolve) => {
      markGenerationStarted = resolve;
    });
    let resolveGeneration:
      | ((value: { lineGeometry: [number, number][]; distance: number; duration: number }) => void)
      | null = null;
    const generation = new Promise<{
      lineGeometry: [number, number][];
      distance: number;
      duration: number;
    }>((resolve) => {
      resolveGeneration = resolve;
    });
    const orchestrator = new RouteBuildSessionOrchestrator({
      session: {
        ephemeralStore,
        routeStore,
        generator: {
          generate: async () => {
            generatorCalls += 1;
            const notifyStarted = markGenerationStarted;
            if (!notifyStarted) throw new Error('Generation start resolver is unavailable');
            notifyStarted();
            return generation;
          },
        },
      },
    });
    const config: RouteBuildConfig = {
      ...DEFAULT_ROUTE_BUILD_CONFIG,
      routeGeneration: {
        method: 'direct',
        parallel: false,
        maxConcurrent: 1,
        retryOnFailure: false,
        maxRetries: 0,
      },
    };
    const routes: RouteBuildRouteInput[] = [
      {
        startLocationId: 'location-start' as NodeId,
        endLocationId: 'location-end' as NodeId,
        startCoordinates: [0, 0],
        endCoordinates: [1, 1],
        routeMode: ROUTE_MODES.ROAD,
        method: 'direct',
      },
    ];

    await orchestrator.prepareSession(nodeId, config, { routes });
    await expect(orchestrator.startBuildSession(nodeId)).resolves.toMatchObject({
      nodeId,
      status: 'running',
    });
    await generationStarted;
    await orchestrator.prepareSession(nodeId, config, { routes });
    await expect(orchestrator.startBuildSession(nodeId)).resolves.toMatchObject({
      nodeId,
      status: 'running',
    });
    expect(generatorCalls).toBe(1);

    const cancelPromise = orchestrator.cancelQueuedBuildSession(nodeId, 'route-cancel');
    const finishGeneration = resolveGeneration;
    if (!finishGeneration) throw new Error('Generation resolver is unavailable');
    finishGeneration({
      lineGeometry: [
        [0, 0],
        [1, 1],
      ],
      distance: 1,
      duration: 0,
    });
    await cancelPromise;
    await expect(orchestrator.getBuildSessionStatus(nodeId)).resolves.toMatchObject({
      status: 'paused',
      stopReason: 'route-cancel',
    });
  });
});
