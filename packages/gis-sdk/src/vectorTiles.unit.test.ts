import type { NodeId } from '@hierarchidb/core-types';
import { VectorTile } from '@mapbox/vector-tile';
import type { Feature, FeatureCollection, Polygon } from 'geojson';
import Pbf from 'pbf';
import { describe, expect, it } from 'vitest';
import { generateVectorTilesFromFeatureCollection } from './vectorTiles/index';

const toNodeId = (value: string): NodeId => value as NodeId;

const polygonFeatureCollection = (
  featureRows: Array<{
    name: string;
    properties: Record<string, unknown>;
  }>
): FeatureCollection<Polygon, Record<string, unknown>> => ({
  type: 'FeatureCollection',
  features: featureRows.map((feature, index) => ({
    type: 'Feature',
    id: `source-${feature.name}-${index}`,
    properties: feature.properties,
    geometry: {
      type: 'Polygon',
      coordinates: [
        [
          [0, 0],
          [0.5, 0],
          [0.5, 0.5],
          [0, 0.5],
          [0, 0],
        ],
      ],
    },
  })),
});

const extractTileLayers = (data: Uint8Array, z: number, x: number, y: number): string[] => {
  const tile = new VectorTile(new Pbf(data));
  return Object.keys(tile.layers).map((name) => name);
};

describe('vectorTiles layer name resolution', () => {
  it('normalizes canonical shape layer properties into source-layer names', async () => {
    const collection = polygonFeatureCollection([
      { name: 'fill', properties: { layer: '0' } },
      { name: 'fill_upper', properties: { sourceLayer: '1' } },
      { name: 'boundary', properties: { source_layer: '2-b' } },
    ]);

    const result = await generateVectorTilesFromFeatureCollection(
      toNodeId('node:shape:legacy'),
      collection,
      {
        minZoom: 0,
        maxZoom: 0,
        metadataEnabled: false,
      }
    );

    expect(result.tiles.length).toBe(1);
    const first = result.tiles[0];
    expect(first).toBeTruthy();
    const layerNames = extractTileLayers(first.data, 0, 0, 0);
    expect(layerNames).toContain('0');
    expect(layerNames).toContain('1');
    expect(layerNames).toContain('2-b');
    expect(layerNames).toHaveLength(3);
  });

  it('keeps fill and boundary layers separated by admin level and boundary flag', async () => {
    const collection = polygonFeatureCollection([
      { name: 'fill', properties: { adminLevel: 1, boundary: 'fill' } },
      { name: 'boundary', properties: { adminLevel: 1, boundary: 'boundary' } },
      { name: '0', properties: { adminLevel: 0 } },
    ]);

    const result = await generateVectorTilesFromFeatureCollection(
      toNodeId('node:shape:mode'),
      collection,
      {
        minZoom: 0,
        maxZoom: 0,
        metadataEnabled: false,
      }
    );

    const first = result.tiles[0];
    expect(first).toBeTruthy();
    const layerNames = extractTileLayers(first.data, 0, 0, 0).sort();
    expect(layerNames).toEqual(['0', '1', '1-b']);
  });

  it('normalizes canonical boundary markers and keeps canonical names', async () => {
    const collection = polygonFeatureCollection([
      { name: 'symbolicFill', properties: { layer: '0' } },
      { name: 'symbolicBoundary', properties: { layer: '2-b' } },
    ]);

    const result = await generateVectorTilesFromFeatureCollection(
      toNodeId('node:shape:mode'),
      collection,
      {
        minZoom: 0,
        maxZoom: 0,
        metadataEnabled: false,
      }
    );

    expect(result.tiles.length).toBe(1);
    const first = result.tiles[0];
    expect(first).toBeTruthy();
    const layerNames = extractTileLayers(first.data, 0, 0, 0).sort();
    expect(layerNames).toEqual(['0', '2-b']);
  });

  it('rejects symbolic and non-canonical shape layer names', async () => {
    const collection = polygonFeatureCollection([
      { name: 'legacyFill', properties: { layer: 'shape-adm0' } },
      { name: 'short', properties: { layer: '1-boundary' } },
      { name: 'symbolic', properties: { layer: 's-2-b' } },
    ]);

    const result = await generateVectorTilesFromFeatureCollection(
      toNodeId('node:shape:legacy'),
      collection,
      {
        minZoom: 0,
        maxZoom: 0,
        metadataEnabled: false,
        metadataContext: {
          adminLevel: 1,
        },
      }
    );

    expect(result.tiles.length).toBe(1);
    const first = result.tiles[0];
    expect(first).toBeTruthy();
    const layerNames = extractTileLayers(first.data, 0, 0, 0).sort();
    expect(layerNames).toEqual(['1']);
  });
});
