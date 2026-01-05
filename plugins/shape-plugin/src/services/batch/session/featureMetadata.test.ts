import { describe, expect, it } from 'vitest';
import type { Feature } from 'geojson';
import type { NodeId } from '@hierarchidb/common-types';
import type { DownloadTaskPayload } from '../../../common/types/index.js';
import type { ShapeFeatureMetadataRow } from '@hierarchidb/plugin-service-api';
import {
  buildFeatureMetadataRecords,
  persistPlaceholderMetadata,
  type FeatureMetadataStore,
} from './metadata/featureMetadata.js';

// Note: We keep these tests unit-level and avoid Dexie/DB.

describe('featureMetadata', () => {
  it('buildFeatureMetadataRecords: assigns featureId and writes properties.id side-effect', () => {
    const features: Feature[] = [
      {
        type: 'Feature',
        geometry: { type: 'Point', coordinates: [139.7, 35.6] },
        properties: { id: 'tokyo', name: 'tokyo', countryCode: 'JPN' },
      },
    ];

    const rows = buildFeatureMetadataRecords({
      nodeId: 'node-1' as NodeId,
      dataSource: 'naturalearth',
      createdAt: 123,
      features,
      pickers: {
        pickCountryName: () => 'Japan',
        pickCountryCode: (props) => (typeof props.countryCode === 'string' ? props.countryCode : undefined),
        pickAdminName: () => undefined,
        pickAdminCode: () => undefined,
        pickAdminLevel: () => 0,
        pickFirstString: (props, keys) => {
          for (const key of keys) {
            const value = props[key];
            if (typeof value === 'string') return value;
          }
          return undefined;
        },
      },
      buildFeatureId: (base, index) => `${base}:${index}`,
      extractGeometryStats: () => ({
        vertexCount: 1,
        polygonCount: 0,
        bbox: [139.7, 35.6, 139.7, 35.6],
        area: 0,
      }),
    });

    expect(rows).toHaveLength(1);
    expect(rows[0]?.featureId).toBe('tokyo:0');
    expect((features[0]?.properties as Record<string, unknown>).id).toBe('tokyo:0');
  });

  it('persistPlaceholderMetadata: generates unique placeholder rows per payload when enabled', async () => {
    const stored: ShapeFeatureMetadataRow[] = [];
    const store: FeatureMetadataStore = {
      putFeatureMetadata: async (rows) => {
        stored.push(...rows);
      },
      listFeatureMetadata: async () => [],
      deleteFeatureMetadataByNode: async () => {},
      listVectorTileRows: async () => [],
    };

    const downloadTaskPayloads: DownloadTaskPayload[] = [
      { dataSource: 'naturalearth', countryCode: 'jpn', adminLevel: 0, countryName: 'Japan' } as DownloadTaskPayload,
      { dataSource: 'naturalearth', countryCode: 'jpn', adminLevel: 0, countryName: 'Japan' } as DownloadTaskPayload,
      { dataSource: 'naturalearth', countryCode: 'usa', adminLevel: 1, countryName: 'United States' } as DownloadTaskPayload,
    ];

    const created = await persistPlaceholderMetadata({
      enabled: true,
      replace: true,
      nodeId: 'node-1' as NodeId,
      downloadTaskPayloads,
      store,
    });

    expect(created).toBe(2);
    expect(stored).toHaveLength(2);
    const featureIds = stored.map((row) => row.featureId).sort();
    expect(featureIds).toEqual([
      'naturalearth:JPN:0',
      'naturalearth:USA:1',
    ]);
  });
});
