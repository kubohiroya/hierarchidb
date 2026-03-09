import type { NodeId } from '@hierarchidb/core-types';
import type { TreeNode } from '@hierarchidb/tree-api';
import type { RouteQueryAPI } from '@hierarchidb/route-api';
import type { ShapeQueryAPI } from '@hierarchidb/shape-api';
import { MAPLIBRE_PROPERTY_METADATA } from '@hierarchidb/styler-store';
import type {
  FeatureStateEntry,
  FeatureStateRecord,
  LayerSetId,
  MapLibreStyle,
  ResourceGeoJsonLayer,
  ResourceVectorLayer,
} from '@hierarchidb/ui-plugin-shell/ui-map';
import { DEFAULT_LAYER_SETS } from '@hierarchidb/ui-plugin-shell/ui-map';
import {
  parseShapeSourceLayerName,
  buildShapeSourceLayerName,
  buildRouteSourceLayerName,
} from '@hierarchidb/ui-plugin-shell/ui-map';
import { ensureWorkerAPI } from '@hierarchidb/ui-worker-client';
import { getDBName } from '@hierarchidb/util';
import { useEffect, useState } from 'react';
import { parseZxyParam } from '~/router/loaders/mapLoader';
import type { MapInfoSummary } from '~/router/routes/modeless/modelessDialogContent';
import { resolveMapStyleSource, sortByLayerPath, sortByPath } from './styleUtils.js';
import type {
  BasemapStyleEntry,
  FeatureStateBundle,
  LayerStyleOverrides,
  MapStyle,
  MapStylerSummary,
  PersistedZxyHandler,
} from './types.js';

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
  fallbackId: string
): string => {
  const prefix = kind === 'shape' ? '1' : kind === 'route' ? '2' : '3';
  const key = absolutePath ?? fallbackId;
  return `${prefix}/${key}`;
};

const layerSetPriorityById = new Map<LayerSetId, number>(
  DEFAULT_LAYER_SETS.map((set) => [set.id, set.priority])
);

const resolveLayerSetPriority = (id: LayerSetId): number =>
  (layerSetPriorityById.get(id) ?? 0) * 100;

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

type ParsedStylerNode = {
  nodeId: string;
  parentId: string;
  absolutePath: string;
  description?: string;
  styleType?: 'choropleth' | 'points' | 'lines';
  featureIdProperty?: string;
  targetProperty?: string;
  valueType: 'number' | 'color';
  paintOverrides: LayerStyleOverrides;
  featureStateEntries: FeatureStateEntry[];
  enabled: boolean;
  colorStops: Array<{ key: string; color: string }>;
  scalarStops: Array<{ key: string; scalarValue: number }>;
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
            (isRecord(rootNode.data)
              ? (rootNode.data as { map?: { zxy?: string } }).map?.zxy
              : undefined);
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
        const featureStateByStyleType: Partial<Record<'points' | 'lines', FeatureStateBundle>> = {};
        const stylerSummaries: MapStylerSummary[] = [];
        const parsedStylers: ParsedStylerNode[] = [];

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

          const parentId = node.parentId ? String(node.parentId) : '';
          if (!parentId) {
            throw new Error(`Styler node must have parentId: ${stylerNodeId}`);
          }

          const parsedStyler: ParsedStylerNode = {
            nodeId: stylerNodeId,
            parentId,
            absolutePath,
            description: node.metadata?.description ? String(node.metadata.description) : undefined,
            styleType,
            featureIdProperty,
            targetProperty: targetProperty ? String(targetProperty) : undefined,
            valueType,
            paintOverrides,
            featureStateEntries: entries,
            enabled,
            colorStops: data?.styleKeyValues?.colors ?? [],
            scalarStops: data?.styleKeyValues?.scalars ?? [],
          };
          parsedStylers.push(parsedStyler);

          stylerSummaries.push({
            nodeId: parsedStyler.nodeId,
            absolutePath: parsedStyler.absolutePath,
            description: parsedStyler.description,
            styleType: parsedStyler.styleType,
            featureIdProperty: parsedStyler.featureIdProperty,
            targetProperty: parsedStyler.targetProperty,
            valueType: parsedStyler.valueType,
            colorStops: parsedStyler.colorStops,
            scalarStops: parsedStyler.scalarStops,
            paintOverrides: parsedStyler.paintOverrides,
            enabled: parsedStyler.enabled,
          });

          if (!enabled || !styleType || !featureIdProperty) return;
          if (styleType !== 'choropleth' && entries.length > 0) {
            featureStateByStyleType[styleType] = { featureIdProperty, entries };
          }
        });

        const choroplethStylersByParentId = new Map<string, ParsedStylerNode[]>();
        parsedStylers.forEach((styler) => {
          if (!styler.enabled || styler.styleType !== 'choropleth') return;
          if (!styler.featureIdProperty) {
            throw new Error(`Enabled choropleth styler missing featureIdProperty: ${styler.nodeId}`);
          }
          const current = choroplethStylersByParentId.get(styler.parentId) ?? [];
          current.push(styler);
          choroplethStylersByParentId.set(styler.parentId, current);
        });

        const resolvedShapeLayerById = new Map<string, string | undefined>();
        const pickPreferredShapeLayer = (names: string[]): string | undefined => {
        if (names.length === 0) return undefined;
          const withLevel = names
            .map((name) => ({
              name,
              parsed: parseShapeSourceLayerName(name),
            }))
            .filter((entry): entry is { name: string; parsed: NonNullable<ReturnType<typeof parseShapeSourceLayerName>> } =>
              entry.parsed != null
            );

          if (withLevel.length === 0) return undefined;
          const sortedLevels = [
            ...new Set(withLevel.map((entry) => entry.parsed.adminLevel).filter((level): level is number => Number.isFinite(level))),
          ].sort((a, b) => a - b);
          const pickFromOrderedLevels = (levels: Array<number>): string | undefined => {
            for (const level of levels) {
              const levelEntries = withLevel.filter((entry) => entry.parsed.adminLevel === level);
              if (levelEntries.length === 0) continue;
            const nonBoundary = levelEntries.find((entry) => entry.parsed.boundary === 'f');
            const chosen = nonBoundary ?? levelEntries[0];
            if (!chosen) return undefined;
            return buildShapeSourceLayerName(
              chosen.parsed.adminLevel,
              chosen.parsed.boundary === 'b' ? 'boundary' : 'fill',
            );
            }
            return undefined;
          };
          return pickFromOrderedLevels(sortedLevels);
        };
        const resolveShapeSourceLayer = async (shapeNodeId: string): Promise<string | undefined> => {
          if (resolvedShapeLayerById.has(shapeNodeId)) {
            return resolvedShapeLayerById.get(shapeNodeId);
          }
          try {
            const query = await getShapeQueryAPI();
            const tiles = await query.listVectorTiles(shapeNodeId as NodeId);
            if (tiles.length === 0) {
              resolvedShapeLayerById.set(shapeNodeId, undefined);
              return undefined;
            }
            const prioritizedTiles = [...tiles].sort(
              (a, b) => (b.size - a.size) || (b.z - a.z) || (a.x - b.x) || (a.y - b.y),
            );
            const sample = prioritizedTiles.slice(0, 24);
            const allLayerNames: string[] = [];
            const nameSet = new Set<string>();
            for (const tile of sample) {
              try {
                const tileInfo = await query.getVectorTileInfo(shapeNodeId as NodeId, tile.z, tile.x, tile.y);
                const names = (tileInfo?.layers ?? [])
                  .map((layer) => layer.name)
                  .filter((name): name is string => Boolean(name));
                if (names.length > 0) {
                  names.forEach((name) => {
                    const normalized = name.trim();
                    if (!normalized || nameSet.has(normalized)) return;
                    nameSet.add(normalized);
                    allLayerNames.push(normalized);
                  });
                }
              } catch (tileError) {
                console.debug('[MapPage] Failed to inspect vector tile for shape source layer', {
                  nodeId: shapeNodeId,
                  z: tile.z,
                  x: tile.x,
                  y: tile.y,
                  error: tileError,
                });
              }
            }
      const resolved = pickPreferredShapeLayer(allLayerNames);
      resolvedShapeLayerById.set(shapeNodeId, resolved);
      return resolved;
          } catch (error) {
            console.debug('[MapPage] Failed to resolve shape sourceLayer', { nodeId: shapeNodeId, error });
            resolvedShapeLayerById.set(shapeNodeId, undefined);
            return undefined;
          }
        };

        for (const node of nodesForLayers) {
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
            const data = node.data as { buildConfig?: { dataSourceName?: string } } | null;
            const dataSourceName = data?.buildConfig?.dataSourceName;
            const shapeParentId = node.parentId ? String(node.parentId) : '';
            if (!shapeParentId) {
              throw new Error(`Shape node must have parentId: ${String(node.id)}`);
            }
            const siblingStylers = choroplethStylersByParentId.get(shapeParentId) ?? [];
            if (siblingStylers.length > 1) {
              throw new Error(
                `Multiple choropleth stylers found under same folder for shape ${String(node.id)}: ${siblingStylers.map((styler) => styler.nodeId).join(', ')}`
              );
            }
            const relatedStyler = siblingStylers[0];
            const layerId = `resource-layer-${node.id}`;
            const sourceId = `resource-source-${node.id}`;
            const resolvedSourceLayer = await resolveShapeSourceLayer(String(node.id));
            if (!resolvedSourceLayer) {
              console.debug('[MapPage] Failed to resolve canonical shape source layer for map rendering', {
                nodeId: String(node.id),
                sourceLayer: resolvedSourceLayer,
              });
              continue;
            }
          const resolvedSourceLayerInfo = parseShapeSourceLayerName(resolvedSourceLayer);
            if (!resolvedSourceLayerInfo) {
              console.debug('[MapPage] Skipped non-canonical shape source layer for map rendering', {
                nodeId: String(node.id),
                sourceLayer: resolvedSourceLayer,
              });
              continue;
            }
            const sourceLayerIsBoundary = resolvedSourceLayerInfo.boundary === 'b';
            const canonicalSourceLayer = buildShapeSourceLayerName(
              resolvedSourceLayerInfo.adminLevel,
              sourceLayerIsBoundary ? 'boundary' : 'fill',
            );
            const layerType = sourceLayerIsBoundary ? 'line' : 'fill';
            const relatedPaintOverrides = relatedStyler?.paintOverrides?.[layerType];
            shapeEntries.push({
              nodeId: String(node.id),
              nodeType: 'shape',
              dataSourceName,
              absolutePath: withLayerOrder('shape', absolutePath, String(node.id)),
              layerSetId: 'shape',
              layerPriority: resolveLayerSetPriority('shape'),
              layerLabel: absolutePath ?? String(node.id),
              dbName: getDBName('shape'),
              tileDataProvider: async (z, x, y, tileNodeId) => {
                if (!tileNodeId) return null;
                const api = await getShapeQueryAPI();
                const tile = await api.getVectorTile(tileNodeId as NodeId, z, x, y);
                if (!tile) return null;
                return tile.buffer.slice(tile.byteOffset, tile.byteOffset + tile.byteLength);
              },
              layerConfig: {
                layerType,
                sourceLayer: canonicalSourceLayer,
                layerId,
                sourceId,
                ...(relatedPaintOverrides ? { paint: relatedPaintOverrides } : {}),
              },
              promoteId: relatedStyler?.featureIdProperty,
              featureState: relatedStyler?.featureStateEntries,
            });
            continue;
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
                layerSetId: 'route',
                layerPriority: resolveLayerSetPriority('route'),
                layerLabel: absolutePath ?? String(node.id),
                dbName: getDBName('route'),
                tileDataProvider: async (z, x, y) => {
                  const api = await getRouteQueryAPI();
                  return api.getVectorTile(String(node.id) as NodeId, z, x, y);
                },
                layerConfig: {
                  layerType: 'line',
                  sourceLayer: buildRouteSourceLayerName(),
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
        }

        if (!cancelled) {
          setBasemapStyles(sortByPath(basemapEntries));
          setVectorLayers([...sortByPath(shapeEntries), ...sortByPath(routeEntries)]);
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
