import { useEffect, useState } from 'react';
import type {
  FeatureStateEntry,
  FeatureStateRecord,
  MapLibreStyle,
  ResourceGeoJsonLayer,
  ResourceVectorLayer,
} from '@hierarchidb/ui-plugin-shell/ui-map';
import { getDBName } from '@hierarchidb/util';
import type { NodeId, TreeNode } from '@hierarchidb/common-types';
import type { ShapeQueryAPI } from '@hierarchidb/shape-store';
import type { RouteQueryAPI } from '@hierarchidb/route-store';
import { MAPLIBRE_PROPERTY_METADATA } from '@hierarchidb/styler-store';
import { ensureWorkerAPI } from '@hierarchidb/ui-worker-client';
import type { MapInfoSummary } from '../modeless/modelessDialogContent.js';
import { parseZxyParam } from '../../loaders/mapLoader.js';
import type {
  BasemapStyleEntry,
  FeatureStateBundle,
  LayerStyleOverrides,
  MapStyle,
  MapStylerSummary,
  PersistedZxyHandler,
} from './types.js';
import { resolveMapStyleSource, sortByLayerPath, sortByPath } from './styleUtils.js';

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

const isMapLibreStyle = (value: unknown): value is MapLibreStyle => {
  if (!isRecord(value)) return false;
  return Array.isArray(value.layers) && isRecord(value.sources);
};

const isFolderNodeType = (nodeType?: string | null): boolean => {
  if (!nodeType) return false;
  const normalized = String(nodeType).trim();
  return normalized === 'folder' || /folder$/i.test(normalized);
};

const isNodeVisible = (node?: TreeNode | null): boolean => {
  if (!node) return true;
  if (typeof node.visible === 'boolean') return node.visible;
  return true;
};

const isInvisibleFolder = (node?: TreeNode | null): boolean =>
  !isNodeVisible(node) && isFolderNodeType(node?.nodeType);

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

const withLayerOrder = (
  kind: 'shape' | 'route' | 'location',
  absolutePath: string | undefined,
  fallbackId: string,
): string => {
  const prefix = kind === 'shape' ? '1' : kind === 'route' ? '2' : '3';
  const key = absolutePath ?? fallbackId;
  return `${prefix}/${key}`;
};

let shapeQueryPromise: Promise<ShapeQueryAPI> | null = null;
const getShapeQueryAPI = async (): Promise<ShapeQueryAPI> => {
  if (!shapeQueryPromise) {
    shapeQueryPromise = ensureWorkerAPI().then((api) => api.getShapeQueryAPI());
  }
  return shapeQueryPromise;
};


let routeQueryPromise: Promise<RouteQueryAPI> | null = null;
const getRouteQueryAPI = async (): Promise<RouteQueryAPI> => {
  if (!routeQueryPromise) {
    routeQueryPromise = ensureWorkerAPI().then((api) => api.getRouteQueryAPI());
  }
  return routeQueryPromise;
};

export type UseFolderLayersResult = {
  basemapStyles: BasemapStyleEntry[];
  vectorLayers: ResourceVectorLayer[];
  geoJsonLayers: ResourceGeoJsonLayer[];
  locationLayers: LocationLayerEntry[];
  styleOverridesByType: LayerStyleOverrides;
  mapInfo: MapInfoSummary;
  stylerSummaries: MapStylerSummary[];
};

export type LocationLayerEntry = {
  nodeId: string;
  nodeType: 'location';
  dataSourceName?: string;
  absolutePath?: string;
  layerId: string;
  sourceId: string;
};

export type UseFolderLayersParams = {
  nodeId?: string;
  searchZxy?: string;
  onPersistedZxy: PersistedZxyHandler;
  stylerToggles?: Record<string, boolean>;
};

export const useFolderLayers = ({
  nodeId,
  searchZxy,
  onPersistedZxy,
  stylerToggles,
}: UseFolderLayersParams): UseFolderLayersResult => {
  const [basemapStyles, setBasemapStyles] = useState<BasemapStyleEntry[]>([]);
  const [vectorLayers, setVectorLayers] = useState<ResourceVectorLayer[]>([]);
  const [geoJsonLayers, setGeoJsonLayers] = useState<ResourceGeoJsonLayer[]>([]);
  const [locationLayers, setLocationLayers] = useState<LocationLayerEntry[]>([]);
  const [styleOverridesByType, setStyleOverridesByType] = useState<LayerStyleOverrides>({});
  const [stylerSummaries, setStylerSummaries] = useState<MapStylerSummary[]>([]);
  const [mapInfo, setMapInfo] = useState<MapInfoSummary>({});

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
        const invisibleFolderIds = new Set<string>(
          [rootNode, ...descendants]
            .filter((node) => isInvisibleFolder(node))
            .map((node) => String(node.id))
        );
        const visibleDescendants = isInvisibleFolder(rootNode)
          ? []
          : descendants.filter((node) => {
              if (!isNodeVisible(node) || isInvisibleFolder(node)) return false;
              let cursor = node.parentId ? String(node.parentId) : '';
              while (cursor) {
                if (invisibleFolderIds.has(cursor)) return false;
                const parent = nodeById.get(cursor);
                if (!parent) break;
                cursor = parent.parentId ? String(parent.parentId) : '';
              }
              return true;
            });
        const nodesForLayers = isFolderNodeType(rootNode.nodeType)
          ? visibleDescendants
          : isNodeVisible(rootNode)
            ? [rootNode, ...visibleDescendants]
            : visibleDescendants;

        setMapInfo({
          name: rootNode.metadata?.name ?? '',
          description: rootNode.metadata?.description ?? '',
          tags: rootNode.metadata?.tags ?? [],
          createdAt: rootNode.createdAt,
          updatedAt: rootNode.updatedAt,
          path: buildAbsolutePath(String(rootNode.id), nodeById),
        });

        if (!searchZxy) {
          const persisted =
            rootNode.map?.zxy ??
            (isRecord(rootNode.data) ? (rootNode.data as { map?: { zxy?: string } }).map?.zxy : undefined);
          const parsed = persisted ? parseZxyParam(persisted) : null;
          if (parsed) {
            onPersistedZxy(parsed);
          }
        }

        const basemapEntries: BasemapStyleEntry[] = [];
        const shapeEntries: ResourceVectorLayer[] = [];
        const routeEntries: ResourceVectorLayer[] = [];
        const geoJsonEntries: ResourceGeoJsonLayer[] = [];
        const locationEntries: LocationLayerEntry[] = [];
        const styleOverrides: LayerStyleOverrides = {};
        const featureStateByStyleType: Partial<Record<'choropleth' | 'points' | 'lines', FeatureStateBundle>> = {};
        const stylerSummaries: MapStylerSummary[] = [];

        const stylerNodes = nodesForLayers.filter((node) => node.nodeType === 'styler');
        const sortedStylers = sortByPath(
          stylerNodes.map((node) => ({
            nodeId: String(node.id),
            absolutePath: buildAbsolutePath(String(node.id), nodeById),
            node,
          }))
        );

        sortedStylers.forEach(({ nodeId: stylerNodeId, absolutePath, node }) => {
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
          const enabled = stylerToggles?.[stylerNodeId] ?? true;
          const spec = isMapLibreStyle(data?.generatedStyle?.maplibreStyleSpec)
            ? data?.generatedStyle?.maplibreStyleSpec
            : undefined;
          const layers = spec?.layers ?? [];
          const paintOverrides: LayerStyleOverrides = {};
          layers.forEach((layer) => {
            const type = layer.type as keyof LayerStyleOverrides | undefined;
            if (!type || !layer.paint) return;
            paintOverrides[type] = { ...(paintOverrides[type] ?? {}), ...(layer.paint ?? {}) };
            if (enabled) {
              styleOverrides[type] = { ...(styleOverrides[type] ?? {}), ...(layer.paint ?? {}) };
            }
          });

          const styleType = data?.mapping?.styleType;
          const featureIdProperty = data?.mapping?.featureIdProperty;
          const targetProperty = data?.mapping?.targetProperty;
          const targetMeta = targetProperty ? MAPLIBRE_PROPERTY_METADATA[targetProperty] : null;
          const valueType = data?.mapping?.valueType ?? targetMeta?.type ?? 'color';
          const entries: FeatureStateEntry[] = [];
          if (valueType === 'number') {
            (data?.styleKeyValues?.scalars ?? []).forEach((item) => {
              entries.push({
                id: item.key,
                state: { value: item.scalarValue } as FeatureStateRecord,
              });
            });
          } else {
            (data?.styleKeyValues?.colors ?? []).forEach((item) => {
              entries.push({
                id: item.key,
                state: { value: item.color } as FeatureStateRecord,
              });
            });
          }

          stylerSummaries.push({
            nodeId: stylerNodeId,
            absolutePath,
            description: node.metadata?.description ? String(node.metadata.description) : undefined,
            styleType,
            featureIdProperty,
            targetProperty: targetProperty ? String(targetProperty) : undefined,
            valueType,
            colorStops: data?.styleKeyValues?.colors ?? [],
            scalarStops: data?.styleKeyValues?.scalars ?? [],
            paintOverrides,
            enabled,
          });

          if (!enabled || !styleType || !featureIdProperty) return;
          if (entries.length > 0) {
            featureStateByStyleType[styleType] = { featureIdProperty, entries };
          }
        });

        nodesForLayers.forEach((node) => {
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
            const data = node.data as { batchConfig?: { dataSource?: string } } | null;
            const dataSourceName = data?.batchConfig?.dataSource;
            const featureState = featureStateByStyleType.choropleth;
            const layerId = `resource-layer-${node.id}`;
            const sourceId = `resource-source-${node.id}`;
            shapeEntries.push({
              nodeId: String(node.id),
              nodeType: 'shape',
              dataSourceName,
              absolutePath: withLayerOrder('shape', absolutePath, String(node.id)),
              dbName: getDBName('shape'),
              tileDataProvider: async (z, x, y, tileNodeId) => {
                if (!tileNodeId) return null;
                const api = await getShapeQueryAPI();
                const tile = await api.getVectorTile(tileNodeId as NodeId, z, x, y);
                if (!tile) return null;
                return tile.buffer.slice(tile.byteOffset, tile.byteOffset + tile.byteLength);
              },
              layerConfig: {
                layerType: 'fill',
                sourceLayer: 'default',
                layerId,
                sourceId,
              },
              promoteId: featureState?.featureIdProperty,
              featureState: featureState?.entries,
            });
          }

          if (node.nodeType === 'location') {
            const data = node.data as { dataSource?: string } | null;
            const dataSourceName = data?.dataSource;
            const layerId = `resource-layer-${node.id}`;
            const sourceId = `resource-source-${node.id}`;
            locationEntries.push({
              nodeId: String(node.id),
              nodeType: 'location',
              dataSourceName,
              absolutePath: withLayerOrder('location', absolutePath, String(node.id)),
              layerId,
              sourceId,
            });
          }


          if (node.nodeType === 'route') {
            const data = node.data as { processingStatus?: string; dataSourceName?: string } | null;
            const dataSourceName = data?.dataSourceName;
            if (data?.processingStatus) {
              const featureState = featureStateByStyleType.lines;
              const layerId = `resource-layer-${node.id}`;
              const sourceId = `resource-source-${node.id}`;
              routeEntries.push({
                nodeId: String(node.id),
                nodeType: 'route',
                dataSourceName,
                absolutePath: withLayerOrder('route', absolutePath, String(node.id)),
                dbName: getDBName('route'),
                tileDataProvider: async (z, x, y) => {
                  const api = await getRouteQueryAPI();
                  return api.getVectorTile(String(node.id) as NodeId, z, x, y);
                },
                layerConfig: {
                  layerType: 'line',
                  sourceLayer: 'layer0',
                  layerId,
                  sourceId,
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
          ]);
          setGeoJsonLayers(sortByLayerPath(geoJsonEntries));
          setLocationLayers(sortByPath(locationEntries));
          setStyleOverridesByType(styleOverrides);
          setStylerSummaries(stylerSummaries);
        }
      } catch (error) {
        if (cancelled) return;
        console.warn('[MapPage] Failed to load folder layers', error);
        setBasemapStyles([]);
        setVectorLayers([]);
        setGeoJsonLayers([]);
        setLocationLayers([]);
        setStyleOverridesByType({});
        setStylerSummaries([]);
      }
    };

    void loadFolderLayers();
    return () => {
      cancelled = true;
    };
  }, [nodeId, onPersistedZxy, searchZxy, stylerToggles]);

  return {
    basemapStyles,
    vectorLayers,
    geoJsonLayers,
    locationLayers,
    styleOverridesByType,
    mapInfo,
    stylerSummaries,
  };
};
