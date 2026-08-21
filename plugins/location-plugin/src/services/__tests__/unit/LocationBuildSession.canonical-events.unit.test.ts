import type { CanonicalSessionEvent } from '@hierarchidb/build-api';
import { unconditionalEventStreamer } from '@hierarchidb/build-runtime-services';
import type { NodeId } from '@hierarchidb/core-types';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { LocationBuildConfig } from '../../../common/entities/LocationEntity';
import { LocationBuildManager } from '../../LocationBuildManager';

const { appendLocationPoints, strategySearch } = vi.hoisted(() => ({
  appendLocationPoints: vi.fn(),
  strategySearch: vi.fn(),
}));

vi.mock('../../download/strategyRegistryUtils.js', () => ({
  getLocationStrategy: () => ({
    search: strategySearch,
  }),
}));

vi.mock('../../pointRepository.js', () => ({
  appendLocationPoints,
  replaceLocationPoints: vi.fn(async () => {}),
}));

vi.mock('@hierarchidb/gen-iso3166-2/browser', () => ({
  ensureIso3166Data: vi.fn(async () => ({ source: 'memory' })),
  getAllCountries: vi.fn(async () => []),
  resolveIso3166CsvUrl: vi.fn(() => 'https://example.com/iso.csv'),
}));

const nodeId = 'location-canonical-events' as NodeId;

describe('LocationBuildSession canonical events', () => {
  beforeEach(() => {
    appendLocationPoints.mockReset();
    appendLocationPoints.mockResolvedValue(undefined);
    strategySearch.mockReset();
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
    };
    const manager = new LocationBuildManager();
    await manager.startLocationBuildSession(nodeId, config);
    await completed;

    await expect(manager.getBuildSessionStatus(nodeId)).resolves.toMatchObject({
      nodeId,
      status: 'completed',
    });
    await expect(manager.getBuildTasks(nodeId)).resolves.toEqual([
      expect.objectContaining({
        stage: 'source',
        status: 'completed',
        progress: 100,
      }),
    ]);

    const sessionEvents = events.filter((event) => event.type === 'sessionStatusUpdated');
    expect(sessionEvents.map((event) => event.payload.phase)).toEqual([
      'idle',
      'running',
      'running',
      'completed',
    ]);
    expect(sessionEvents[1]?.payload.stageId).toBeUndefined();
    expect(sessionEvents[2]?.payload.stageId).toBe('source');
    expect(events.some((event) => event.type === 'heartbeat')).toBe(true);

    const progressEvents = events.filter((event) => event.type === 'taskProgressUpdated');
    expect(progressEvents.map((event) => event.payload.value)).toEqual([0, 100]);
    expect(progressEvents.map((event) => event.payload.version)).toEqual([2, 3]);

    const snapshots = events.filter((event) => event.type === 'stageSnapshotUpdated');
    expect(snapshots).toHaveLength(4);
    expect(snapshots.every((event) => event.payload.stageId === 'source')).toBe(true);
    const finalSnapshot = snapshots.at(-1);
    expect(finalSnapshot?.payload.tasks).toEqual([
      expect.objectContaining({ status: 'completed', progress: 100, version: 3 }),
    ]);
    expect(finalSnapshot?.payload.stageCompletedAt).toEqual(expect.any(Number));
  });

  it('stops active processing and requeues the task before publishing paused state', async () => {
    const phases: string[] = [];
    unconditionalEventStreamer.subscribe(nodeId, 'session-state', (event) => {
      if (event.type === 'sessionStatusUpdated') phases.push(event.payload.phase);
    });
    let finishSearch: (() => void) | null = null;
    const searchResult = new Promise<never[]>((resolve) => {
      finishSearch = () => resolve([]);
    });
    strategySearch.mockReturnValue(searchResult);
    const config: LocationBuildConfig = {
      searchConfigs: [{ dataSource: 'ourairports' }],
      processingOptions: { concurrent: 1 },
    };
    const manager = new LocationBuildManager();
    await manager.startLocationBuildSession(nodeId, config);
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
    await expect(manager.getBuildTasks(nodeId)).resolves.toEqual([
      expect.objectContaining({
        stage: 'source',
        status: 'queued',
        progress: 0,
      }),
    ]);
    expect(appendLocationPoints).not.toHaveBeenCalled();
  });

  it('publishes failed instead of converting a source failure into an empty success', async () => {
    strategySearch.mockRejectedValue(new Error('source unavailable'));
    const failed = new Promise<void>((resolve) => {
      unconditionalEventStreamer.subscribe(nodeId, 'session-state', (event) => {
        if (event.type === 'sessionStatusUpdated' && event.payload.phase === 'failed') resolve();
      });
    });
    const manager = new LocationBuildManager();
    await manager.startLocationBuildSession(nodeId, {
      searchConfigs: [{ dataSource: 'ourairports' }],
      processingOptions: { concurrent: 1 },
    });

    await failed;

    await expect(manager.getBuildSessionStatus(nodeId)).resolves.toMatchObject({
      status: 'failed',
      stopReason: 'failed',
      error: 'Location build completed with 1 failures',
    });
    await expect(manager.getBuildTasks(nodeId)).resolves.toEqual([
      expect.objectContaining({ status: 'failed', errorMessage: 'source unavailable' }),
    ]);
    expect(appendLocationPoints).not.toHaveBeenCalled();
  });
});
