import { describe, expect, it } from 'vitest';
import { buildShapeLayerEntryId } from '../../preview/layerSetDefinitions';
import type { MapLibreGeoJSONFeature, MapLibreMapInstance } from '../../types/maplibre-public';
import { resolveVectorLayerFeatureCounts } from '../useResourceLayerMapStats';

type MockVectorLayerEntry = {
  id: string;
  sourceId?: string;
  sourceLayer?: string;
};

const createMockMap = (options: {
  sourceFeatures?: Record<string, Record<string, MapLibreGeoJSONFeature[]>>;
  renderedFeatures?: MapLibreGeoJSONFeature[];
  sources?: Record<string, unknown>;
}): MapLibreMapInstance => {
  const sourceFeatures = options.sourceFeatures ?? {};
  const renderedFeatures = options.renderedFeatures ?? [];
  const sources = options.sources ?? {};
  return {
    getStyle: () => ({ layers: [], sources: {} }),
    getLayer: () => undefined,
    isStyleLoaded: () => true,
    setLayoutProperty: () => {},
    setPaintProperty: () => {},
    getTerrain: () => null,
    setTerrain: () => {},
    once: () => {},
    on: () => {},
    getContainer: () => ({}) as HTMLElement,
    addLayer: () => {},
    getSource: (sourceId: string) => sources[sourceId],
    addSource: () => {},
    removeSource: () => {},
    removeLayer: () => {},
    addControl: () => {},
    removeControl: () => {},
    querySourceFeatures: (sourceId, { sourceLayer }) => {
      if (!sourceLayer) return [];
      return sourceFeatures[sourceId]?.[sourceLayer] ?? [];
    },
    queryRenderedFeatures: () => renderedFeatures,
    setFeatureState: () => {},
    removeFeatureState: () => {},
    getCenter: () => ({ lng: 0, lat: 0 }),
    getZoom: () => 0,
    getCanvas: () => ({}) as HTMLCanvasElement,
    getBounds: () => ({
      getWest: () => 0,
      getSouth: () => 0,
      getEast: () => 1,
      getNorth: () => 1,
    }),
    getBearing: () => 0,
    getPitch: () => 0,
    zoomIn: () => {},
    zoomOut: () => {},
    flyTo: () => {},
    jumpTo: () => {},
    setPitch: () => {},
    setStyle: () => {},
    fitBounds: () => {},
    off: () => {},
    showTileBoundaries: false,
    showTileCoordinates: false,
  } as MapLibreMapInstance;
};

describe('resolveVectorLayerFeatureCounts', () => {
  const sourceFeatureMap = {
    'shape-source': {
      '0': [{ id: 'a0' }, { id: 'a1' }],
      '0-b': [{ id: 'b0' }, { id: 'b1' }, { id: 'b2' }],
      '1': [{ id: 'c0' }],
      '1-b': [{ id: 'd0' }, { id: 'd1' }],
    },
  };

  it('counts features per vector layer entry from source-layer queries', () => {
    const map = createMockMap({
      sourceFeatures: sourceFeatureMap,
      sources: { 'shape-source': {} },
    });
    const vectorLayerEntries: MockVectorLayerEntry[] = [
      { id: buildShapeLayerEntryId(0, false), sourceId: 'shape-source', sourceLayer: '0' },
      { id: buildShapeLayerEntryId(0, true), sourceId: 'shape-source', sourceLayer: '0-b' },
      { id: buildShapeLayerEntryId(1, false), sourceId: 'shape-source', sourceLayer: '1' },
      { id: buildShapeLayerEntryId(1, true), sourceId: 'shape-source', sourceLayer: '1-b' },
    ];

    const counts = resolveVectorLayerFeatureCounts(map, vectorLayerEntries);

    expect(counts[buildShapeLayerEntryId(0, false)]).toBe(2);
    expect(counts[buildShapeLayerEntryId(0, true)]).toBe(3);
    expect(counts[buildShapeLayerEntryId(1, false)]).toBe(1);
    expect(counts[buildShapeLayerEntryId(1, true)]).toBe(2);
  });

  it('falls back to rendered features when sourceLayer is missing', () => {
    const map = createMockMap({
      sourceFeatures: {},
      renderedFeatures: [
        {
          id: 1,
          layer: { id: buildShapeLayerEntryId(0, false) },
          source: 'shape-source',
          sourceLayer: '0',
        },
        {
          id: 2,
          layer: { id: buildShapeLayerEntryId(0, false) },
          source: 'shape-source',
          sourceLayer: '0',
        },
        {
          id: 3,
          layer: { id: buildShapeLayerEntryId(1, false) },
          source: 'shape-source',
          sourceLayer: '1',
        },
      ],
      sources: { 'shape-source': {} },
    });
    const vectorLayerEntries: MockVectorLayerEntry[] = [
      { id: buildShapeLayerEntryId(0, false), sourceId: 'shape-source' },
      { id: buildShapeLayerEntryId(1, false), sourceId: 'shape-source' },
    ];

    const counts = resolveVectorLayerFeatureCounts(map, vectorLayerEntries);

    expect(counts[buildShapeLayerEntryId(0, false)]).toBe(2);
    expect(counts[buildShapeLayerEntryId(1, false)]).toBe(1);
  });

  it('ignores entries without source and does not throw', () => {
    const map = createMockMap({
      sourceFeatures: sourceFeatureMap,
      sources: { 'shape-source': {} },
    });
    const vectorLayerEntries: MockVectorLayerEntry[] = [
      { id: 'orphan', sourceId: 'shape-source' },
      { id: 'no-source', sourceLayer: '0' },
      { id: buildShapeLayerEntryId(0, false), sourceId: 'shape-source', sourceLayer: '0' },
    ];

    const counts = resolveVectorLayerFeatureCounts(map, vectorLayerEntries);

    expect(counts.orphan).toBe(0);
    expect(counts['no-source']).toBe(0);
    expect(counts[buildShapeLayerEntryId(0, false)]).toBe(2);
  });
});
