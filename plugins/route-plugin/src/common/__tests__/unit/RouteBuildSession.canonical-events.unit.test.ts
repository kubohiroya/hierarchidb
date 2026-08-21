// @vitest-environment node

import type { CanonicalSessionEvent } from '@hierarchidb/build-api';
import { unconditionalEventStreamer } from '@hierarchidb/build-runtime-services';
import type { NodeId } from '@hierarchidb/core-types';
import { initializeEphemeralDB } from '@hierarchidb/gis-sdk';
import { ROUTE_MODES, type RouteBuildConfig } from '@hierarchidb/route-api';
import { deleteTasksByNode, listTasksByStatus, VtTaskQueueDb } from '@hierarchidb/vt-orchestrator';
import { afterEach, describe, expect, it } from 'vitest';
import { DEFAULT_ROUTE_BUILD_CONFIG } from '../../../common/config/buildConfig.js';
import { RouteBuildSessionOrchestrator } from '../../../services/RouteBuildSessionOrchestrator';

const nodeId = 'route-canonical-events' as NodeId;
const ephemeralStore = initializeEphemeralDB('route-canonical-events-test');
const taskQueue = new VtTaskQueueDb();

describe('RouteBuildSession canonical events', () => {
  afterEach(async () => {
    unconditionalEventStreamer.cleanup(nodeId);
    await deleteTasksByNode(taskQueue, nodeId);
    await ephemeralStore.transaction(
      'rw',
      [
        ephemeralStore.sourceCache,
        ephemeralStore.sourceCacheMeta,
        ephemeralStore.geometryCache,
        ephemeralStore.geometryCacheMeta,
        ephemeralStore.tileEmitBufferRelations,
      ],
      async () => {
        await ephemeralStore.sourceCache.where('nodeId').equals(nodeId).delete();
        await ephemeralStore.sourceCacheMeta.where('nodeId').equals(nodeId).delete();
        await ephemeralStore.geometryCache.where('nodeId').equals(nodeId).delete();
        await ephemeralStore.geometryCacheMeta.where('nodeId').equals(nodeId).delete();
        await ephemeralStore.tileEmitBufferRelations.where('nodeId').equals(nodeId).delete();
      }
    );
  });

  it('emits the four canonical event types for all route stages', async () => {
    const events: CanonicalSessionEvent[] = [];
    const completed = new Promise<void>((resolve) => {
      unconditionalEventStreamer.subscribe(nodeId, 'session-state', (event) => {
        const canonicalEvent = event as CanonicalSessionEvent;
        events.push(canonicalEvent);
        if (
          canonicalEvent.type === 'sessionStatusUpdated' &&
          (canonicalEvent.payload.phase === 'completed' ||
            canonicalEvent.payload.phase === 'failed')
        ) {
          resolve();
        }
      });
    });
    for (const eventType of ['stage-snapshot', 'task-progress', 'heartbeat'] as const) {
      unconditionalEventStreamer.subscribe(nodeId, eventType, (event) => {
        events.push(event as CanonicalSessionEvent);
      });
    }

    const config: RouteBuildConfig = {
      ...DEFAULT_ROUTE_BUILD_CONFIG,
      routeGeneration: {
        ...DEFAULT_ROUTE_BUILD_CONFIG.routeGeneration,
        method: 'direct',
        parallel: false,
        maxConcurrent: 1,
        retryOnFailure: false,
        maxRetries: 0,
      },
    };
    const orchestrator = new RouteBuildSessionOrchestrator({
      session: {
        generator: {
          generate: async (points) => ({ lineGeometry: points, distance: 1, duration: 0 }),
        },
      },
    });
    await orchestrator.prepareSession(nodeId, config, {
      routes: [
        {
          startLocationId: 'location-start',
          endLocationId: 'location-end',
          startCoordinates: [0, 0],
          endCoordinates: [1, 1],
          routeMode: ROUTE_MODES.ROAD,
          method: 'direct',
        },
      ],
    });
    await orchestrator.startBuildSession(nodeId);
    await completed;

    const finalStatus = await orchestrator.getBuildSessionStatus(nodeId);
    if (finalStatus.status !== 'completed') {
      const taskFailures = events
        .filter((event) => event.type === 'stageSnapshotUpdated')
        .flatMap((event) => event.payload.tasks)
        .filter((task) => task.status === 'failed');
      throw new Error(`Route session failed: ${JSON.stringify(taskFailures)}`);
    }
    expect(finalStatus).toMatchObject({ nodeId, status: 'completed' });

    const sessionEvents = events.filter((event) => event.type === 'sessionStatusUpdated');
    expect(sessionEvents.at(0)?.payload.phase).toBe('idle');
    expect(sessionEvents.at(-1)?.payload.phase).toBe('completed');
    expect(events.some((event) => event.type === 'heartbeat')).toBe(true);

    const stageSnapshots = events.filter((event) => event.type === 'stageSnapshotUpdated');
    expect(new Set(stageSnapshots.map((event) => event.payload.stageId))).toEqual(
      new Set(['source', 'geometry', 'tileEmit'])
    );
    for (const stageId of ['source', 'geometry', 'tileEmit']) {
      const stageEvents = stageSnapshots.filter((event) => event.payload.stageId === stageId);
      expect(stageEvents).toHaveLength(4);
      expect(stageEvents.at(-1)?.payload.tasks).toEqual([
        expect.objectContaining({ status: 'completed', progress: 100, version: 3 }),
      ]);
      expect(stageEvents.at(-1)?.payload.stageCompletedAt).toEqual(expect.any(Number));
    }

    const progressEvents = events.filter((event) => event.type === 'taskProgressUpdated');
    expect(progressEvents).toHaveLength(6);
    expect(
      progressEvents.every(
        (event) =>
          Number.isFinite(event.payload.value) &&
          event.payload.value >= 0 &&
          event.payload.value <= 100
      )
    ).toBe(true);
    const artifacts = await ephemeralStore.sourceCache.where('nodeId').equals(nodeId).toArray();
    expect(artifacts).toHaveLength(1);
    expect(artifacts[0]).toMatchObject({
      domainType: 'route',
      sourceKey: 'road:location-start:location-end',
      format: 'geojson',
      featureCount: 1,
    });
    const geometryArtifacts = await ephemeralStore.geometryCache
      .where('nodeId')
      .equals(nodeId)
      .sortBy('bandIndex');
    expect(geometryArtifacts).toHaveLength(3);
    expect(geometryArtifacts.map((artifact) => artifact.featureCount)).toEqual([1, 0, 0]);
    expect(geometryArtifacts[0]?.metadata).toMatchObject({
      sourceCacheId: `${String(nodeId)}:source:road:location-start:location-end`,
      endpointPreserved: true,
      filtered: false,
    });
    const completedTasks = await listTasksByStatus(taskQueue, nodeId, 'completed');
    expect(completedTasks).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          stage: 'source',
          inputData: expect.objectContaining({
            cacheKey: 'road:location-start:location-end',
          }),
          outputData: expect.objectContaining({
            sourceCacheId: `${String(nodeId)}:source:road:location-start:location-end`,
            sourceKey: 'road:location-start:location-end',
            format: 'geojson',
          }),
        }),
        expect.objectContaining({
          stage: 'geometry',
          inputData: expect.objectContaining({
            sourceCacheId: `${String(nodeId)}:source:road:location-start:location-end`,
          }),
          outputData: expect.objectContaining({
            sourceCacheId: `${String(nodeId)}:source:road:location-start:location-end`,
            artifacts: expect.arrayContaining([
              expect.objectContaining({ bandIndex: 0, featureCount: 1, filtered: false }),
              expect.objectContaining({ bandIndex: 1, featureCount: 0, filtered: true }),
            ]),
          }),
        }),
      ])
    );
  });

  it('aborts the active route task before publishing paused state', async () => {
    const phases: string[] = [];
    unconditionalEventStreamer.subscribe(nodeId, 'session-state', (event) => {
      if (event.type === 'sessionStatusUpdated') phases.push(event.payload.phase);
    });
    let resolveGeneration: (() => void) | null = null;
    const generationStarted = new Promise<void>((resolve) => {
      resolveGeneration = resolve;
    });
    let finishGeneration: (() => void) | null = null;
    const generationResult = new Promise<{
      lineGeometry: [number, number][];
      distance: number;
      duration: number;
    }>((resolve) => {
      finishGeneration = () => resolve({ lineGeometry: [], distance: 0, duration: 0 });
    });
    const orchestrator = new RouteBuildSessionOrchestrator({
      session: {
        generator: {
          generate: async () => {
            const notifyGenerationStarted = resolveGeneration;
            if (!notifyGenerationStarted)
              throw new Error('Generation start resolver is unavailable');
            notifyGenerationStarted();
            return generationResult;
          },
        },
      },
    });
    const config: RouteBuildConfig = {
      ...DEFAULT_ROUTE_BUILD_CONFIG,
      routeGeneration: {
        ...DEFAULT_ROUTE_BUILD_CONFIG.routeGeneration,
        method: 'direct',
        parallel: false,
        maxConcurrent: 1,
        retryOnFailure: false,
        maxRetries: 0,
      },
    };
    await orchestrator.prepareSession(nodeId, config, {
      routes: [
        {
          startLocationId: 'location-start',
          endLocationId: 'location-end',
          startCoordinates: [0, 0],
          endCoordinates: [1, 1],
          routeMode: ROUTE_MODES.ROAD,
          method: 'direct',
        },
      ],
    });
    await orchestrator.startBuildSession(nodeId);
    await generationStarted;

    const pausePromise = orchestrator.pauseBuildSession(nodeId, 'route-leave');
    expect(phases.at(-1)).toBe('pausing');
    const completeGeneration = finishGeneration;
    if (!completeGeneration) throw new Error('Generation completion resolver is unavailable');
    completeGeneration();
    await pausePromise;

    await expect(orchestrator.getBuildSessionStatus(nodeId)).resolves.toMatchObject({
      status: 'paused',
      stopReason: 'route-leave',
    });
    expect(phases.slice(-2)).toEqual(['pausing', 'paused']);
    const runningTasks = await listTasksByStatus(taskQueue, nodeId, 'running');
    expect(runningTasks).toEqual([]);
    const queuedTasks = await listTasksByStatus(taskQueue, nodeId, 'queued');
    expect(queuedTasks).toHaveLength(3);
  });

  it('publishes canonical task and session failure when the selected engine is missing', async () => {
    const events: CanonicalSessionEvent[] = [];
    const failed = new Promise<void>((resolve) => {
      unconditionalEventStreamer.subscribe(nodeId, 'session-state', (event) => {
        const canonicalEvent = event as CanonicalSessionEvent;
        events.push(canonicalEvent);
        if (
          canonicalEvent.type === 'sessionStatusUpdated' &&
          canonicalEvent.payload.phase === 'failed'
        ) {
          resolve();
        }
      });
    });
    unconditionalEventStreamer.subscribe(nodeId, 'stage-snapshot', (event) => {
      events.push(event as CanonicalSessionEvent);
    });
    unconditionalEventStreamer.subscribe(nodeId, 'task-progress', (event) => {
      events.push(event as CanonicalSessionEvent);
    });
    const config: RouteBuildConfig = {
      ...DEFAULT_ROUTE_BUILD_CONFIG,
      routeGeneration: {
        ...DEFAULT_ROUTE_BUILD_CONFIG.routeGeneration,
        method: 'osm_route',
        parallel: false,
        maxConcurrent: 1,
      },
    };
    const orchestrator = new RouteBuildSessionOrchestrator();
    await orchestrator.prepareSession(nodeId, config, {
      routes: [
        {
          startLocationId: 'location-start',
          endLocationId: 'location-end',
          startCoordinates: [0, 0],
          endCoordinates: [1, 1],
          routeMode: ROUTE_MODES.ROAD,
        },
      ],
    });

    await orchestrator.startBuildSession(nodeId);
    await failed;

    await expect(orchestrator.getBuildSessionStatus(nodeId)).resolves.toMatchObject({
      status: 'failed',
    });
    expect(
      events.some(
        (event) =>
          event.type === 'stageSnapshotUpdated' &&
          event.payload.stageId === 'source' &&
          event.payload.tasks.some(
            (task) =>
              task.status === 'failed' && task.errorMessage?.includes('OSRM engine is required')
          )
      )
    ).toBe(true);
    expect(
      events.some(
        (event) =>
          event.type === 'taskProgressUpdated' &&
          event.payload.message?.includes('OSRM engine is required')
      )
    ).toBe(true);
    await expect(ephemeralStore.sourceCache.where('nodeId').equals(nodeId).count()).resolves.toBe(
      0
    );
  });

  it('uses the external engine provider configured on the session manager', async () => {
    let engineCalls = 0;
    const completed = new Promise<void>((resolve) => {
      unconditionalEventStreamer.subscribe(nodeId, 'session-state', (event) => {
        if (
          event.type === 'sessionStatusUpdated' &&
          (event.payload.phase === 'completed' || event.payload.phase === 'failed')
        ) {
          resolve();
        }
      });
    });
    const config: RouteBuildConfig = {
      ...DEFAULT_ROUTE_BUILD_CONFIG,
      routeGeneration: {
        ...DEFAULT_ROUTE_BUILD_CONFIG.routeGeneration,
        method: 'osm_route',
        parallel: false,
        maxConcurrent: 1,
      },
    };
    const orchestrator = new RouteBuildSessionOrchestrator({
      engines: {
        osrm: {
          async route() {
            engineCalls += 1;
            return {
              line: [
                [0, 0],
                [0.5, 0.5],
                [1, 1],
              ],
              distance_m: 10,
              duration_s: 2,
            };
          },
        },
      },
    });
    await orchestrator.prepareSession(nodeId, config, {
      routes: [
        {
          startLocationId: 'location-start',
          endLocationId: 'location-end',
          startCoordinates: [0, 0],
          endCoordinates: [1, 1],
          routeMode: ROUTE_MODES.ROAD,
        },
      ],
    });

    await orchestrator.startBuildSession(nodeId);
    await completed;

    expect(engineCalls).toBe(1);
    const artifacts = await ephemeralStore.sourceCache.where('nodeId').equals(nodeId).toArray();
    expect(artifacts).toHaveLength(1);
    expect(artifacts[0]).toMatchObject({
      vertexCount: 3,
      metadata: {
        generationMethod: 'osm_route',
        distanceMeters: 10,
        durationSeconds: 2,
      },
    });
  });
});
