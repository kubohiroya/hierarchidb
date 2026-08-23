import type {
  GetResourceResponse,
  RequestParameters,
  SourceSpecification,
  VectorSourceSpecification,
} from 'maplibre-gl';
import { useEffect, useRef, useState } from 'react';
import type { MapLibreMapInstance } from '~/types/maplibre-public';
import type {
  FeatureStateRecord,
  VectorTileProps,
  VectorTileRequestError,
} from '~/types/unified-map-props';
import { loadMapLibreModule } from '~/utils/maplibre-loader';
import { normalizePaintLiteralArrays } from '~/utils/maplibre-style-utils';

type MapLibreLayerUpdater = MapLibreMapInstance & {
  setFilter?: (layerId: string, filter?: unknown) => void;
  setLayerZoomRange?: (layerId: string, minzoom: number, maxzoom: number) => void;
};

let protocolRegistered = false;

type TileProviderEntry = {
  provider: NonNullable<VectorTileProps['tileDataProvider']>;
  onTileRequest?: VectorTileProps['onTileRequest'];
  onTileError?: VectorTileProps['onTileError'];
  sourceId?: string;
};

type TileProviderRegistryEntry = {
  entries: Map<symbol, TileProviderEntry>;
  currentToken?: symbol;
};

const tileProviderRegistry = new Map<string, TileProviderRegistryEntry>();

const buildTileProviderKey = (dbName: string, nodeId: string): string => `${dbName}/${nodeId}`;

const getCurrentProviderEntry = (dbName: string, nodeId: string): TileProviderEntry | undefined => {
  const registryEntry = tileProviderRegistry.get(buildTileProviderKey(dbName, nodeId));
  if (!registryEntry?.currentToken) return undefined;
  return registryEntry.entries.get(registryEntry.currentToken);
};

const registerTileProvider = (
  dbName: string,
  nodeId: string,
  token: symbol,
  entry: TileProviderEntry
): void => {
  const key = buildTileProviderKey(dbName, nodeId);
  const registryEntry: TileProviderRegistryEntry = tileProviderRegistry.get(key) ?? {
    entries: new Map<symbol, TileProviderEntry>(),
  };
  registryEntry.entries.set(token, entry);
  registryEntry.currentToken = token;
  tileProviderRegistry.set(key, registryEntry);
};

const unregisterTileProvider = (dbName: string, nodeId: string, token: symbol): void => {
  const key = buildTileProviderKey(dbName, nodeId);
  const registryEntry = tileProviderRegistry.get(key);
  if (!registryEntry) return;
  registryEntry.entries.delete(token);
  if (registryEntry.currentToken === token) {
    registryEntry.currentToken = Array.from(registryEntry.entries.keys()).at(-1);
  }
  if (registryEntry.entries.size === 0) {
    tileProviderRegistry.delete(key);
  }
};

const notifyTileError = (
  entry: TileProviderEntry | undefined,
  error: VectorTileRequestError
): void => {
  entry?.onTileError?.(error);
};

export interface UseVectorTileLayerArgs extends VectorTileProps {
  map: MapLibreMapInstance;
}

export function useVectorTileLayer({
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
}: UseVectorTileLayerArgs): void {
  const [sourceAdded, setSourceAdded] = useState(false);
  const [layerAdded, setLayerAdded] = useState(false);
  const [computedTiles, setComputedTiles] = useState<string[] | undefined>(tiles);
  const tilesLoadedRef = useRef(false);
  const prevFeatureStateRef = useRef<Map<string | number, FeatureStateRecord>>(new Map());
  const onTileRequestRef = useRef<UseVectorTileLayerArgs['onTileRequest']>(onTileRequest);
  const onTileErrorRef = useRef<UseVectorTileLayerArgs['onTileError']>(onTileError);
  const paintRef = useRef<Record<string, unknown>>(normalizePaintLiteralArrays(paint ?? {}));
  const layoutRef = useRef<Record<string, unknown>>({
    visibility: visible ? 'visible' : 'none',
    ...(layout ?? {}),
  });
  const filterRef = useRef<unknown>(filter ?? null);
  const sourceConfigRef = useRef<{
    sourceId?: string;
    tilesKey?: string;
    promoteId?: unknown;
  } | null>(null);
  const layerConfigRef = useRef<{
    layerId?: string;
    sourceId?: string;
    layerType?: string;
    sourceLayer?: string;
  } | null>(null);

  useEffect(() => {
    onTileRequestRef.current = onTileRequest;
  }, [onTileRequest]);

  useEffect(() => {
    onTileErrorRef.current = onTileError;
  }, [onTileError]);

  useEffect(() => {
    const nextPaint = normalizePaintLiteralArrays(paint ?? {});
    const prevPaint = paintRef.current;
    paintRef.current = nextPaint;

    if (!map || !layerAdded || !layerId || !map.getLayer || !map.getLayer(layerId)) return;

    const allKeys = new Set([...Object.keys(prevPaint), ...Object.keys(nextPaint)]);
    allKeys.forEach((key) => {
      const prev = prevPaint[key];
      const next = nextPaint[key];
      if (JSON.stringify(prev) === JSON.stringify(next)) return;
      try {
        map.setPaintProperty(layerId, key, next as never);
      } catch (error) {
        console.debug('VectorTileLayer paint update skipped:', error);
      }
    });
  }, [layerAdded, layerId, map, paint]);

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
              _abortController: AbortController
            ): Promise<GetResourceResponse<ArrayBuffer>> => {
              const urlParts = params.url.replace('dexie://', '').split('/').filter(Boolean);
              const [dbNameFromUrl, nodeIdFromUrl, z, x, y] = urlParts;

              if (!dbNameFromUrl || !nodeIdFromUrl || !z || !x || !y) {
                throw new Error(`Invalid dexie URL format: ${params.url}`);
              }

              const zInt = parseInt(z, 10);
              const xInt = parseInt(x, 10);
              const yInt = parseInt(y, 10);
              const entry = getCurrentProviderEntry(dbNameFromUrl, nodeIdFromUrl);

              if (!entry) {
                const error = new Error(
                  `No vector tile provider registered for ${dbNameFromUrl}/${nodeIdFromUrl}`
                );
                notifyTileError(entry, {
                  dbName: dbNameFromUrl,
                  nodeId: nodeIdFromUrl,
                  url: params.url,
                  kind: 'provider-missing',
                  error,
                });
                throw error;
              }

              try {
                const tileData = await entry.provider(zInt, xInt, yInt, nodeIdFromUrl);
                entry.onTileRequest?.({
                  bytes: tileData?.byteLength ?? 0,
                  dbName: dbNameFromUrl,
                  nodeId: nodeIdFromUrl,
                  sourceId: entry.sourceId,
                  url: params.url,
                });

                if (tileData) {
                  return {
                    data: tileData,
                    cacheControl: null,
                    expires: null,
                  };
                }
                const error = new Error(
                  `Vector tile is missing for ${dbNameFromUrl}/${nodeIdFromUrl}/${z}/${x}/${y}`
                );
                throw error;
              } catch (caught) {
                const error = caught instanceof Error ? caught : new Error(String(caught));
                const missingTile = error.message.startsWith('Vector tile is missing');
                if (!missingTile) {
                  entry.onTileRequest?.({
                    bytes: 0,
                    dbName: dbNameFromUrl,
                    nodeId: nodeIdFromUrl,
                    sourceId: entry.sourceId,
                    url: params.url,
                  });
                }
                notifyTileError(entry, {
                  dbName: dbNameFromUrl,
                  nodeId: nodeIdFromUrl,
                  sourceId: entry.sourceId,
                  url: params.url,
                  kind: missingTile ? 'tile-missing' : 'provider-error',
                  error,
                });
                throw error;
              }
            }
          );
          protocolRegistered = true;
        } catch {
          protocolRegistered = true;
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
  }, [dbName, nodeId, sourceId, tileDataProvider]);

  useEffect(() => {
    if (!dbName || !nodeId || !tileDataProvider) return;
    const token = Symbol(`${dbName}/${nodeId}/${sourceId ?? ''}`);
    registerTileProvider(dbName, nodeId, token, {
      provider: tileDataProvider,
      onTileRequest: onTileRequestRef.current,
      onTileError: onTileErrorRef.current,
      sourceId,
    });
    return () => {
      unregisterTileProvider(dbName, nodeId, token);
    };
  }, [dbName, nodeId, sourceId, tileDataProvider, onTileRequest, onTileError]);

  useEffect(() => {
    if (!map || !computedTiles || !sourceId) return;

    const mapRef = map;
    const tilesKey = computedTiles.join('|');
    const prevConfig = sourceConfigRef.current;
    const needsReplace =
      !prevConfig ||
      prevConfig.sourceId !== sourceId ||
      prevConfig.tilesKey !== tilesKey ||
      prevConfig.promoteId !== promoteId;

    if (!needsReplace && mapRef.getSource(sourceId)) {
      setSourceAdded(true);
      return;
    }

    if (mapRef.getSource(sourceId)) {
      if (layerId && mapRef.getLayer(layerId)) {
        mapRef.removeLayer(layerId);
      }
      mapRef.removeSource(sourceId);
    }

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
      mapRef.addSource(sourceId, vectorTileSource as SourceSpecification);
      setSourceAdded(true);
      sourceConfigRef.current = { sourceId, tilesKey, promoteId };
    } catch (error) {
      if (error instanceof Error && error.message.includes('already exists')) {
        setSourceAdded(true);
        sourceConfigRef.current = { sourceId, tilesKey, promoteId };
      } else {
        console.error('Failed to add vector tile source:', error);
      }
    }

    return () => {
      try {
        if (mapRef && typeof mapRef.getStyle === 'function') {
          const style = mapRef.getStyle();
          if (!style || !style.layers) {
            return;
          }
          if (layerId) {
            if (mapRef.getLayer(layerId)) {
              mapRef.removeLayer(layerId);
            }
          }
          if (mapRef.getSource(sourceId)) {
            mapRef.removeSource(sourceId);
          }
        }
      } catch (error) {
        console.debug('VectorTileLayer cleanup skipped due to map atoms:', error);
      }
    };
  }, [map, computedTiles, sourceId, promoteId, layerId, minzoom, maxzoom]);

  useEffect(() => {
    if (!map || !sourceAdded || !layerAdded || !featureState) return;
    const mapRef = map;
    if (!mapRef.isStyleLoaded || !mapRef.isStyleLoaded()) return;
    if (!sourceId || !mapRef.getSource || !mapRef.getSource(sourceId)) return;
    if (layerId && mapRef.getLayer && !mapRef.getLayer(layerId)) return;

    type FeatureStateTarget = {
      source: string;
      id: string | number;
      sourceLayer?: string;
      key?: string;
    };
    const buildFeatureStateTarget = (id: string | number, key?: string): FeatureStateTarget =>
      sourceLayer
        ? { source: sourceId, sourceLayer, id, ...(key ? { key } : {}) }
        : { source: sourceId, id, ...(key ? { key } : {}) };

    const removeStateKeys = (id: string | number, state: FeatureStateRecord) => {
      Object.keys(state).forEach((key) => {
        try {
          mapRef.removeFeatureState(buildFeatureStateTarget(id, key));
        } catch (error) {
          console.debug('VectorTileLayer feature-atoms cleanup skipped:', error);
        }
      });
    };

    if (featureState.length === 0) {
      prevFeatureStateRef.current.forEach((state, id) => {
        removeStateKeys(id, state);
      });
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
              mapRef.removeFeatureState(buildFeatureStateTarget(entry.id, key));
            } catch (error) {
              console.debug('VectorTileLayer feature-atoms cleanup skipped:', error);
            }
          }
        });
      }
      try {
        const target = buildFeatureStateTarget(entry.id);
        mapRef.setFeatureState(target, entry.state);
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
  }, [featureState, map, sourceAdded, layerAdded, sourceId, sourceLayer, layerId]);

  useEffect(() => {
    if (!map || !sourceAdded || !layerId) return;

    const mapRef = map;
    const prevLayerConfig = layerConfigRef.current;
    const layerConfigKey = { layerId, sourceId, layerType, sourceLayer };
    const needsReplace =
      !prevLayerConfig ||
      prevLayerConfig.layerId !== layerConfigKey.layerId ||
      prevLayerConfig.sourceId !== layerConfigKey.sourceId ||
      prevLayerConfig.layerType !== layerConfigKey.layerType ||
      prevLayerConfig.sourceLayer !== layerConfigKey.sourceLayer;

    if (!needsReplace && mapRef.getLayer(layerId)) {
      setLayerAdded(true);
      return;
    }

    if (mapRef.getLayer(layerId)) {
      mapRef.removeLayer(layerId);
    }

    try {
      const layerConfig: Record<string, unknown> = {
        id: layerId,
        type: layerType,
        source: sourceId,
        paint: paintRef.current,
        layout: layoutRef.current,
        minzoom,
        maxzoom,
      };

      if (sourceLayer) {
        layerConfig['source-layer'] = sourceLayer;
      }

      mapRef.addLayer(layerConfig);
      setLayerAdded(true);
      layerConfigRef.current = layerConfigKey;
    } catch (error) {
      if (layerId && mapRef.getLayer && mapRef.getLayer(layerId)) {
        setLayerAdded(true);
        layerConfigRef.current = layerConfigKey;
      }
      if (!(error instanceof Error && error.message.includes('already exists'))) {
        console.error('Failed to add layer:', error);
      }
    }

    return () => {
      try {
        setLayerAdded(false);
        if (layerId && mapRef && typeof mapRef.getStyle === 'function') {
          const style = mapRef.getStyle();
          if (style.layers && mapRef.getLayer && mapRef.getLayer(layerId)) {
            mapRef.removeLayer(layerId);
          }
        }
      } catch (error) {
        console.debug('VectorTileLayer layer cleanup skipped due to map atoms:', error);
      }
    };
  }, [map, sourceAdded, layerId, layerType, sourceId, sourceLayer, minzoom, maxzoom]);

  useEffect(() => {
    if (!layerId || !map || !map.getLayer || !map.getLayer(layerId)) return;
    const nextLayout: Record<string, unknown> = {
      visibility: visible ? 'visible' : 'none',
      ...layout,
    };
    const prevLayout: Record<string, unknown> = layoutRef.current;
    layoutRef.current = nextLayout;
    const keys = new Set([...Object.keys(prevLayout), ...Object.keys(nextLayout)]);
    keys.forEach((key) => {
      const prev = prevLayout[key];
      const next = nextLayout[key];
      if (JSON.stringify(prev) === JSON.stringify(next)) return;
      try {
        map.setLayoutProperty(layerId, key, next as never);
      } catch (error) {
        console.debug('VectorTileLayer layout update skipped:', error);
      }
    });
  }, [map, layerId, layout, visible]);

  useEffect(() => {
    if (!layerId || !map || !map.getLayer || !map.getLayer(layerId)) return;
    const mapRef = map as MapLibreLayerUpdater;
    if (typeof mapRef.setFilter !== 'function') return;
    const prevFilter = filterRef.current;
    filterRef.current = filter ?? null;
    if (JSON.stringify(prevFilter) === JSON.stringify(filter ?? null)) return;
    try {
      if (filter && Array.isArray(filter)) {
        mapRef.setFilter(layerId, filter);
      } else {
        mapRef.setFilter(layerId, undefined);
      }
    } catch (error) {
      console.debug('VectorTileLayer filter update skipped:', error);
    }
  }, [map, layerId, filter]);

  useEffect(() => {
    if (!layerId || !map || !map.getLayer || !map.getLayer(layerId)) return;
    const mapRef = map as MapLibreLayerUpdater;
    if (typeof mapRef.setLayerZoomRange !== 'function') return;
    if (typeof minzoom !== 'number' || typeof maxzoom !== 'number') return;
    try {
      mapRef.setLayerZoomRange(layerId, minzoom, maxzoom);
    } catch (error) {
      console.debug('VectorTileLayer zoom range update skipped:', error);
    }
  }, [map, layerId, minzoom, maxzoom]);
}
