import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { NodeId } from '@hierarchidb/core-types';
import type { LocationPointProperties } from '../../../common/entities/LocationPoint.js';
import type { LocationBatchConfig } from '../../../common/entities/LocationEntity.js';

const { strategySearch } = vi.hoisted(() => ({
  strategySearch: vi.fn(),
}));

vi.mock('../../download/strategyRegistry.js', () => ({
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
  getAllCountries: vi.fn(async () => ([
    { alpha2: 'US', alpha3: 'USA', countryEn: 'United States', location: 'Americas' },
    { alpha2: 'JP', alpha3: 'JPN', countryEn: 'Japan', location: 'Asia' },
  ])),
  resolveIso3166CsvUrl: vi.fn(() => 'https://example.com/iso.csv'),
}));

describe('LocationBatchManager country normalization', () => {
  beforeEach(() => {
    strategySearch.mockReset();
  });

  it('normalizes country codes using ISO3166 mapping', async () => {
    const { LocationBatchManager } = await import('../../LocationBatchManager.js');
    const manager = new LocationBatchManager();
    const nodeId = 'node-1' as NodeId;
    (manager as { countryNameMap: Map<string, string> }).countryNameMap = new Map([
      ['us', 'US'],
      ['usa', 'US'],
      ['united states', 'US'],
      ['jp', 'JP'],
      ['jpn', 'JP'],
      ['japan', 'JP'],
    ]);

    strategySearch.mockResolvedValue([
      {
        schemaVersion: 2,
        pointId: 'point-1' as LocationPointProperties['pointId'],
        name: 'Alpha',
        latitude: 35.0,
        longitude: 140.0,
        type: 'airport',
        countryCode: 'USA',
        countryName: 'United States',
      },
      {
        schemaVersion: 2,
        pointId: 'point-2' as LocationPointProperties['pointId'],
        name: 'Bravo',
        latitude: 36.0,
        longitude: 139.0,
        type: 'port',
        countryCode: '',
        countryName: 'Japan',
      },
      {
        schemaVersion: 2,
        pointId: 'point-3' as LocationPointProperties['pointId'],
        name: 'Charlie',
        latitude: 34.0,
        longitude: 138.0,
        type: 'airport',
        countryCode: 'US',
        countryName: 'United States',
      },
      {
        schemaVersion: 2,
        pointId: 'point-4' as LocationPointProperties['pointId'],
        name: 'Delta',
        latitude: 33.0,
        longitude: 137.0,
        type: 'airport',
        countryCode: '',
        countryName: 'Unknownland',
      },
    ]);

    const config: LocationBatchConfig = {
      searchConfigs: [
        {
          dataSource: 'ourairports',
        },
      ],
      processingOptions: { concurrent: 1 },
    };

    const points = await manager.collectLocationPoints(nodeId, config);
    const byId = new Map(points.map((point) => [point.pointId, point]));

    expect(byId.get('point-1' as LocationPointProperties['pointId'])?.countryCode).toBe('US');
    expect(byId.get('point-2' as LocationPointProperties['pointId'])?.countryCode).toBe('JP');
    expect(byId.get('point-3' as LocationPointProperties['pointId'])?.countryCode).toBe('US');
    expect(byId.get('point-4' as LocationPointProperties['pointId'])?.countryCode).toBe('');
  }, 20000);
});
