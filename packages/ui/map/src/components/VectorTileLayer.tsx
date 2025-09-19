/**
 * @file VectorTileLayer.tsx
 * @description Vector tile layer component for MapLibre GL
 */

import React, { useEffect, useRef, useState } from 'react';
import type {
  GetResourceResponse,
  RequestParameters,
  SourceSpecification,
  VectorSourceSpecification,
} from 'maplibre-gl';
import { addProtocol } from 'maplibre-gl';
import type { MapLibreMapInstance } from '../types/maplibre-public.js';
import type { VectorTileProps } from '../types/unified-map-props.js';
import { DEFAULT_MAP_CONFIG } from '../types/unified-map-props.js';

// Global flag to ensure protocol is only registered once
let protocolRegistered = false;

// Use unified props with map instance required
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
                                                                }) => {
  const [sourceAdded, setSourceAdded] = useState(false);
  const [computedTiles, setComputedTiles] = useState<string[] | undefined>(tiles);
  const tilesLoadedRef = useRef(false);

  // Setup custom protocol for Dexie if needed
  useEffect(() => {
    if (!dbName || !nodeId || !tileDataProvider) return;

    if (!protocolRegistered) {
      try {
        addProtocol(
          'dexie',
          async (
            params: RequestParameters,
            _abortController: AbortController,
          ): Promise<GetResourceResponse<ArrayBuffer>> => {
            const urlParts = params.url.replace('dexie://', '').split('/').filter(Boolean);
            const [dbName, nodeId, z, x, y] = urlParts;

            if (!dbName || !nodeId || !z || !x || !y) {
              throw new Error(`Invalid dexie URL format: ${params.url}`);
            }

            const zInt = parseInt(z, 10);
            const xInt = parseInt(x, 10);
            const yInt = parseInt(y, 10);

            try {
              const tileData = await tileDataProvider(zInt, xInt, yInt, nodeId);

              if (tileData) {
                return {
                  data: tileData,
                  cacheControl: null,
                  expires: null,
                };
              } else {
                return {
                  data: new ArrayBuffer(0),
                  cacheControl: null,
                  expires: null,
                };
              }
            } catch (error) {
              console.warn(
                `[VectorTileLayer] Tile not found: z=${zInt}, x=${xInt}, y=${yInt}, nodeId=${nodeId}`,
                error,
              );
              return {
                data: new ArrayBuffer(0),
                cacheControl: null,
                expires: null,
              };
            }
          },
        );
        protocolRegistered = true;
      } catch (error) {
        protocolRegistered = true; // Assume it was already registered
      }
    }

    // Set up computed tiles
    if (!tilesLoadedRef.current) {
      tilesLoadedRef.current = true;
      const tileUrls = [`dexie://${dbName}/${nodeId}/{z}/{x}/{y}`];
      setComputedTiles(tileUrls);
    }
  }, [dbName, nodeId, tileDataProvider]);

  // Add vector tile source
  useEffect(() => {
    if (!map || !computedTiles) return;

    const mapRef = map;

    // Remove existing source and layer if they exist
    if (mapRef.getSource && mapRef.getSource(sourceId!)) {
      if (mapRef.getLayer && mapRef.getLayer(layerId!)) {
        mapRef.removeLayer(layerId!);
      }
      mapRef.removeSource(sourceId!);
    }

    // Create vector tile source
    const vectorTileSource: VectorSourceSpecification & SourceSpecification = {
      type: 'vector',
      tiles: computedTiles,
      minzoom,
      maxzoom,
    };

    try {
      mapRef.addSource(sourceId!, vectorTileSource as SourceSpecification);
      setSourceAdded(true);
    } catch (error) {
      if (error instanceof Error && error.message.includes('already exists')) {
        setSourceAdded(true);
      } else {
        console.error('Failed to add vector tile source:', error);
      }
    }

    return () => {
      try {
        if (mapRef && typeof mapRef.getStyle === 'function') {
          const style = mapRef.getStyle();
          if (style && style.layers) {
            if (mapRef.getLayer && mapRef.getLayer(layerId!)) {
              mapRef.removeLayer(layerId!);
            }
            if (mapRef.getSource && mapRef.getSource(sourceId!)) {
              mapRef.removeSource(sourceId!);
            }
          }
        }
      } catch (error) {
        console.debug('VectorTileLayer cleanup skipped due to map state:', error);
      }
    };
  }, [map, computedTiles, sourceId, minzoom, maxzoom, layerId]);

  // Add layer
  useEffect(() => {
    if (!map || !sourceAdded) return;

    const mapRef = map;

    // Remove existing layer if it exists
    if (mapRef.getLayer && mapRef.getLayer(layerId!)) {
      mapRef.removeLayer(layerId!);
    }

    try {
      const layerConfig: any = {
        id: layerId!,
        type: layerType,
        source: sourceId!,
        paint,
        layout: {
          visibility: visible ? 'visible' : 'none',
          ...layout,
        },
        minzoom,
        maxzoom,
      };

      // Add source-layer if specified (for vector tiles)
      if (sourceLayer) {
        layerConfig['source-layer'] = sourceLayer;
      }

      // Add filter if specified
      if (filter && Array.isArray(filter)) {
        layerConfig.filter = filter;
      }

      mapRef.addLayer(layerConfig as any);
    } catch (error) {
      if (!(error instanceof Error && error.message.includes('already exists'))) {
        console.error('Failed to add layer:', error);
      }
    }

    return () => {
      try {
        if (mapRef && typeof mapRef.getStyle === 'function') {
          const style = mapRef.getStyle();
          if (style && style.layers && mapRef.getLayer && mapRef.getLayer(layerId!)) {
            mapRef.removeLayer(layerId!);
          }
        }
      } catch (error) {
        console.debug('VectorTileLayer layer cleanup skipped due to map state:', error);
      }
    };
  }, [map, sourceAdded, layerId, layerType, sourceId, paint, layout, filter, visible, minzoom, maxzoom, sourceLayer]);

  // Update visibility
  useEffect(() => {
    if (!map || !map.getLayer || !map.getLayer(layerId!)) return;

    try {
      map.setLayoutProperty(layerId!, 'visibility', visible ? 'visible' : 'none');
    } catch (error) {
      console.warn('VectorTileLayer visibility update error:', error);
    }
  }, [map, layerId, visible]);

  return null;
};

export default VectorTileLayer;
