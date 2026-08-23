import type { LocationPointProperties } from '@hierarchidb/location-api';
import { describe, expect, it } from 'vitest';
import { createLocationPointDatasetHash } from '../../persistLocationSourceArtifact.js';

const point = (overrides: Partial<LocationPointProperties> = {}): LocationPointProperties => ({
  schemaVersion: 2,
  pointId: 'point-1',
  name: 'Tokyo',
  latitude: 35.681236,
  longitude: 139.767125,
  type: 'airport',
  renderRank: 1,
  importance: 0.9,
  iconKey: 'flight_takeoff',
  labelClass: 'major',
  minZoom: 3,
  admin0Code: 'JP',
  metadata: {
    source: 'fixture',
    tags: {
      rank: 1,
    },
  },
  ...overrides,
});

describe('createLocationPointDatasetHash', () => {
  it('changes when any persisted point content changes', () => {
    const baseHash = createLocationPointDatasetHash([point()]);

    expect(createLocationPointDatasetHash([point({ name: 'Tokyo Station' })])).not.toBe(baseHash);
    expect(
      createLocationPointDatasetHash([
        point({
          metadata: {
            source: 'fixture',
            tags: {
              rank: 2,
            },
          },
        }),
      ])
    ).not.toBe(baseHash);
  });

  it('is stable for object key order and point order', () => {
    const left = createLocationPointDatasetHash([
      point({
        pointId: 'point-2',
        metadata: { b: 2, a: 1 },
      }),
      point({ pointId: 'point-1' }),
    ]);
    const right = createLocationPointDatasetHash([
      point({ pointId: 'point-1' }),
      point({
        pointId: 'point-2',
        metadata: { a: 1, b: 2 },
      }),
    ]);

    expect(left).toBe(right);
  });
});
