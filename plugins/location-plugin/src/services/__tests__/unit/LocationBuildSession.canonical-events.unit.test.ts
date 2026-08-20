import type { CanonicalSessionEvent } from '@hierarchidb/build-api';
import { unconditionalEventStreamer } from '@hierarchidb/build-runtime-services';
import type { NodeId } from '@hierarchidb/core-types';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { LocationBuildConfig } from '../../../common/entities/LocationEntity';
import { LocationBuildManager } from '../../LocationBuildManager';

const { strategySearch } = vi.hoisted(() => ({
  strategySearch: vi.fn(),
}));

vi.mock('../../download/strategyRegistryUtils.js', () => ({
  getLocationStrategy: () => ({
    search: strategySearch,
  }),
}));

vi.mock('../../pointRepository.js', () => ({
  appendLocationPoints: vi.fn(async () => {}),
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

    const sessionEvents = events.filter((event) => event.type === 'sessionStatusUpdated');
    expect(sessionEvents.map((event) => event.payload.phase)).toEqual([
      'idle',
      'running',
      'completed',
    ]);
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
});
