import { describe, expect, it, vi } from 'vitest';
import {
  buildLocationMvtLayerStyles,
  LOCATION_MVT_PROMOTE_ID,
  LOCATION_MVT_SOURCE_LAYER,
} from '../locationMvtLayerStyles.js';

vi.mock('@hierarchidb/ui-plugin-shell/ui-map', () => ({
  DEFAULT_LAYER_SETS: [
    {
      id: 'location',
      priority: 3,
      entries: [
        { id: 'location:points', label: 'Points', layerType: 'circle' },
        { id: 'location:symbols', label: 'Symbols', layerType: 'symbol' },
      ],
    },
  ],
  LOCATION_POINTS_ENTRY_ID: 'location:points',
  LOCATION_SYMBOLS_ENTRY_ID: 'location:symbols',
}));

describe('location MVT layer styles', () => {
  it('builds point, icon, and label layers for the canonical location MVT source layer', () => {
    const filter = ['==', ['get', 'type'], 'airport'];
    const layers = buildLocationMvtLayerStyles('layer-a', 'source-a', true, filter);

    expect(LOCATION_MVT_SOURCE_LAYER).toBe('location_points');
    expect(LOCATION_MVT_PROMOTE_ID).toBe('pointId');
    expect(layers.map((layer) => layer.kind)).toEqual(['points', 'icons', 'labels']);
    expect(layers.map((layer) => layer.layerConfig.sourceLayer)).toEqual([
      'location_points',
      'location_points',
      'location_points',
    ]);
    expect(layers.map((layer) => layer.layerConfig.visible)).toEqual([true, true, true]);
    expect(layers.map((layer) => layer.layerConfig.filter)).toEqual([filter, filter, filter]);
    expect(layers.map((layer) => layer.layerConfig.layerId)).toEqual([
      'layer-a-points',
      'layer-a-icons',
      'layer-a-labels',
    ]);
  });
});
