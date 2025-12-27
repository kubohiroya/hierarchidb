/**
 * @file map.tsx
 * @description Folder map preview route with URL-synchronized position (z,x,y parameters)
 *
 * URL Format: ?zxy=10,0,0 where:
 * - First value is zoom level
 * - Second value is longitude
 * - Third value is latitude
 *
 * Features:
 * - Initialize map from URL parameters
 * - Use persisted TreeNode map.zxy when available
 * - Fallback to geolocation (zoom=1) when zxy is missing
 * - Aggregate basemap/shape/location/route/styler layers under the folder
 */

import type {
  MapLibreMapInstance,
  MapLibreStyle,
  MapViewState,
  ResourceGeoJsonLayer,
  ResourceVectorLayer,
} from '@hierarchidb/ui-plugin-shell/ui-map';
import { DEFAULT_MAP_CONFIG, ResourceLayerMap } from '@hierarchidb/ui-plugin-shell/ui-map';
import { Box } from '@mui/material';
import { useLoaderData, useNavigate, useParams, useSearch } from '@tanstack/react-router';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import useGeolocation from 'react-hook-geolocation';
import { ensureWorkerAPI } from '@hierarchidb/ui-worker-client';
import type { NodeId, TreeNode } from '@hierarchidb/common-types';
import { getDBName } from '@hierarchidb/util';
import { shapeDB } from '@hierarchidb/shape-plugin';
import { getEphemeralLocationDB } from '@hierarchidb/location-plugin';
import { TilesDB } from '@hierarchidb/gis-sdk';
import { MAPLIBRE_PROPERTY_METADATA } from '@hierarchidb/styler-plugin';
import {
  formatZxyParam,
  type MapViewState as LoaderMapViewState,
  parseZxyParam,
} from '../loaders/mapLoader.js';
import { ModelessDialogManager } from './modeless/ModelessDialogManager.js';

type MapSearch = {
  zxy?: string;
};

type BasemapStyleEntry = {
  nodeId: string;
  absolutePath?: string;
  style: string | MapLibreStyle;
};

type LayerStyleOverrides = Partial<Record<'fill' | 'line' | 'circle' | 'symbol', Record<string, unknown>>>;
type FeatureStateEntry = { id: string | number; state: Record<string, unknown> };
type FeatureStateBundle = { featureIdProperty: string; entries: FeatureStateEntry[] };

type MapStyle = {
  style: 'streets' | 'satellite' | 'terrain' | 'dark' | 'light' | 'custom';
  customStyleUrl?: string;
  customStyleConfig?: Record<string, unknown>;
};

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

const isMapLibreStyle = (value: unknown): value is MapLibreStyle => {
  if (!isRecord(value)) return false;
  return Array.isArray(value.layers) && isRecord(value.sources);
};

const BUILT_IN_STYLE_URLS: Record<Exclude<MapStyle['style'], 'custom'>, string> = {
  streets: 'https://basemaps.cartocdn.com/gl/voyager-gl-style/style.json',
  satellite: 'https://demotiles.maplibre.org/style.json',
  terrain: 'https://basemaps.cartocdn.com/gl/voyager-gl-style/style.json',
  dark: 'https://basemaps.cartocdn.com/gl/dark-matter-gl-style/style.json',
  light: 'https://basemaps.cartocdn.com/gl/positron-gl-style/style.json',
};

const resolveMapStyleSource = (mapStyle?: MapStyle | null): string | MapLibreStyle | null => {
  if (!mapStyle?.style) return null;
  if (mapStyle.style === 'custom') {
    if (mapStyle.customStyleConfig) {
      if (isMapLibreStyle(mapStyle.customStyleConfig)) return mapStyle.customStyleConfig;
      return mapStyle.customStyleUrl ?? null;
    }
    return mapStyle.customStyleUrl ?? null;
  }
  return BUILT_IN_STYLE_URLS[mapStyle.style] ?? DEFAULT_MAP_CONFIG.mapStyleUrl;
};

const buildAbsolutePath = (nodeId: string, nodeById: Map<string, TreeNode>): string => {
  const chain: TreeNode[] = [];
  const visited = new Set<string>();
  let currentId = nodeId;
  while (currentId && !visited.has(currentId)) {
    const node = nodeById.get(currentId);
    if (!node) break;
    chain.unshift(node);
    visited.add(currentId);
    const parentId = node.parentId ? String(node.parentId) : '';
    if (!parentId) break;
    currentId = parentId;
  }
  const parts = chain.map((node) => node.metadata?.name ?? String(node.id));
  return `/${parts.join('/')}`;
};

const sortByPath = <T extends { absolutePath?: string; nodeId: string }>(items: T[]): T[] =>
  [...items].sort((a, b) => {
    const aKey = a.absolutePath ?? a.nodeId;
    const bKey = b.absolutePath ?? b.nodeId;
    return aKey.localeCompare(bKey);
  });

const sortByLayerPath = <T extends { absolutePath?: string; layerId: string }>(items: T[]): T[] =>
  [...items].sort((a, b) => {
    const aKey = a.absolutePath ?? a.layerId;
    const bKey = b.absolutePath ?? b.layerId;
    return aKey.localeCompare(bKey);
  });

let routeTilesDbPromise: Promise<TilesDB> | null = null;
const getRouteTilesDb = async (): Promise<TilesDB> => {
  if (!routeTilesDbPromise) {
    routeTilesDbPromise = TilesDB.getSingleton();
  }
  return routeTilesDbPromise;
};

const withLayerOrder = (
  kind: 'shape' | 'route' | 'location',
  absolutePath: string | undefined,
  fallbackId: string,
): string => {
  const prefix = kind === 'shape' ? '1' : kind === 'route' ? '2' : '3';
  const key = absolutePath ?? fallbackId;
  return `${prefix}/${key}`;
};

export default function MapPage() {
  const navigate = useNavigate();
  const { nodeId } = useParams({ from: '/map/$nodeId' });
  const search = useSearch({ from: '/map/$nodeId' }) as MapSearch;
  const loaderViewState = useLoaderData({ from: '/map/$nodeId' }) as LoaderMapViewState;
  const geolocation = useGeolocation();
  const [initialViewState, setInitialViewState] = useState<MapViewState>(() => ({
    longitude: loaderViewState.longitude,
    latitude: loaderViewState.latitude,
    zoom: loaderViewState.zoom,
  }));
  const [basemapStyles, setBasemapStyles] = useState<BasemapStyleEntry[]>([]);
  const [vectorLayers, setVectorLayers] = useState<ResourceVectorLayer[]>([]);
  const [geoJsonLayers, setGeoJsonLayers] = useState<ResourceGeoJsonLayer[]>([]);
  const [styleOverridesByType, setStyleOverridesByType] = useState<LayerStyleOverrides>({});
  const persistedZxyApplied = useRef(false);
  const updateTimeoutRef = useRef<ReturnType<typeof setTimeout>>();
  const lastUpdateRef = useRef<string>('');

  useEffect(() => {
    setInitialViewState({
      longitude: loaderViewState.longitude,
      latitude: loaderViewState.latitude,
      zoom: loaderViewState.zoom,
    });
    lastUpdateRef.current = formatZxyParam(loaderViewState);
  }, [loaderViewState]);

  useEffect(() => {
    if (!nodeId) return;
    let cancelled = false;

    const loadFolderLayers = async () => {
      try {
        const api = await ensureWorkerAPI();
        const query = await api.getQueryAPI();
        const rootNode = (await query.getNode(nodeId as NodeId)) as TreeNode | null;
        const ancestors = (await query.listAncestors(nodeId as NodeId)) as TreeNode[];
        const descendants = (await query.listDescendants(nodeId as NodeId)) as TreeNode[];
        if (!rootNode || cancelled) return;

        const nodeById = new Map<string, TreeNode>();
        [...ancestors, rootNode, ...descendants].forEach((node) => {
          nodeById.set(String(node.id), node);
        });
        const visibleDescendants = descendants.filter((node) => node.invisible !== true);

        if (!search?.zxy && !persistedZxyApplied.current) {
          const persisted =
            rootNode.map?.zxy ??
            (isRecord(rootNode.data) ? (rootNode.data as { map?: { zxy?: string } }).map?.zxy : undefined);
          const parsed = persisted ? parseZxyParam(persisted) : null;
          if (parsed) {
            persistedZxyApplied.current = true;
            setInitialViewState(parsed);
            const formatted = formatZxyParam(parsed);
            lastUpdateRef.current = formatted;
            navigate({
              to: '/map/$nodeId',
              params: { nodeId },
              search: (prev: MapSearch = {}) => ({ ...prev, zxy: formatted }),
              replace: true,
            });
          }
        }

        const basemapEntries: BasemapStyleEntry[] = [];
        const shapeEntries: ResourceVectorLayer[] = [];
        const routeEntries: ResourceVectorLayer[] = [];
        const locationEntries: ResourceVectorLayer[] = [];
        const geoJsonEntries: ResourceGeoJsonLayer[] = [];
        const styleOverrides: LayerStyleOverrides = {};
        const featureStateByStyleType: Partial<Record<'choropleth' | 'points' | 'lines', FeatureStateBundle>> = {};

        const stylerNodes = visibleDescendants.filter((node) => node.nodeType === 'styler');
        const sortedStylers = sortByPath(
          stylerNodes.map((node) => ({
            nodeId: String(node.id),
            absolutePath: buildAbsolutePath(String(node.id), nodeById),
            node,
          }))
        );

        sortedStylers.forEach(({ node }) => {
          const data = node.data as {
            generatedStyle?: { maplibreStyleSpec?: MapLibreStyle | Record<string, unknown> };
            mapping?: {
              styleType?: 'choropleth' | 'points' | 'lines';
              featureIdProperty?: string;
              valueType?: 'number' | 'color';
              targetProperty?: keyof typeof MAPLIBRE_PROPERTY_METADATA;
            };
            styleKeyValues?: {
              colors?: Array<{ key: string; color: string }>;
              scalars?: Array<{ key: string; scalarValue: number }>;
            };
          } | null;
          const spec = isMapLibreStyle(data?.generatedStyle?.maplibreStyleSpec)
            ? data?.generatedStyle?.maplibreStyleSpec
            : undefined;
          const layers = spec?.layers ?? [];
          layers.forEach((layer) => {
            const type = layer.type as keyof LayerStyleOverrides | undefined;
            if (!type || !layer.paint) return;
            styleOverrides[type] = { ...(styleOverrides[type] ?? {}), ...(layer.paint ?? {}) };
          });

          const styleType = data?.mapping?.styleType;
          const featureIdProperty = data?.mapping?.featureIdProperty;
          if (!styleType || !featureIdProperty) return;

          const targetProperty = data?.mapping?.targetProperty;
          const targetMeta = targetProperty ? MAPLIBRE_PROPERTY_METADATA[targetProperty] : null;
          const valueType = data?.mapping?.valueType ?? targetMeta?.type ?? 'color';
          const entries: FeatureStateEntry[] = [];
          if (valueType === 'number') {
            (data?.styleKeyValues?.scalars ?? []).forEach((item) => {
              entries.push({
                id: item.key,
                state: { value: item.scalarValue },
              });
            });
          } else {
            (data?.styleKeyValues?.colors ?? []).forEach((item) => {
              entries.push({
                id: item.key,
                state: { value: item.color },
              });
            });
          }

          if (entries.length > 0) {
            featureStateByStyleType[styleType] = { featureIdProperty, entries };
          }
        });

        visibleDescendants.forEach((node) => {
          const absolutePath = buildAbsolutePath(String(node.id), nodeById);
          if (node.nodeType === 'basemap') {
            const data = node.data as { mapStyle?: MapStyle } | null;
            const styleSource = resolveMapStyleSource(data?.mapStyle ?? null);
            if (styleSource) {
              basemapEntries.push({
                nodeId: String(node.id),
                absolutePath,
                style: styleSource,
              });
            }
          }

          if (node.nodeType === 'shape') {
            const featureState = featureStateByStyleType.choropleth;
            shapeEntries.push({
              nodeId: String(node.id),
              nodeType: 'shape',
              absolutePath: withLayerOrder('shape', absolutePath, String(node.id)),
              dbName: getDBName('shape'),
              tileDataProvider: async (z, x, y, tileNodeId) => {
                if (!tileNodeId) return null;
                const record = await shapeDB.getVectorTile(tileNodeId as NodeId, z, x, y);
                return record?.data_Uint8Array?.buffer ?? null;
              },
              layerConfig: {
                layerType: 'fill',
                sourceLayer: 'default',
              },
              promoteId: featureState?.featureIdProperty,
              featureState: featureState?.entries,
            });
          }

          if (node.nodeType === 'location') {
            const data = node.data as { batchSessionId?: string; features?: Array<{ position?: { lat?: number; lon?: number } }> } | null;
            const sessionId = data?.batchSessionId;
            if (sessionId) {
              const featureState = featureStateByStyleType.points;
              locationEntries.push({
                nodeId: String(node.id),
                nodeType: 'location',
                absolutePath: withLayerOrder('location', absolutePath, String(node.id)),
                dbName: getDBName('location-ephemeral'),
                tileDataProvider: async (z, x, y) => {
                  const db = getEphemeralLocationDB();
                  const rec = await db.vectorTiles.get(`loc-mvt-${sessionId}-${z}-${x}-${y}`);
                  return rec?.data ?? null;
                },
                layerConfig: {
                  layerType: 'circle',
                  sourceLayer: 'location_points',
                  paint: {
                    'circle-radius': 4,
                    'circle-color': '#2f74ff',
                    'circle-opacity': 0.8,
                    ...(styleOverrides.circle ?? {}),
                  },
                },
                promoteId: featureState?.featureIdProperty,
                featureState: featureState?.entries,
              });
            }
          }

          if (node.nodeType === 'route') {
            const data = node.data as { batchSessionId?: string } | null;
            const sessionId = data?.batchSessionId;
            if (sessionId) {
              const featureState = featureStateByStyleType.lines;
              routeEntries.push({
                nodeId: String(node.id),
                nodeType: 'route',
                absolutePath: withLayerOrder('route', absolutePath, String(node.id)),
                dbName: getDBName('stage-tiles-db'),
                tileDataProvider: async (z, x, y) => {
                  const db = await getRouteTilesDb();
                  const record = await db.tiles
                    .where('[sessionId+z+x+y]')
                    .equals([sessionId, z, x, y])
                    .first();
                  return record?.data ?? null;
                },
                layerConfig: {
                  layerType: 'line',
                  sourceLayer: 'layer0',
                  paint: {
                    'line-color': '#f24c3d',
                    'line-width': 2,
                    'line-opacity': 0.9,
                    ...(styleOverrides.line ?? {}),
                  },
                },
                promoteId: featureState?.featureIdProperty,
                featureState: featureState?.entries,
              });
            }
          }
        });

        if (!cancelled) {
          setBasemapStyles(sortByPath(basemapEntries));
          setVectorLayers([
            ...sortByPath(shapeEntries),
            ...sortByPath(routeEntries),
            ...sortByPath(locationEntries),
          ]);
          setGeoJsonLayers(sortByLayerPath(geoJsonEntries));
          setStyleOverridesByType(styleOverrides);
        }
      } catch (error) {
        if (cancelled) return;
        console.warn('[MapPage] Failed to load folder layers', error);
        setBasemapStyles([]);
        setVectorLayers([]);
        setGeoJsonLayers([]);
        setStyleOverridesByType({});
      }
    };

    void loadFolderLayers();
    return () => {
      cancelled = true;
    };
  }, [navigate, nodeId, search?.zxy]);

  useEffect(() => {
    if (!search?.zxy && !persistedZxyApplied.current && geolocation.latitude && geolocation.longitude && !geolocation.error) {
      setInitialViewState({
        longitude: geolocation.longitude,
        latitude: geolocation.latitude,
        zoom: 1,
      });
    }
  }, [geolocation.latitude, geolocation.longitude, geolocation.error, search?.zxy]);

  const handleMapLoad = useCallback((map: MapLibreMapInstance) => {
    console.log('[MapPage] Map loaded', map);
  }, []);

  const handleViewStateChange = useCallback(
    (viewState: MapViewState) => {
      if (!nodeId) return;
      if (updateTimeoutRef.current) {
        clearTimeout(updateTimeoutRef.current);
      }
      updateTimeoutRef.current = setTimeout(() => {
        const newZxy = formatZxyParam(viewState);
        if (newZxy !== lastUpdateRef.current) {
          lastUpdateRef.current = newZxy;
          navigate({
            to: '/map/$nodeId',
            params: { nodeId },
            search: (prev: MapSearch = {}) => ({ ...prev, zxy: newZxy }),
            replace: true,
          });
        }
      }, 500);
    },
    [navigate, nodeId]
  );

  useEffect(() => {
    return () => {
      if (updateTimeoutRef.current) {
        clearTimeout(updateTimeoutRef.current);
      }
    };
  }, []);

  const mapStyleUrl = useMemo(() => {
    if (basemapStyles.length) return undefined;
    return DEFAULT_MAP_CONFIG.mapStyleUrl;
  }, [basemapStyles.length]);

  const formattedZxy = formatZxyParam(initialViewState);

  return (
    <Box sx={{ width: '100vw', height: '100vh', position: 'relative', overscrollBehavior: 'contain' }}>
      {nodeId ? (
        <ModelessDialogManager
          nodeId={nodeId}
          formattedZxy={formattedZxy}
          basemapStyles={basemapStyles}
          vectorLayers={vectorLayers}
          geoJsonLayers={geoJsonLayers}
        />
      ) : null}

      <ResourceLayerMap
        initialViewState={initialViewState}
        width="100%"
        height="100%"
        mapStyleUrl={mapStyleUrl}
        basemapStyles={basemapStyles}
        vectorLayers={vectorLayers}
        geoJsonLayers={geoJsonLayers}
        styleOverridesByType={styleOverridesByType}
        onLoad={handleMapLoad}
        onViewStateChange={handleViewStateChange}
        mapOptions={{
          interactive: true,
          scrollZoom: true,
          dragPan: true,
          dragRotate: true,
          doubleClickZoom: true,
          touchZoomRotate: true,
        }}
      />
    </Box>
  );
}
