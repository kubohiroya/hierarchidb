import type { CanonicalSessionEvent } from '@hierarchidb/build-api';
import { unconditionalEventStreamer } from '@hierarchidb/build-runtime-services';
import type { NodeId } from '@hierarchidb/core-types';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { LocationBuildConfig } from '../../../common/entities/LocationEntity';
import { LocationBuildManager } from '../../LocationBuildManager';
import { createDefaultLocationMvtBuildConfig } from '../../mvt/createDefaultLocationMvtBuildConfig';
import { createLocationSourcePlan } from '../../source/createLocationSourcePlan';

const {
  replaceLocationArtifacts,
  runLocationSourceArtifactCleanup,
  strategySearch,
  persistLocationGeometryArtifacts,
  prepareLocationTileEmitTasks,
  runLocationTileEmitStage,
} = vi.hoisted(() => ({
  replaceLocationArtifacts: vi.fn(),
  runLocationSourceArtifactCleanup: vi.fn(),
  strategySearch: vi.fn(),
  persistLocationGeometryArtifacts: vi.fn(),
  prepareLocationTileEmitTasks: vi.fn(),
  runLocationTileEmitStage: vi.fn(),
}));

vi.mock('../../download/strategyRegistryUtils.js', () => ({
  getLocationStrategy: () => ({
    search: strategySearch,
  }),
}));

vi.mock('../../pointRepository.js', () => ({
  replaceLocationArtifacts,
  clearLocationArtifacts: vi.fn(async () => {}),
  clearLocationPoints: vi.fn(async () => {}),
  replaceLocationPoints: vi.fn(async () => {}),
}));

vi.mock('../../source/runLocationSourceArtifactCleanup.js', () => ({
  runLocationSourceArtifactCleanup,
}));

vi.mock('../../mvt/persistLocationGeometryArtifacts.js', () => ({
  buildLocationGeometryCacheId: (_nodeId: string, bandIndex: number) =>
    `geometry-${String(bandIndex)}`,
  persistLocationGeometryArtifacts,
  requireLocationMvtBands: () => [{ bandIndex: 0, zMin: 0, zMax: 5, zBase: 0 }],
}));

vi.mock('../../mvt/prepareLocationTileEmitTasks.js', () => ({
  prepareLocationTileEmitTasks,
  runLocationTileEmitStage,
}));

vi.mock('@hierarchidb/gen-iso3166-2/browser', () => ({
  ensureIso3166Data: vi.fn(async () => ({ source: 'memory' })),
  getAllCountries: vi.fn(async () => []),
  resolveIso3166CsvUrl: vi.fn(() => 'https://example.com/iso.csv'),
}));

const nodeId = 'location-canonical-events' as NodeId;
const sourcePlan = createLocationSourcePlan({
  dataSource: 'ourairports',
  selectedArrayByCountries: {
    JP: [false, true, false, false, false],
  },
});

describe('LocationBuildSession canonical events', () => {
  beforeEach(() => {
    replaceLocationArtifacts.mockReset();
    replaceLocationArtifacts.mockResolvedValue(undefined);
    runLocationSourceArtifactCleanup.mockReset();
    runLocationSourceArtifactCleanup.mockResolvedValue(undefined);
    strategySearch.mockReset();
    persistLocationGeometryArtifacts.mockReset();
    persistLocationGeometryArtifacts.mockResolvedValue({
      artifacts: [
        {
          geometryCacheId: 'geometry-0',
          bandIndex: 0,
          zMin: 0,
          zMax: 5,
          zBase: 0,
          featureCount: 1,
          tileCount: 1,
          inputHash: 'geometry-input',
          contentHash: 'geometry-content',
        },
      ],
      relationCount: 1,
    });
    prepareLocationTileEmitTasks.mockReset();
    prepareLocationTileEmitTasks.mockResolvedValue([
      {
        taskId: `${String(nodeId)}:location:tileEmit:0:0:0`,
        index: 2,
        inputData: {
          bandIndex: 0,
          zBase: 0,
          tileId: 0,
          bufferIds: ['geometry-0'],
          domainType: 'location',
          sourceKey: 'global',
        },
      },
    ]);
    runLocationTileEmitStage.mockReset();
    runLocationTileEmitStage.mockResolvedValue(undefined);
  });

  afterEach(() => {
    unconditionalEventStreamer.cleanup(nodeId);
  });

  it('emits the four canonical event types with authoritative source snapshots', async () => {
    strategySearch.mockResolvedValue([
      {
        schemaVersion: 2,
        pointId: 'point-1',
        name: 'Test airport',
        latitude: 35,
        longitude: 140,
        type: 'airport',
        renderRank: 1,
        importance: 0.9,
        iconKey: 'flight_takeoff',
        labelClass: 'major',
        minZoom: 3,
        admin0Code: 'JP',
        admin0: 'Japan',
      },
    ]);

    const events: CanonicalSessionEvent[] = [];
    const completed = new Promise<void>((resolve) => {
      unconditionalEventStreamer.subscribe(nodeId, 'session-state', (event) => {
        const canonicalEvent = event as CanonicalSessionEvent;
        events.push(canonicalEvent);
        if (
          canonicalEvent.type === 'sessionStatusUpdated' &&
          canonicalEvent.payload.phase === 'completed'
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

    const config: LocationBuildConfig = {
      searchConfigs: [{ dataSource: 'ourairports' }],
      processingOptions: { concurrent: 1 },
      mvt: createDefaultLocationMvtBuildConfig(),
    };
    const manager = new LocationBuildManager();
    await manager.startLocationBuildSession(nodeId, config, sourcePlan);
    await completed;

    await expect(manager.getBuildSessionStatus(nodeId)).resolves.toMatchObject({
      nodeId,
      status: 'completed',
    });
    await expect(manager.getBuildTasks(nodeId)).resolves.toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          stage: 'source',
          status: 'completed',
          progress: 100,
        }),
        expect.objectContaining({
          stage: 'geometry',
          status: 'completed',
          progress: 100,
        }),
        expect.objectContaining({
          stage: 'tileEmit',
          status: 'completed',
          progress: 100,
        }),
      ])
    );

    const sessionEvents = events.filter((event) => event.type === 'sessionStatusUpdated');
    expect(sessionEvents.at(0)?.payload.phase).toBe('idle');
    expect(sessionEvents.at(-1)?.payload.phase).toBe('completed');
    expect(sessionEvents.map((event) => event.payload.stageId)).toEqual(
      expect.arrayContaining(['source', 'geometry', 'tileEmit'])
    );
    expect(sessionEvents[1]?.payload.stageId).toBeUndefined();
    expect(sessionEvents[2]?.payload.stageId).toBe('source');
    expect(events.some((event) => event.type === 'heartbeat')).toBe(true);

    const progressEvents = events.filter((event) => event.type === 'taskProgressUpdated');
    expect(progressEvents.map((event) => event.payload.value)).toEqual([0, 100, 0, 100, 0, 100]);
    expect(progressEvents.map((event) => event.payload.version)).toEqual([2, 3, 2, 3, 2, 3]);

    const snapshots = events.filter((event) => event.type === 'stageSnapshotUpdated');
    expect(snapshots.map((event) => event.payload.stageId)).toEqual(
      expect.arrayContaining(['source', 'geometry', 'tileEmit'])
    );
    const finalSnapshot = snapshots.at(-1);
    expect(finalSnapshot?.payload.tasks).toEqual([
      expect.objectContaining({ status: 'completed', progress: 100, version: 3 }),
    ]);
    expect(finalSnapshot?.payload.stageCompletedAt).toEqual(expect.any(Number));
    expect(runLocationSourceArtifactCleanup).toHaveBeenCalledWith(nodeId);
    expect(replaceLocationArtifacts).toHaveBeenCalledWith(
      nodeId,
      expect.arrayContaining([expect.objectContaining({ pointId: 'point-1' })]),
      expect.objectContaining({
        nodeId,
        inputHash: sourcePlan.identity.inputHash,
        completedAt: expect.any(Number),
      })
    );
  });

  it('stops active processing and requeues the task before publishing paused state', async () => {
    const phases: string[] = [];
    let pausedAt: number | undefined;
    unconditionalEventStreamer.subscribe(nodeId, 'session-state', (event) => {
      if (event.type === 'sessionStatusUpdated') {
        phases.push(event.payload.phase);
        if (event.payload.phase === 'paused') pausedAt = event.payload.pausedAt;
      }
    });
    let finishSearch: (() => void) | null = null;
    const searchResult = new Promise<never[]>((resolve) => {
      finishSearch = () => resolve([]);
    });
    strategySearch.mockReturnValue(searchResult);
    const config: LocationBuildConfig = {
      searchConfigs: [{ dataSource: 'ourairports' }],
      processingOptions: { concurrent: 1 },
      mvt: createDefaultLocationMvtBuildConfig(),
    };
    const manager = new LocationBuildManager();
    await manager.startLocationBuildSession(nodeId, config, sourcePlan);
    await vi.waitFor(() => {
      expect(strategySearch).toHaveBeenCalledTimes(1);
    });

    const pausePromise = manager.pauseBuildSession(nodeId, 'route-leave');
    expect(phases.at(-1)).toBe('pausing');
    const completeSearch = finishSearch;
    if (!completeSearch) throw new Error('Search completion resolver is unavailable');
    completeSearch();
    await pausePromise;

    await expect(manager.getBuildSessionStatus(nodeId)).resolves.toMatchObject({
      status: 'paused',
      stopReason: 'route-leave',
    });
    expect(phases.slice(-2)).toEqual(['pausing', 'paused']);
    expect(pausedAt).toEqual(expect.any(Number));
    await expect(manager.getBuildTasks(nodeId)).resolves.toEqual([
      expect.objectContaining({
        stage: 'source',
        status: 'queued',
        progress: 0,
      }),
    ]);
    expect(replaceLocationArtifacts).not.toHaveBeenCalled();
    expect(runLocationSourceArtifactCleanup).not.toHaveBeenCalled();
  });

  it('publishes failed instead of converting a source failure into an empty success', async () => {
    strategySearch.mockRejectedValue(new Error('source unavailable'));
    const failed = new Promise<void>((resolve) => {
      unconditionalEventStreamer.subscribe(nodeId, 'session-state', (event) => {
        if (event.type === 'sessionStatusUpdated' && event.payload.phase === 'failed') resolve();
      });
    });
    const manager = new LocationBuildManager();
    await manager.startLocationBuildSession(
      nodeId,
      {
        searchConfigs: [{ dataSource: 'ourairports' }],
        processingOptions: { concurrent: 1 },
        mvt: createDefaultLocationMvtBuildConfig(),
      },
      sourcePlan
    );

    await failed;

    await expect(manager.getBuildSessionStatus(nodeId)).resolves.toMatchObject({
      status: 'failed',
      stopReason: 'failed',
      error: 'Location build completed with 1 failures',
    });
    await expect(manager.getBuildTasks(nodeId)).resolves.toEqual([
      expect.objectContaining({ status: 'failed', errorMessage: 'source unavailable' }),
    ]);
    expect(replaceLocationArtifacts).not.toHaveBeenCalled();
    expect(runLocationSourceArtifactCleanup).not.toHaveBeenCalled();
  });

  it('publishes auth-required as a paused resumable session', async () => {
    strategySearch.mockRejectedValue(
      Object.assign(new Error('Auth required: 401'), { code: 'BUILD_AUTH_REQUIRED' })
    );
    const paused = new Promise<void>((resolve) => {
      unconditionalEventStreamer.subscribe(nodeId, 'session-state', (event) => {
        if (event.type === 'sessionStatusUpdated' && event.payload.phase === 'paused') resolve();
      });
    });
    const manager = new LocationBuildManager();
    await manager.startLocationBuildSession(
      nodeId,
      {
        searchConfigs: [{ dataSource: 'ourairports' }],
        processingOptions: { concurrent: 1 },
        mvt: createDefaultLocationMvtBuildConfig(),
      },
      sourcePlan
    );

    await paused;

    await expect(manager.getBuildSessionStatus(nodeId)).resolves.toMatchObject({
      status: 'paused',
      stopReason: 'auth-required',
      error: 'Auth required: 401',
    });
    await expect(manager.getBuildTasks(nodeId)).resolves.toEqual([
      expect.objectContaining({ status: 'queued', progress: 0 }),
    ]);
    expect(replaceLocationArtifacts).not.toHaveBeenCalled();
    expect(runLocationSourceArtifactCleanup).not.toHaveBeenCalled();
  });

  it('marks geometry tasks failed when the geometry stage rejects', async () => {
    strategySearch.mockResolvedValue([createAirportPoint()]);
    persistLocationGeometryArtifacts.mockRejectedValue(new Error('geometry artifact failed'));
    const failed = new Promise<void>((resolve) => {
      unconditionalEventStreamer.subscribe(nodeId, 'session-state', (event) => {
        if (event.type === 'sessionStatusUpdated' && event.payload.phase === 'failed') resolve();
      });
    });
    const manager = new LocationBuildManager();
    await manager.startLocationBuildSession(
      nodeId,
      {
        searchConfigs: [{ dataSource: 'ourairports' }],
        processingOptions: { concurrent: 1 },
        mvt: createDefaultLocationMvtBuildConfig(),
      },
      sourcePlan
    );

    await failed;

    await expect(manager.getBuildSessionStatus(nodeId)).resolves.toMatchObject({
      status: 'failed',
      stopReason: 'failed',
      error: 'geometry artifact failed',
    });
    await expect(manager.getBuildTasks(nodeId)).resolves.toEqual(
      expect.arrayContaining([
        expect.objectContaining({ stage: 'source', status: 'completed' }),
        expect.objectContaining({
          stage: 'geometry',
          status: 'failed',
          errorMessage: 'geometry artifact failed',
        }),
      ])
    );
    expect(runLocationTileEmitStage).not.toHaveBeenCalled();
  });

  it('marks tileEmit tasks failed when tile emission rejects', async () => {
    strategySearch.mockResolvedValue([createAirportPoint()]);
    runLocationTileEmitStage.mockRejectedValue(new Error('tile emit failed'));
    const failed = new Promise<void>((resolve) => {
      unconditionalEventStreamer.subscribe(nodeId, 'session-state', (event) => {
        if (event.type === 'sessionStatusUpdated' && event.payload.phase === 'failed') resolve();
      });
    });
    const manager = new LocationBuildManager();
    await manager.startLocationBuildSession(
      nodeId,
      {
        searchConfigs: [{ dataSource: 'ourairports' }],
        processingOptions: { concurrent: 1 },
        mvt: createDefaultLocationMvtBuildConfig(),
      },
      sourcePlan
    );

    await failed;

    await expect(manager.getBuildSessionStatus(nodeId)).resolves.toMatchObject({
      status: 'failed',
      stopReason: 'failed',
      error: 'tile emit failed',
    });
    await expect(manager.getBuildTasks(nodeId)).resolves.toEqual(
      expect.arrayContaining([
        expect.objectContaining({ stage: 'source', status: 'completed' }),
        expect.objectContaining({ stage: 'geometry', status: 'completed' }),
        expect.objectContaining({
          stage: 'tileEmit',
          status: 'failed',
          errorMessage: 'tile emit failed',
        }),
      ])
    );
  });

  it('fails the session before replacing points when downstream artifact cleanup fails', async () => {
    strategySearch.mockResolvedValue([createAirportPoint()]);
    runLocationSourceArtifactCleanup.mockRejectedValue(
      new Error('vt-store-not-registered:location')
    );
    const failed = new Promise<void>((resolve) => {
      unconditionalEventStreamer.subscribe(nodeId, 'session-state', (event) => {
        if (event.type === 'sessionStatusUpdated' && event.payload.phase === 'failed') resolve();
      });
    });
    const manager = new LocationBuildManager();
    await manager.startLocationBuildSession(
      nodeId,
      {
        searchConfigs: [{ dataSource: 'ourairports' }],
        processingOptions: { concurrent: 1 },
        mvt: createDefaultLocationMvtBuildConfig(),
      },
      sourcePlan
    );

    await failed;

    await expect(manager.getBuildSessionStatus(nodeId)).resolves.toMatchObject({
      status: 'failed',
      stopReason: 'failed',
      error: 'vt-store-not-registered:location',
    });
    expect(replaceLocationArtifacts).not.toHaveBeenCalled();
  });
});

const createAirportPoint = () => ({
  schemaVersion: 2,
  pointId: 'point-1',
  name: 'Test airport',
  latitude: 35,
  longitude: 140,
  type: 'airport',
  renderRank: 1,
  importance: 0.9,
  iconKey: 'flight_takeoff',
  labelClass: 'major',
  minZoom: 3,
  admin0Code: 'JP',
  admin0: 'Japan',
});
