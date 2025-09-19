import type { VectorTileLayerConfig } from '../types/unified-map-props.js';

export const pointCirclePreset = (opts?: {
  color?: string;
  radius?: number;
  stroke?: string;
  strokeWidth?: number;
  sourceLayer?: string
}): VectorTileLayerConfig => ({
  layerId: 'points-circle',
  sourceId: 'points-source',
  layerType: 'circle',
  sourceLayer: opts?.sourceLayer,
  paint: {
    'circle-color': opts?.color ?? '#1976d2',
    'circle-radius': opts?.radius ?? 4,
    'circle-stroke-color': opts?.stroke ?? '#ffffff',
    'circle-stroke-width': opts?.strokeWidth ?? 1,
  },
  minzoom: 0,
  maxzoom: 22,
  visible: true,
});

export const lineStrokePreset = (opts?: {
  color?: string;
  width?: number;
  sourceLayer?: string
}): VectorTileLayerConfig => ({
  layerId: 'lines-stroke',
  sourceId: 'lines-source',
  layerType: 'line',
  sourceLayer: opts?.sourceLayer,
  paint: {
    'line-color': opts?.color ?? '#0b8043',
    'line-width': opts?.width ?? 2,
  },
  minzoom: 0,
  maxzoom: 22,
  visible: true,
});

export const polygonFillPreset = (opts?: {
  fill?: string;
  outline?: string;
  sourceLayer?: string
}): VectorTileLayerConfig => ({
  layerId: 'polygons-fill',
  sourceId: 'polygons-source',
  layerType: 'fill',
  sourceLayer: opts?.sourceLayer,
  paint: {
    'fill-color': opts?.fill ?? 'rgba(0, 136, 136, 0.7)',
    'fill-outline-color': opts?.outline ?? '#004444',
  },
  minzoom: 0,
  maxzoom: 22,
  visible: true,
});
