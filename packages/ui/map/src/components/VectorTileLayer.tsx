/**
 * @file VectorTileLayer.tsx
 * @description Vector tile layer component for MapLibre GL
 */

import type React from 'react';
import { useEffect, useRef, useState } from 'react';
import type {
  GetResourceResponse,
  RequestParameters,
  SourceSpecification,
  VectorSourceSpecification,
} from 'maplibre-gl';
import type { MapLibreMapInstance } from '../types/maplibre-public.js';
import type { FeatureStateRecord, VectorTileProps } from '../types/unified-map-props.js';
import { DEFAULT_MAP_CONFIG } from '../types/unified-map-props.js';
import { loadMapLibreModule } from '../utils/maplibre-loader.js';

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
                                                                  promoteId,
                                                                  featureState,
                                                                }) => {
  const [sourceAdded, setSourceAdded] = useState(false);
  const [computedTiles, setComputedTiles] = useState<string[] | undefined>(tiles);
  const tilesLoadedRef = useRef(false);
  const prevFeatureStateRef = useRef<Map<string | number, FeatureStateRecord>>(new Map());

  // Setup custom protocol for Dexie if needed
  useEffect(() => {
    let cancelled = false;

    async function ensureProtocolAndTiles() {
      if (!dbName || !nodeId || !tileDataProvider) return;

      if (!protocolRegistered) {
        const mlib = await loadMapLibreModule();
        if (cancelled || !mlib) return;
        try {
          mlib.addProtocol(
            'dexie',
            async (
              params: RequestParameters,
              _abortController: AbortController,
            ): Promise<GetResourceResponse<ArrayBuffer>> => {
              const urlParts = params.url.replace('dexie://', '').split('/').filter(Boolean);
              const [dbNameFromUrl, nodeIdFromUrl, z, x, y] = urlParts;

              if (!dbNameFromUrl || !nodeIdFromUrl || !z || !x || !y) {
                throw new Error(`Invalid dexie URL format: ${params.url}`);
              }

              const zInt = parseInt(z, 10);
              const xInt = parseInt(x, 10);
              const yInt = parseInt(y, 10);

              try {
                const tileData = await tileDataProvider(zInt, xInt, yInt, nodeIdFromUrl);

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
                  `[VectorTileLayer] Tile not found: z=${zInt}, x=${xInt}, y=${yInt}, nodeId=${nodeIdFromUrl}`,
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
        } catch {
          protocolRegistered = true; // Assume it was already registered elsewhere
        }
      }

      if (!tilesLoadedRef.current) {
        tilesLoadedRef.current = true;
        const tileUrls = [`dexie://${dbName}/${nodeId}/{z}/{x}/{y}`];
        if (!cancelled) setComputedTiles(tileUrls);
      }
    }

    void ensureProtocolAndTiles();

    return () => {
      cancelled = true;
    };
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
    if (promoteId) {
      vectorTileSource.promoteId = promoteId as VectorSourceSpecification['promoteId'];
    }

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
  }, [map, computedTiles, sourceId, minzoom, maxzoom, layerId, promoteId]);

  // Apply feature-state values
  useEffect(() => {
    if (!map || !sourceAdded || !featureState) return;
    const mapRef = map;
    if (!mapRef.getSource || !mapRef.getSource(sourceId!)) return;

    const removeStateKeys = (id: string | number, state: FeatureStateRecord) => {
      Object.keys(state).forEach((key) => {
        try {
          mapRef.removeFeatureState({ source: sourceId!, id, key });
        } catch (error) {
          console.debug('VectorTileLayer feature-state cleanup skipped:', error);
        }
      });
    };

    if (featureState.length === 0) {
      prevFeatureStateRef.current.forEach((state, id) => removeStateKeys(id, state));
      prevFeatureStateRef.current = new Map();
      return;
    }

    const nextStateMap = new Map<string | number, FeatureStateRecord>();

    featureState.forEach((entry) => {
      const prevState = prevFeatureStateRef.current.get(entry.id);
      if (prevState) {
        Object.keys(prevState).forEach((key) => {
          if (!(key in entry.state)) {
            try {
              mapRef.removeFeatureState({ source: sourceId!, id: entry.id, key });
            } catch (error) {
              console.debug('VectorTileLayer feature-state cleanup skipped:', error);
            }
          }
        });
      }
      try {
        mapRef.setFeatureState({ source: sourceId!, id: entry.id }, entry.state);
      } catch (error) {
        console.debug('VectorTileLayer setFeatureState error:', error);
      }
      nextStateMap.set(entry.id, entry.state);
    });

    prevFeatureStateRef.current.forEach((state, id) => {
      if (!nextStateMap.has(id)) {
        removeStateKeys(id, state);
      }
    });

    prevFeatureStateRef.current = nextStateMap;
  }, [featureState, map, sourceAdded, sourceId]);

  // Add layer
  useEffect(() => {
    if (!map || !sourceAdded) return;

    const mapRef = map;

    // Remove existing layer if it exists
    if (mapRef.getLayer && mapRef.getLayer(layerId!)) {
      mapRef.removeLayer(layerId!);
    }

    try {
      const layerConfig: Record<string, unknown> = {
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

      mapRef.addLayer(layerConfig);
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
