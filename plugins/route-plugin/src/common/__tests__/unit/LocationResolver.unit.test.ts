import type { NodeId } from '@hierarchidb/core-types';
import { describe, expect, it } from 'vitest';
import { LocationResolver } from '../../../services/LocationResolver';

type LocationFeatureRecord = {
  id: string;
  nodeId: NodeId;
  type: string;
  data: {
    name: string;
    latitude: number;
    longitude: number;
    pointId?: string;
    type?: string;
  };
};

const buildMockLocationTable = (rows: LocationFeatureRecord[]) => ({
  async toArray(): Promise<LocationFeatureRecord[]> {
    return rows;
  },
  where(key: 'nodeId') {
    return {
      equals(nodeId: string) {
        return {
          toArray: () => Promise.resolve(rows.filter((row) => row.nodeId === nodeId)),
        };
      },
    };
  },
});

describe('LocationResolver', () => {
  it('resolves by exact nodeId from injected location DB', async () => {
    const rows: LocationFeatureRecord[] = [
      {
        id: 'loc_tokyo' as NodeId,
        nodeId: 'node-1' as NodeId,
        type: 'airport',
        data: {
          name: 'Tokyo Haneda',
          latitude: 35.5494,
          longitude: 139.7798,
          pointId: 'pt_tokyo',
        },
      },
    ];

    const db = {
      open: async () => undefined,
      features: buildMockLocationTable(rows),
    };
    const resolver = new LocationResolver({ db });

    const a = await resolver.getLocation('node-1' as NodeId);
    const b = await resolver.getLocation('node-1' as NodeId);

    expect(a).not.toBeNull();
    expect(b).not.toBeNull();
    expect(a?.coordinates).toEqual([139.7798, 35.5494]);
    expect(a?.nodeId).toBe('node-1' as NodeId);
    expect(b).toStrictEqual(a);
  });

  it('falls back to pointId search when nodeId does not match', async () => {
    const rows: LocationFeatureRecord[] = [
      {
        id: 'loc_kansai' as NodeId,
        nodeId: 'node-2' as NodeId,
        type: 'airport',
        data: {
          name: 'Kansai Airport',
          latitude: 34.7855,
          longitude: 135.4382,
          pointId: 'kix-01',
        },
      },
    ];

    const db = {
      open: async () => undefined,
      features: buildMockLocationTable(rows),
    };
    const resolver = new LocationResolver({ db });

    const loc = await resolver.getLocation('kix-01' as NodeId);

    expect(loc).not.toBeNull();
    expect(loc?.name).toBe('Kansai Airport');
    expect(loc?.nodeId).toBe('node-2' as NodeId);
  });

  it('keeps map keys as requested nodeIds for getLocations', async () => {
    const rows: LocationFeatureRecord[] = [
      {
        id: 'loc_osaka' as NodeId,
        nodeId: 'node-3' as NodeId,
        type: 'airport',
        data: {
          name: 'Osaka',
          latitude: 34.7025,
          longitude: 135.4959,
          pointId: 'osaka-01',
        },
      },
    ];

    const db = {
      open: async () => undefined,
      features: buildMockLocationTable(rows),
    };
    const resolver = new LocationResolver({ db });

    const map = await resolver.getLocations(['node-3' as NodeId, 'node-missing' as NodeId]);

    expect(map.size).toBe(1);
    expect(map.get('node-3' as NodeId)).toBeDefined();
    expect(map.get('node-3' as NodeId)?.nodeId).toBe('node-3' as NodeId);
    expect(map.has('node-missing' as NodeId)).toBe(false);
  });

  it('searches by name and bounds', async () => {
    const rows: LocationFeatureRecord[] = [
      {
        id: 'loc_osaka' as NodeId,
        nodeId: 'node-3' as NodeId,
        type: 'airport',
        data: {
          name: 'Osaka Center',
          latitude: 34.7025,
          longitude: 135.4959,
          type: 'airport',
        },
      },
      {
        id: 'loc_sapporo' as NodeId,
        nodeId: 'node-4' as NodeId,
        type: 'airport',
        data: {
          name: 'Sapporo Center',
          latitude: 43.111,
          longitude: 141.111,
          type: 'airport',
        },
      },
    ];

    const db = {
      open: async () => undefined,
      features: buildMockLocationTable(rows),
    };
    const resolver = new LocationResolver({ db });

    const hits = await resolver.searchLocations({
      name: 'center',
      bounds: [
        [134.5, 33.0],
        [136.5, 36.0],
      ],
    });

    expect(hits).toHaveLength(1);
    expect(hits[0]?.name).toBe('Osaka Center');
  });

  it('does exact type match before partial match', async () => {
    const rows: LocationFeatureRecord[] = [
      {
        id: 'loc_exact' as NodeId,
        nodeId: 'node-5' as NodeId,
        type: 'train-station',
        data: {
          name: 'Airport Hub',
          latitude: 35.0,
          longitude: 136.0,
          pointId: 'search-key-airport',
        },
      },
      {
        id: 'loc_partial' as NodeId,
        nodeId: 'node-6' as NodeId,
        type: 'airport',
        data: {
          name: 'Airport Center',
          latitude: 35.7,
          longitude: 136.9,
          pointId: 'partial-airport-flag',
        },
      },
    ];

    const db = {
      open: async () => undefined,
      features: buildMockLocationTable(rows),
    };
    const resolver = new LocationResolver({ db });

    const hits = await resolver.searchLocations({
      type: 'airport',
      name: 'airport',
    });

    expect(hits).toHaveLength(1);
    expect(hits[0]?.nodeId).toBe('node-6' as NodeId);
    expect(hits[0]?.name).toBe('Airport Center');
  });

  it('ignores rows with invalid coordinates when searching by bounds', async () => {
    const rows: LocationFeatureRecord[] = [
      {
        id: 'loc_invalid' as NodeId,
        nodeId: 'node-7' as NodeId,
        type: 'airport',
        data: {
          name: 'Invalid Coord',
          latitude: Number.NaN,
          longitude: 135.0,
        },
      },
      {
        id: 'loc_valid' as NodeId,
        nodeId: 'node-8' as NodeId,
        type: 'airport',
        data: {
          name: 'Valid Coord',
          latitude: 35.4,
          longitude: 135.6,
        },
      },
    ];

    const db = {
      open: async () => undefined,
      features: buildMockLocationTable(rows),
    };
    const resolver = new LocationResolver({ db });

    const hits = await resolver.searchLocations({
      bounds: [
        [135, 35],
        [136, 36],
      ],
    });

    expect(hits).toHaveLength(1);
    expect(hits[0]?.name).toBe('Valid Coord');
  });
});
