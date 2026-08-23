/**
 * @file VectorTileLayer.tsx
 * @description Vector tile layer component for MapLibre GL
 */

import type React from 'react';
import type { MapLibreMapInstance } from '~/types/maplibre-public';
import type { VectorTileProps } from '~/types/unified-map-props';
import { DEFAULT_MAP_CONFIG } from '~/types/unified-map-props';
import { useVectorTileLayer } from './useVectorTileLayer.js';

export interface VectorTileLayerProps extends VectorTileProps {
  /** MapLibre map instance (required for this component) */
  map: MapLibreMapInstance;
}

const defaultPaint = DEFAULT_MAP_CONFIG.vectorTileLayer.paint;

export const VectorTileLayer: React.FC<VectorTileLayerProps> = ({
  map,
  dbName,
  nodeId,
  layerId = DEFAULT_MAP_CONFIG.vectorTileLayer.layerId,
  sourceId = DEFAULT_MAP_CONFIG.vectorTileLayer.sourceId,
  tiles,
  paint = defaultPaint,
  layout = {},
  filter,
  minzoom = DEFAULT_MAP_CONFIG.vectorTileLayer.minzoom,
  maxzoom = DEFAULT_MAP_CONFIG.vectorTileLayer.maxzoom,
  visible = DEFAULT_MAP_CONFIG.vectorTileLayer.visible,
  layerType = DEFAULT_MAP_CONFIG.vectorTileLayer.layerType,
  sourceLayer,
  tileDataProvider,
  onTileRequest,
  onTileError,
  promoteId,
  featureState,
}) => {
  useVectorTileLayer({
    map,
    dbName,
    nodeId,
    layerId,
    sourceId,
    tiles,
    paint,
    layout,
    filter,
    minzoom,
    maxzoom,
    visible,
    layerType,
    sourceLayer,
    tileDataProvider,
    onTileRequest,
    onTileError,
    promoteId,
    featureState,
  });

  return null;
};
