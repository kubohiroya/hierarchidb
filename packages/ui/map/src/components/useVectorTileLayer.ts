import type {
  GetResourceResponse,
  RequestParameters,
  SourceSpecification,
  VectorSourceSpecification,
} from 'maplibre-gl';
import { useEffect, useRef, useState } from 'react';
import type { MapLibreMapInstance } from '~/types/maplibre-public';
import type { FeatureStateRecord, VectorTileProps } from '~/types/unified-map-props';
import { loadMapLibreModule } from '~/utils/maplibre-loader';
import { normalizePaintLiteralArrays } from '~/utils/maplibre-style-utils';

type MapLibreLayerUpdater = MapLibreMapInstance & {
  setFilter?: (layerId: string, filter?: unknown) => void;
  setLayerZoomRange?: (layerId: string, minzoom: number, maxzoom: number) => void;
};

let protocolRegistered = false;
type TileProviderRegistryEntry = {
  tileDataProvider: NonNullable<VectorTileProps['tileDataProvider']>;
  activeOwnerId: string;
  owners: Map<string, TileProviderRegistryOwner>;
};
type TileProviderRegistryOwner = {
  onTileRequest?: VectorTileProps['onTileRequest'];
  onTileError?: VectorTileProps['onTileError'];
  sourceId?: string;
};
const tileProviderRegistry = new Map<string, TileProviderRegistryEntry>();
let tileProviderOwnerSequence = 0;

const toProviderRegistryKey = (dbName: string, nodeId: string): string => `${dbName}/${nodeId}`;

const toError = (value: unknown): Error =>
  value instanceof Error ? value : new Error(String(value));

const notifyTileRequest = (
  owner: TileProviderRegistryOwner | undefined,
  stats: Parameters<NonNullable<VectorTileProps['onTileRequest']>>[0]
): void => {
  try {
    owner?.onTileRequest?.(stats);
  } catch (error) {
    console.warn('VectorTileLayer tile request observer failed:', error);
  }
};

const notifyTileError = (
  owner: TileProviderRegistryOwner | undefined,
  error: Parameters<NonNullable<VectorTileProps['onTileError']>>[0]
): void => {
  try {
    owner?.onTileError?.(error);
  } catch (observerError) {
    console.warn('VectorTileLayer tile error observer failed:', observerError);
  }
};

const registerTileProviderOwner = (
  registryKey: string,
  ownerId: string,
  tileDataProvider: NonNullable<VectorTileProps['tileDataProvider']>,
  owner: TileProviderRegistryOwner
): void => {
  const entry = tileProviderRegistry.get(registryKey);
  if (!entry) {
    tileProviderRegistry.set(registryKey, {
      tileDataProvider,
      activeOwnerId: ownerId,
      owners: new Map([[ownerId, owner]]),
    });
    return;
  }
  entry.tileDataProvider = tileDataProvider;
  entry.activeOwnerId = ownerId;
  entry.owners.set(ownerId, owner);
};

const unregisterTileProviderOwner = (registryKey: string, ownerId: string): void => {
  const entry = tileProviderRegistry.get(registryKey);
  if (!entry) return;
  entry.owners.delete(ownerId);
  if (entry.owners.size === 0) {
    tileProviderRegistry.delete(registryKey);
    return;
  }
  if (entry.activeOwnerId !== ownerId) return;
  const nextOwnerId = entry.owners.keys().next().value;
  if (typeof nextOwnerId === 'string') {
    entry.activeOwnerId = nextOwnerId;
  }
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
  const tileProviderOwnerIdRef = useRef(`vector-tile-layer-${++tileProviderOwnerSequence}`);
  const paintRef = useRef<Record<string, unknown>>(normalizePaintLiteralArrays(paint ?? {}));
  const layoutRef = useRef<Record<string, unknown>>({});
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
    if (!dbName || !nodeId) return;
    const entry = tileProviderRegistry.get(toProviderRegistryKey(dbName, nodeId));
    if (!entry) return;
    const owner = entry.owners.get(tileProviderOwnerIdRef.current);
    if (!owner) return;
    owner.onTileRequest = onTileRequest;
    owner.onTileError = onTileError;
    owner.sourceId = sourceId;
  }, [dbName, nodeId, onTileError, onTileRequest, sourceId]);

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

      const registryKey = toProviderRegistryKey(dbName, nodeId);
      const ownerId = tileProviderOwnerIdRef.current;
      registerTileProviderOwner(registryKey, ownerId, tileDataProvider, {
        onTileRequest: onTileRequestRef.current,
        onTileError: onTileErrorRef.current,
        sourceId,
      });

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
              const providerEntry = tileProviderRegistry.get(
                toProviderRegistryKey(dbNameFromUrl, nodeIdFromUrl)
              );

              if (!providerEntry) {
                throw new Error(
                  `No vector tile provider registered for ${dbNameFromUrl}/${nodeIdFromUrl}`
                );
              }

              const activeOwner = providerEntry.owners.get(providerEntry.activeOwnerId);
              try {
                const tileData = await providerEntry.tileDataProvider(
                  zInt,
                  xInt,
                  yInt,
                  nodeIdFromUrl
                );
                notifyTileRequest(activeOwner, {
                  bytes: tileData?.byteLength ?? 0,
                  dbName: dbNameFromUrl,
                  nodeId: nodeIdFromUrl,
                  sourceId: activeOwner?.sourceId,
                  url: params.url,
                });

                if (tileData) {
                  return {
                    data: tileData,
                    cacheControl: null,
                    expires: null,
                  };
                }
                return {
                  data: new ArrayBuffer(0),
                  cacheControl: null,
                  expires: null,
                };
              } catch (error) {
                const normalizedError = toError(error);
                notifyTileRequest(activeOwner, {
                  bytes: 0,
                  dbName: dbNameFromUrl,
                  nodeId: nodeIdFromUrl,
                  sourceId: activeOwner?.sourceId,
                  url: params.url,
                });
                notifyTileError(activeOwner, {
                  error: normalizedError,
                  dbName: dbNameFromUrl,
                  nodeId: nodeIdFromUrl,
                  sourceId: activeOwner?.sourceId,
                  url: params.url,
                });
                throw normalizedError;
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
      if (dbName && nodeId) {
        unregisterTileProviderOwner(
          toProviderRegistryKey(dbName, nodeId),
          tileProviderOwnerIdRef.current
        );
      }
    };
  }, [dbName, nodeId, sourceId, tileDataProvider]);

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
        layout: {
          visibility: visible ? 'visible' : 'none',
          ...layout,
        },
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
  }, [
    map,
    sourceAdded,
    layerId,
    layerType,
    sourceId,
    sourceLayer,
    minzoom,
    maxzoom,
    layout,
    visible,
  ]);

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
