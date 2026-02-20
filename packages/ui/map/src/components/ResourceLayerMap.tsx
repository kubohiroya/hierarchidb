


/**
 * @file ResourceLayerMap.tsx
 * @description Map component that composes basemap, vector layers, and style overrides.
 */

import type React from 'react';
import { isValidElement, useCallback, useEffect, useMemo, useRef, useState, useSyncExternalStore } from 'react';
import { Box as MuiBox, Button, IconButton, Snackbar, Typography } from '@mui/material';
import type { BoxProps } from '@mui/material';
import { FloatingWindow } from '@hierarchidb/ui-floating-window';
import type { WindowState } from '@hierarchidb/ui-floating-window';
import type { Theme } from '@mui/material/styles';
import type { SxProps } from '@mui/material/styles';
import { useTheme } from '@mui/material/styles';
import { Close as CloseIcon, FitScreen as FitScreenIcon, Tune as TuneIcon } from '@mui/icons-material';
import { createPortal } from 'react-dom';
import type { MapLibreGeoJSONFeature, MapLibreMapInstance, MapLibreStyle } from '~/types/maplibre-public';
import type { MapAttributionItem } from '~/types/attribution';
import type { LayerSetId } from '~/preview/layerSetDefinitions';
import type { FeatureCollection } from 'geojson';
import { VectorTileLayer } from './VectorTileLayer.js';
import { normalizePaintLiteralArrays } from '~/utils/maplibre-style-utils';
import {
  DEFAULT_MAP_CONFIG,
  type BaseMapProps,
  type VectorTileDataSource,
  type VectorTileLayerConfig,
} from '~/types/unified-map-props';
import type { MapLibreFilter } from '~/types/maplibre-public';
import { MapLibreMap, type MapLibreMapProps } from './MapLibreMap.js';
import { useResourceLayerMapStats, type MapStatsStore } from './useResourceLayerMapStats.js';
import { MapPreviewSearchPanel } from '~/preview/MapPreviewSearchPanel';
import { MapPreviewSearchSettingsDialog } from '~/preview/MapPreviewSearchSettingsDialog';
import { useMapFeatureHighlights } from '~/preview/useMapFeatureHighlights';
import { useMapFeatureHoverCandidates } from '~/preview/useMapFeatureHoverCandidates';
import { useMapFeatureSearch } from '~/preview/useMapFeatureSearch';
import { useMapFeatureSelectionGestures } from '~/preview/useMapFeatureSelectionGestures';
import { defaultFeatureIdAccessor } from '~/lib/feature-identification';
import { isFloatingWindowInteractionActive } from '~/lib/floating-window-interaction';
import type { MapSearchTargetDefinition, MapSearchTargetGroup } from '~/preview/mapPreviewSearchTypes';
import {
  buildHighlightKey,
  mapHoverCandidatesAtom,
  mapHoverMatchesAtom,
  mapHoveredFeaturesAtom,
  mapSearchMatchesAtom,
  mapSearchTargetsAtom,
  mapSearchTextAtom,
  mapSelectedMatchesAtom,
  mapViewportFeatureIdsAtom,
  type MapHighlightEntry,
} from '~/interaction/mapInteractionStore';
import { useAtom, useAtomValue, useSetAtom } from 'jotai';

type BasemapStyleEntry = {
  nodeId: string;
  absolutePath?: string;
  style: string | MapLibreStyle;
};

type MapLayerType = NonNullable<VectorTileLayerConfig['layerType']>;
type LayerStyleOverrides = Partial<Record<MapLayerType, Record<string, unknown>>>;
type Bounds = { minLng: number; minLat: number; maxLng: number; maxLat: number };



export type ResourceVectorLayer = VectorTileDataSource & {
  nodeId: string;
  nodeType: 'shape' | 'location' | 'route';
  dataSourceName?: string;
  absolutePath?: string;
  layerConfig?: VectorTileLayerConfig;
  layerSetId?: LayerSetId;
  layerPriority?: number;
  hierarchyLevel?: number;
  layerLabel?: string;
};

export type ResourceGeoJsonLayer = {
  layerId: string;
  sourceId: string;
  data: FeatureCollection;
  layerType: 'line' | 'circle' | 'fill' | 'symbol';
  paint?: Record<string, unknown>;
  layout?: Record<string, unknown>;
  filter?: MapLibreFilter;
  beforeId?: string;
  absolutePath?: string;
  layerSetId?: LayerSetId;
  layerPriority?: number;
  hierarchyLevel?: number;
  layerLabel?: string;
};

export type ResourceLayerMapProps = BaseMapProps & {
  basemapStyles?: BasemapStyleEntry[];
  vectorLayers: ResourceVectorLayer[];
  geoJsonLayers?: ResourceGeoJsonLayer[];
  styleOverrides?: Record<string, unknown>;
  styleOverridesByType?: LayerStyleOverrides;
  highlightOverridesByType?: LayerStyleOverrides;
  attributionItems?: MapAttributionItem[];
  controls?: MapLibreMapProps['controls'];
  hoveredFeatures?: MapLibreGeoJSONFeature[];
  snackbar?: {
    position?: 'top' | 'bottom' | 'bottom-center' | 'top-left' | 'top-right' | 'bottom-left' | 'bottom-right';
    content?: React.ReactNode;
    renderContent?: (features: MapLibreGeoJSONFeature[]) => React.ReactNode;
    autoHideDuration?: number | null;
    open?: boolean;
    contentSx?: SxProps<Theme>;
  };
  interaction?: {
    enabled?: boolean;
    highlightLayerIds?: string[];
    buildHighlightEntry?: (feature?: MapLibreGeoJSONFeature | null) => MapHighlightEntry | null;
    onMissingLayers?: (layerIds: string[]) => void;
    search?: {
      enabled?: boolean;
      targetDefinitions?: Record<string, MapSearchTargetDefinition>;
      targetGroups?: Array<MapSearchTargetGroup<string>>;
      placeholder?: string;
      showSettings?: boolean;
      fitOnSearch?: boolean;
      fitPadding?: number;
    };
    hover?: {
      enabled?: boolean;
      radius?: number;
    };
    selection?: {
      enabled?: boolean;
      radius?: number;
    };
    fitSelection?: {
      enabled?: boolean;
      padding?: number;
    };
    snackbar?: {
      enabled?: boolean;
      position?: 'top' | 'bottom' | 'bottom-center' | 'top-left' | 'top-right' | 'bottom-left' | 'bottom-right';
      content?: React.ReactNode;
      renderContent?: (features: MapLibreGeoJSONFeature[]) => React.ReactNode;
      autoHideDuration?: number | null;
      open?: boolean;
      contentSx?: SxProps<Theme>;
    };
  };
  stats?: {
    enabled?: boolean;
    position?: 'top-left' | 'top-right' | 'bottom-left' | 'bottom-right';
    display?: 'overlay' | 'floating';
    renderExtra?: () => React.ReactNode;
    floatingWindow?: {
      title?: string;
      titleIcon?: React.ReactNode;
      initialState?: WindowState;
      resizable?: boolean;
      draggable?: boolean;
      minWidth?: number;
      minHeight?: number;
      maxWidth?: number;
      maxHeight?: number;
      showToggleButton?: boolean;
      toggleButtonIcon?: React.ReactNode;
      toggleButtonPosition?: {
        top?: number;
        right?: number;
        bottom?: number;
        left?: number;
      };
    };
  };
};

const LAYER_PAINT_KEYS: Record<MapLayerType, Set<string>> = {
  fill: new Set(['fill-color', 'fill-opacity', 'fill-outline-color']),
  line: new Set(['line-color', 'line-opacity', 'line-width']),
  circle: new Set(['circle-color', 'circle-opacity', 'circle-radius']),
  symbol: new Set(['text-color', 'text-halo-color', 'text-halo-width']),
  raster: new Set(['raster-opacity', 'raster-brightness-max', 'raster-brightness-min', 'raster-contrast']),
  background: new Set(['background-color', 'background-opacity', 'background-pattern']),
};

const pickStyleOverrides = (
  layerType: VectorTileLayerConfig['layerType'] | undefined,
  overrides?: Record<string, unknown>,
  overridesByType?: LayerStyleOverrides,
): Record<string, unknown> => {
  const allowed = LAYER_PAINT_KEYS[layerType ?? 'fill'];
  if (!allowed) return {};
  const globalOverrides = overrides ?? {};
  const typedOverrides = overridesByType?.[layerType ?? 'fill'] ?? {};
  return Object.fromEntries(
    Object.entries({ ...typedOverrides, ...globalOverrides }).filter(([key]) => allowed.has(key))
  );
};

const toFiniteNumber = (value: unknown, fallback: number): number =>
  typeof value === 'number' && Number.isFinite(value) ? value : fallback;

const buildDefaultHighlightOverrides = (
  layerType: VectorTileLayerConfig['layerType'] | undefined,
  basePaint: Record<string, unknown>,
  theme: Theme,
): Record<string, unknown> => {
  const hasSearch = ['boolean', ['feature-state', 'hdbSearch'], false];
  const hasHover = ['boolean', ['feature-state', 'hdbHover'], false];
  const hasSelected = ['boolean', ['feature-state', 'hdbSelected'], false];
  const selectedColor = theme.palette.primary.main;
  const hoverColor = theme.palette.primary.light;
  const searchColor = theme.palette.secondary.light;

  const colorExpression = (base: unknown) => [
    'case',
    hasSelected,
    selectedColor,
    hasHover,
    hoverColor,
    hasSearch,
    searchColor,
    base,
  ];

  switch (layerType ?? 'fill') {
    case 'line': {
      const baseColor = basePaint['line-color'] ?? theme.palette.primary.main;
      const baseWidth = toFiniteNumber(basePaint['line-width'], 2);
      const baseOpacity = toFiniteNumber(basePaint['line-opacity'], 0.8);
      return {
        'line-color': colorExpression(baseColor),
        'line-width': [
          'case',
          hasSelected,
          baseWidth + 1.6,
          hasHover,
          baseWidth + 0.8,
          hasSearch,
          baseWidth + 0.4,
          baseWidth,
        ],
        'line-opacity': [
          'case',
          hasSelected,
          Math.min(1, baseOpacity + 0.2),
          hasHover,
          Math.min(1, baseOpacity + 0.1),
          hasSearch,
          Math.min(1, baseOpacity + 0.05),
          baseOpacity,
        ],
      };
    }
    case 'circle': {
      const baseColor = basePaint['circle-color'] ?? theme.palette.primary.main;
      const baseRadius = toFiniteNumber(basePaint['circle-radius'], 4);
      const baseOpacity = toFiniteNumber(basePaint['circle-opacity'], 0.8);
      const baseStroke = basePaint['circle-stroke-color'] ?? baseColor;
      const baseStrokeWidth = toFiniteNumber(basePaint['circle-stroke-width'], 0);
      return {
        'circle-color': colorExpression(baseColor),
        'circle-radius': [
          'case',
          hasSelected,
          baseRadius + 2,
          hasHover,
          baseRadius + 1,
          hasSearch,
          baseRadius + 0.5,
          baseRadius,
        ],
        'circle-opacity': [
          'case',
          hasSelected,
          Math.min(1, baseOpacity + 0.15),
          hasHover,
          Math.min(1, baseOpacity + 0.08),
          hasSearch,
          Math.min(1, baseOpacity + 0.05),
          baseOpacity,
        ],
        'circle-stroke-color': colorExpression(baseStroke),
        'circle-stroke-width': [
          'case',
          hasSelected,
          baseStrokeWidth + 1.5,
          hasHover,
          baseStrokeWidth + 0.8,
          hasSearch,
          baseStrokeWidth + 0.4,
          baseStrokeWidth,
        ],
      };
    }
    case 'fill':
    default: {
      const baseColor = basePaint['fill-color'] ?? theme.palette.primary.light;
      const baseOutline = basePaint['fill-outline-color'] ?? baseColor;
      const baseOpacity = toFiniteNumber(basePaint['fill-opacity'], 0.3);
      return {
        'fill-color': colorExpression(baseColor),
        'fill-outline-color': colorExpression(baseOutline),
        'fill-opacity': [
          'case',
          hasSelected,
          Math.min(1, baseOpacity + 0.35),
          hasHover,
          Math.min(1, baseOpacity + 0.2),
          hasSearch,
          Math.min(1, baseOpacity + 0.12),
          baseOpacity,
        ],
      };
    }
  }
};

type SortableLayer = {
  absolutePath?: string;
  nodeId?: string;
  layerId?: string;
  sourceId?: string;
  layerPriority?: number;
};

const sortByPath = <T extends SortableLayer>(items: T[]): T[] =>
  [...items].sort((a, b) => {
    const aKey = a.absolutePath ?? a.nodeId ?? a.layerId ?? a.sourceId ?? '';
    const bKey = b.absolutePath ?? b.nodeId ?? b.layerId ?? b.sourceId ?? '';
    return aKey.localeCompare(bKey);
  });

const sortByLayerPriority = <T extends SortableLayer>(items: T[]): T[] =>
  [...items].sort((a, b) => {
    const aPriority = a.layerPriority ?? 0;
    const bPriority = b.layerPriority ?? 0;
    if (aPriority !== bPriority) return aPriority - bPriority;
    const aKey = a.absolutePath ?? a.nodeId ?? a.layerId ?? a.sourceId ?? '';
    const bKey = b.absolutePath ?? b.nodeId ?? b.layerId ?? b.sourceId ?? '';
    return aKey.localeCompare(bKey);
  });

const ADMIN_LABEL_PATTERN = /(?:adm|admin)\s*(\d+)/i;

const toPropertyString = (value: unknown): string | undefined => {
  if (typeof value === 'string') return value.trim() || undefined;
  if (typeof value === 'number') return Number.isFinite(value) ? String(value) : undefined;
  return undefined;
};

const pickFirstString = (properties: Record<string, unknown>, keys: string[]): string | undefined => {
  for (const key of keys) {
    const value = toPropertyString(properties[key]);
    if (value) return value;
  }
  return undefined;
};

const resolveAdminLevel = (properties: Record<string, unknown>): number | undefined => {
  const candidates = [
    properties.adminLevel,
    properties.admin_level,
    properties.ADM_LEVEL,
    properties.level,
    properties.admin_lvl,
  ];
  for (const value of candidates) {
    if (typeof value === 'number' && Number.isFinite(value)) return value;
    if (typeof value === 'string') {
      const parsed = Number(value);
      if (Number.isFinite(parsed)) return parsed;
    }
  }
  const labelCandidates = [
    properties.shapeType,
    properties.boundaryType,
    properties.adminType,
    properties.ADMIN_TYPE,
    properties.layer,
    properties.LAYER,
  ];
  for (const candidate of labelCandidates) {
    if (typeof candidate !== 'string') continue;
    const match = candidate.match(ADMIN_LABEL_PATTERN);
    if (!match) continue;
    const parsed = Number(match[1]);
    if (Number.isFinite(parsed)) return parsed;
  }
  return undefined;
};

const buildAdminHoverCandidate = (
  properties: Record<string, unknown>,
): { level: number; label: string } | null => {
  const level = resolveAdminLevel(properties);
  if (level == null) return null;
  const adminLabel = `ADM${level}`;
  const adminName = pickFirstString(properties, [
    'name',
    'NAME',
    'name_en',
    'NAME_EN',
    'shapeName',
    'NAME_1',
    'NAME_2',
    'NAME_3',
    'NAME_4',
    'NAME_5',
    'adminName',
  ]);
  const countryName = pickFirstString(properties, [
    'countryName',
    'country',
    'COUNTRY',
    'COUNTRY_NAME',
    'NAME_0',
    'ADMIN',
    'SOVEREIGNT',
  ]);
  const countryCode = pickFirstString(properties, [
    'countryCode',
    'ISO_A2',
    'ISO2',
    'ISO_2',
    'ISO_A3',
    'ADM0_A3',
    'ISO3',
    'shapeISO',
  ]);
  const countrySuffix = countryCode ? ` (${countryCode})` : '';
  if (level <= 0) {
    const label = countryName ? `${adminLabel}: ${countryName}${countrySuffix}` : `${adminLabel}: Unknown`;
    return { level, label };
  }
  if (level === 1) {
    const admin1 = adminName ?? countryName ?? 'Unknown';
    const country = countryName ?? 'Unknown';
    return { level, label: `${adminLabel}: ${admin1} / ${country}${countrySuffix}` };
  }
  const admin2 = adminName ?? 'Unknown';
  const admin1 = pickFirstString(properties, [
    'admin1Name',
    'NAME_1',
    'name_1',
    'ADM1_NAME',
    'admin1',
  ]);
  const country = countryName ?? 'Unknown';
  const parts = [admin2, admin1, country].filter((part): part is string => Boolean(part && part.trim().length > 0));
  return { level, label: `${adminLabel}: ${parts.join(' / ')}${countrySuffix}` };
};

const buildDefaultHoverLabel = (properties: Record<string, unknown>): string | null => {
  const label =
    (properties.name as string | undefined) ??
    (properties.NAME as string | undefined) ??
    (properties.label as string | undefined) ??
    (properties.id as string | number | undefined);
  return label ? String(label) : null;
};

const buildHoverSnackbarContent = (features: MapLibreGeoJSONFeature[]): React.ReactNode => {
  if (features.length === 0) return '';
  const adminCandidates = features
    .map((feature, index) => {
      const props = (feature.properties ?? {}) as Record<string, unknown>;
      const adminParts = buildAdminHoverCandidate(props);
      if (!adminParts) return null;
      return { index, ...adminParts };
    })
    .filter(
      (candidate): candidate is { index: number; level: number; label: string } =>
        Boolean(candidate),
    );
  if (adminCandidates.length > 0) {
    adminCandidates.sort((a, b) => (b.level - a.level) || (a.index - b.index));
    return adminCandidates[0]?.label ?? '';
  }
  const labels = features
    .slice(0, 3)
    .map((feature) => {
      const props = (feature.properties ?? {}) as Record<string, unknown>;
      return buildDefaultHoverLabel(props) ?? 'Feature';
    });
  return labels.join(' / ');
};

const formatBytes = (value: number): string => {
  if (!Number.isFinite(value) || value <= 0) return '0 B';
  const units = ['B', 'KB', 'MB', 'GB'];
  let size = value;
  let index = 0;
  while (size >= 1024 && index < units.length - 1) {
    size /= 1024;
    index += 1;
  }
  return `${size.toFixed(size >= 10 || index === 0 ? 0 : 1)} ${units[index]}`;
};

const isRenderableNode = (value: unknown): value is React.ReactNode => {
  if (value == null || typeof value === 'boolean') return false;
  if (typeof value === 'string' || typeof value === 'number') return true;
  if (Array.isArray(value)) return true;
  return isValidElement(value);
};

const normalizeChildren = (children: React.ReactNode): React.ReactNode => {
  if (children == null || typeof children === 'boolean') return null;
  if (Array.isArray(children)) {
    const filtered = children.filter(isRenderableNode);
    return filtered.length > 0 ? filtered : null;
  }
  return isRenderableNode(children) ? children : null;
};

const Box: React.FC<BoxProps> = ({ children, ...props }) => (
  <MuiBox {...props}>{normalizeChildren(children)}</MuiBox>
);

const MapStatsPanel: React.FC<{
  store: MapStatsStore;
  vectorLayerEntries: Array<{ id: string; label?: string }>;
  renderExtra?: () => React.ReactNode;
  showTitle?: boolean;
  title?: string;
}> = ({ store, vectorLayerEntries, renderExtra, showTitle = true, title = 'Dexie Tile Stats' }) => {
  const snapshot = useSyncExternalStore(store.subscribe, store.getSnapshot, store.getSnapshot);
  const extraNode = useMemo(() => {
    if (!renderExtra) return null;
    const rendered = renderExtra();
    return isRenderableNode(rendered) ? rendered : null;
  }, [renderExtra]);
  return (
    <Box
      display="flex"
      gap={1}
      alignItems="flex-start"
      sx={{ px: 1.5, py: 1, color: 'text.primary' }}
    >
        {showTitle ? (
          <Typography variant="caption" fontWeight={700} display="block">
            {title}
          </Typography>
        ) : null}
        <Box mt={0.5}>
          <Typography variant="caption" display="block">
            Requests: {snapshot.tileStats.requests.toLocaleString()}
          </Typography>
          <Typography variant="caption" display="block">
            Data: {formatBytes(snapshot.tileStats.bytes)}
          </Typography>
        </Box>
        <Box mt={0.75}>
          <Typography variant="caption" fontWeight={600} display="block">
            Viewport Features
          </Typography>
          {vectorLayerEntries.length === 0 ? (
            <Typography variant="caption" display="block">
              No layers
            </Typography>
          ) : (
            vectorLayerEntries.map((entry) => (
              <Typography key={entry.id} variant="caption" display="block">
                {entry.label}: {snapshot.featureCounts[entry.id]?.toLocaleString() ?? '0'}
              </Typography>
            ))
          )}
        </Box>
      {extraNode ? (
        <Box sx={{ px: 1.5, py: 1, color: 'text.primary' }}>
          {extraNode}
        </Box>
      ) : null}
    </Box>
  );
};

const DEFAULT_STATS_WINDOW_STATE: WindowState = {
  position: { x: 24, y: 96 },
  size: { width: 260, height: 220 },
  isMinimized: false,
  isFullscreen: false,
  isVisible: true,
  zIndex: 1200,
};


export const ResourceLayerMap: React.FC<ResourceLayerMapProps> = (props) => {
  const theme = useTheme();
  const {
    basemapStyles,
    vectorLayers,
    geoJsonLayers,
    styleOverrides,
    styleOverridesByType,
    highlightOverridesByType,
    hoveredFeatures,
    snackbar,
    interaction,
    mapStyleUrl,
    mapStyleObject,
    onLoad,
    attributionItems,
    controls,
    stats,
    ...baseMapProps
  } = props as ResourceLayerMapProps & {
    mapStyleUrl?: string;
    mapStyleObject?: MapLibreStyle;
  };

  const resolvedControls = useMemo(() => {
    if (!attributionItems || attributionItems.length === 0) return controls;
    if (controls?.attribution === false) return controls;
    const existing = typeof controls?.attribution === 'object' ? controls.attribution : {};
    return {
      ...controls,
      attribution: {
        ...existing,
        items: attributionItems,
      },
    };
  }, [attributionItems, controls]);

  const [mapInstance, setMapInstance] = useState<MapLibreMapInstance | null>(null);
  const [mapControlContainer, setMapControlContainer] = useState<HTMLElement | null>(null);
  const [fitControlContainer, setFitControlContainer] = useState<HTMLElement | null>(null);
  const [searchSettingsOpen, setSearchSettingsOpen] = useState(false);
  const [floatingInteractionActive, setFloatingInteractionActive] = useState(false);
  const canvasPointerEventsRef = useRef<string | null>(null);
  const containerPointerEventsRef = useRef<string | null>(null);
  const geoJsonLayerIdsRef = useRef<Set<string>>(new Set());
  const geoJsonSourceIdsRef = useRef<Set<string>>(new Set());
  const mapInstanceRef = useRef<MapLibreMapInstance | null>(null);

  useEffect(() => {
    mapInstanceRef.current = mapInstance;
  }, [mapInstance]);

  useEffect(() => {
    if (typeof document === 'undefined') return undefined;
    const body = document.body;
    if (!body) return undefined;
    const updateState = () => {
      setFloatingInteractionActive(isFloatingWindowInteractionActive());
    };
    updateState();
    const observer = new MutationObserver(() => updateState());
    observer.observe(body, { attributes: true, attributeFilter: ['data-hdb-floating-window-interaction'] });
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    if (!mapInstance) return;
    const container = mapInstance.getContainer();
    const canvas = mapInstance.getCanvas();
    if (floatingInteractionActive) {
      if (canvasPointerEventsRef.current === null) {
        canvasPointerEventsRef.current = canvas.style.pointerEvents;
      }
      if (containerPointerEventsRef.current === null) {
        containerPointerEventsRef.current = container.style.pointerEvents;
      }
      container.style.pointerEvents = 'none';
      canvas.style.pointerEvents = 'none';
    } else if (canvasPointerEventsRef.current !== null) {
      container.style.pointerEvents = containerPointerEventsRef.current ?? '';
      containerPointerEventsRef.current = null;
      canvas.style.pointerEvents = canvasPointerEventsRef.current;
      canvasPointerEventsRef.current = null;
    }
    return () => {
      if (containerPointerEventsRef.current !== null) {
        container.style.pointerEvents = containerPointerEventsRef.current;
        containerPointerEventsRef.current = null;
      }
      if (canvasPointerEventsRef.current !== null) {
        canvas.style.pointerEvents = canvasPointerEventsRef.current;
        canvasPointerEventsRef.current = null;
      }
    };
  }, [floatingInteractionActive, mapInstance]);

  const orderedBasemaps = useMemo(() => (basemapStyles ? sortByPath(basemapStyles) : []), [basemapStyles]);
  const orderedLayers = useMemo(() => sortByLayerPriority(vectorLayers), [vectorLayers]);
  const orderedGeoJsonLayers = useMemo(
    () => (geoJsonLayers ? sortByLayerPriority(geoJsonLayers) : []),
    [geoJsonLayers]
  );

  const renderLayerEntries = useMemo(() => (
    orderedLayers.map((layer) => {
      const layerConfig = { ...DEFAULT_MAP_CONFIG.vectorTileLayer, ...layer.layerConfig };
      const layerType = layerConfig.layerType ?? 'fill';
      const paintOverrides = pickStyleOverrides(layerType, styleOverrides, styleOverridesByType);
      const baseLayerPaint = { ...(layerConfig.paint ?? {}), ...paintOverrides };
      const highlightOverrides =
        highlightOverridesByType?.[layerType]
        ?? buildDefaultHighlightOverrides(layerType, baseLayerPaint, theme);
      const layerPaint = { ...baseLayerPaint, ...highlightOverrides };
      const layerId = layerConfig.layerId ?? `resource-layer-${layer.nodeId}`;
      const sourceId = layerConfig.sourceId ?? `resource-source-${layer.nodeId}`;

      return {
        layer,
        layerConfig,
        layerType,
        layerPaint,
        layerId,
        sourceId,
      };
    })
  ), [orderedLayers, styleOverrides, styleOverridesByType, highlightOverridesByType, theme]);

  const statsEnabled = Boolean(stats?.enabled);
  const statsPosition = stats?.position ?? 'top-left';
  const statsDisplay = stats?.display ?? 'overlay';
  const statsWindowConfig = stats?.floatingWindow;
  const statsWindowTitle = statsWindowConfig?.title ?? 'Dexie Tile Stats';
  const statsWindowIcon = statsWindowConfig?.titleIcon;
  const statsWindowInitialState = statsWindowConfig?.initialState ?? DEFAULT_STATS_WINDOW_STATE;
  const [statsWindowState, setStatsWindowState] = useState<WindowState>(() => ({
    position: statsWindowInitialState.position,
    size: statsWindowInitialState.size,
    isMinimized: statsWindowInitialState.isMinimized ?? false,
    isFullscreen: statsWindowInitialState.isFullscreen ?? false,
    isVisible: statsWindowInitialState.isVisible !== false,
    zIndex: statsWindowInitialState.zIndex ?? 1000,
  }));
  const statsWindowProps = {
    resizable: statsWindowConfig?.resizable ?? false,
    draggable: statsWindowConfig?.draggable ?? true,
    minWidth: statsWindowConfig?.minWidth ?? 220,
    minHeight: statsWindowConfig?.minHeight ?? 140,
    maxWidth: statsWindowConfig?.maxWidth,
    maxHeight: statsWindowConfig?.maxHeight,
  };
  const statsToggleButtonVisible = statsWindowConfig?.showToggleButton ?? false;
  const statsToggleButtonIcon = statsWindowConfig?.toggleButtonIcon ?? statsWindowIcon ?? <TuneIcon fontSize="small" />;
  const resolvedStatsWindowIcon = isRenderableNode(statsWindowIcon) ? statsWindowIcon : null;
  const resolvedStatsToggleButtonIcon = isRenderableNode(statsToggleButtonIcon) ? statsToggleButtonIcon : null;
  const statsToggleButtonPosition = useMemo(()=>statsWindowConfig?.toggleButtonPosition ?? { top: 12, left: 12 }, [
    statsWindowConfig?.toggleButtonPosition
  ]);
  const resolvedStatsToggleButtonPosition = useMemo(() => {
    if (!mapControlContainer || statsToggleButtonPosition.top == null || statsToggleButtonPosition.right == null) {
      return statsToggleButtonPosition;
    }
    const rect = mapControlContainer.getBoundingClientRect();
    const offset = Number.isFinite(rect.height) ? rect.height : 0;
    if (offset <= 0) return statsToggleButtonPosition;
    const adjustedTop = Math.max(statsToggleButtonPosition.top, offset + 8);
    if (adjustedTop === statsToggleButtonPosition.top) return statsToggleButtonPosition;
    return { ...statsToggleButtonPosition, top: adjustedTop };
  }, [mapControlContainer, statsToggleButtonPosition]);
  const statsWindowOpen = statsWindowState.isVisible !== false;

  const resolvedBaseStyle = useMemo(() => {
    if (orderedBasemaps.length) return orderedBasemaps[0]?.style;
    if (mapStyleObject) return mapStyleObject;
    return mapStyleUrl ?? DEFAULT_MAP_CONFIG.mapStyleUrl;
  }, [mapStyleObject, mapStyleUrl, orderedBasemaps]);

  const mapStyleProps =
    typeof resolvedBaseStyle === 'string'
      ? { mapStyleUrl: resolvedBaseStyle }
      : { mapStyleObject: resolvedBaseStyle };

  const handleMapLoad = useCallback(
    (map: MapLibreMapInstance) => {
      setMapInstance(map);
      onLoad?.(map);
    },
    [onLoad]
  );

  useEffect(() => {
    if (!mapInstance) {
      setMapControlContainer(null);
      return;
    }
    const container = mapInstance.getContainer().querySelector('.maplibregl-ctrl-top-right');
    setMapControlContainer(container instanceof HTMLElement ? container : null);
  }, [mapInstance]);
  useEffect(() => {
    if (!mapInstance) return;
    const map = mapInstance as MapLibreMapInstance & {
      addSource: (id: string, source: unknown) => void;
      addLayer: (layer: Record<string, unknown>, beforeId?: string) => void;
      getLayer: (id: string) => unknown;
      getSource: (id: string) => unknown;
      removeLayer: (id: string) => void;
      removeSource: (id: string) => void;
      setFilter?: (id: string, filter: unknown) => void;
      setLayoutProperty?: (id: string, key: string, value: unknown) => void;
      setPaintProperty?: (id: string, key: string, value: unknown) => void;
      moveLayer?: (id: string, beforeId?: string) => void;
    };
    if (!orderedGeoJsonLayers.length) {
      geoJsonLayerIdsRef.current.forEach((layerId) => {
        if (map.getLayer(layerId)) map.removeLayer(layerId);
      });
      geoJsonSourceIdsRef.current.forEach((sourceId) => {
        if (map.getSource(sourceId)) map.removeSource(sourceId);
      });
      geoJsonLayerIdsRef.current = new Set();
      geoJsonSourceIdsRef.current = new Set();
      return;
    }
    const sourceData = new Map<string, FeatureCollection>();
    orderedGeoJsonLayers.forEach((layer) => {
      if (!sourceData.has(layer.sourceId)) {
        sourceData.set(layer.sourceId, layer.data);
      }
    });
    const nextLayerIds = new Set(orderedGeoJsonLayers.map((layer) => layer.layerId));
    const nextSourceIds = new Set(sourceData.keys());

    geoJsonLayerIdsRef.current.forEach((layerId) => {
      if (!nextLayerIds.has(layerId) && map.getLayer(layerId)) {
        map.removeLayer(layerId);
      }
    });

    geoJsonSourceIdsRef.current.forEach((sourceId) => {
      if (!nextSourceIds.has(sourceId) && map.getSource(sourceId)) {
        map.removeSource(sourceId);
      }
    });

    sourceData.forEach((data, sourceId) => {
      const source = map.getSource(sourceId) as { setData?: (data: FeatureCollection) => void } | undefined;
      if (source?.setData) {
        source.setData(data);
        return;
      }
      if (source) {
        map.removeSource(sourceId);
      }
      map.addSource(sourceId, { type: 'geojson', data });
    });

    orderedGeoJsonLayers.forEach((layer) => {
      const paint = normalizePaintLiteralArrays(layer.paint ?? {});
      if (!map.getLayer(layer.layerId)) {
        map.addLayer(
          {
            id: layer.layerId,
            type: layer.layerType,
            source: layer.sourceId,
            paint,
            layout: layer.layout ?? {},
            ...(layer.filter ? { filter: layer.filter } : {}),
          },
          layer.beforeId,
        );
        return;
      }
      map.setFilter?.(layer.layerId, layer.filter ?? null);
      Object.entries(layer.layout ?? {}).forEach(([key, value]) => {
        map.setLayoutProperty?.(layer.layerId, key, value);
      });
      Object.entries(paint).forEach(([key, value]) => {
        map.setPaintProperty?.(layer.layerId, key, value);
      });
      if (map.moveLayer && layer.beforeId !== undefined) {
        map.moveLayer(layer.layerId, layer.beforeId);
      }
    });

    geoJsonLayerIdsRef.current = nextLayerIds;
    geoJsonSourceIdsRef.current = nextSourceIds;
  }, [mapInstance, orderedGeoJsonLayers]);

  useEffect(() => () => {
    const map = mapInstanceRef.current as (MapLibreMapInstance & {
      getLayer: (id: string) => unknown;
      getSource: (id: string) => unknown;
      removeLayer: (id: string) => void;
      removeSource: (id: string) => void;
    }) | null;
    if (!map) return;
    geoJsonLayerIdsRef.current.forEach((layerId) => {
      if (map.getLayer(layerId)) map.removeLayer(layerId);
    });
    geoJsonSourceIdsRef.current.forEach((sourceId) => {
      if (map.getSource(sourceId)) map.removeSource(sourceId);
    });
  }, []);

  const interactionEnabled = interaction ? (interaction.enabled ?? true) : false;
  const searchConfig = interaction?.search;
  const hoverConfig = interaction?.hover;
  const selectionConfig = interaction?.selection;
  const fitSelectionConfig = interaction?.fitSelection;
  const interactionSnackbar = interaction?.snackbar;

  const searchEnabled = interactionEnabled && Boolean(searchConfig?.enabled ?? searchConfig?.targetDefinitions);
  const hoverEnabled = interactionEnabled && (hoverConfig?.enabled ?? true);
  const selectionEnabled = interactionEnabled && (selectionConfig?.enabled ?? true);
  const fitSelectionEnabled = interactionEnabled && (fitSelectionConfig?.enabled ?? true);
  const snackbarEnabled = interactionEnabled ? (interactionSnackbar?.enabled ?? true) : Boolean(snackbar);

  const vectorLayerEntries = useMemo(() => (
    orderedLayers.map((layer) => {
      const layerId = layer.layerConfig?.layerId ?? `resource-layer-${layer.nodeId}`;
      const sourceId = layer.layerConfig?.sourceId ?? `resource-source-${layer.nodeId}`;
      return {
        id: layerId,
        label: layer.layerConfig?.layerId ?? layer.nodeId,
        sourceId,
        sourceLayer: layer.layerConfig?.sourceLayer,
      };
    })
  ), [orderedLayers]);

  const {
    statsActive,
    statsContainer,
    statsPositionStyle,
    statsStore,
    handleTileRequest,
  } = useResourceLayerMapStats({
    mapInstance,
    orderedLayers,
    vectorLayerEntries,
    statsEnabled,
    statsPosition,
  });

  useEffect(() => {
    if (!fitSelectionEnabled || !mapControlContainer) {
      if (fitControlContainer?.parentNode) {
        fitControlContainer.parentNode.removeChild(fitControlContainer);
      }
      setFitControlContainer(null);
      return;
    }
    if (!fitControlContainer) {
      const container = document.createElement('div');
      container.className = 'maplibregl-ctrl maplibregl-ctrl-group';
      setFitControlContainer(container);
      return;
    }
    const insertContainer = () => {
      const navControl = mapControlContainer.querySelector('.maplibregl-ctrl-group');
      if (navControl && navControl.nextSibling !== fitControlContainer) {
        mapControlContainer.insertBefore(fitControlContainer, navControl.nextSibling);
        return;
      }
      if (!navControl && mapControlContainer.lastChild !== fitControlContainer) {
        mapControlContainer.appendChild(fitControlContainer);
      }
    };
    insertContainer();
    const frame = window.requestAnimationFrame(insertContainer);
    return () => window.cancelAnimationFrame(frame);
  }, [fitSelectionEnabled, mapControlContainer, fitControlContainer]);

  const highlightLayerIds = useMemo(() => {
    if (interaction?.highlightLayerIds?.length) return interaction.highlightLayerIds;
    return [
      ...orderedLayers.map((layer) => layer.layerConfig?.layerId ?? `resource-layer-${layer.nodeId}`),
      ...orderedGeoJsonLayers.map((layer) => layer.layerId),
    ];
  }, [interaction?.highlightLayerIds, orderedGeoJsonLayers, orderedLayers]);

  const highlightLayerPriorityById = useMemo(() => {
    const map = new Map<string, number>();
    orderedLayers.forEach((layer) => {
      const layerId = layer.layerConfig?.layerId ?? `resource-layer-${layer.nodeId}`;
      map.set(layerId, layer.layerPriority ?? 0);
    });
    orderedGeoJsonLayers.forEach((layer) => {
      map.set(layer.layerId, layer.layerPriority ?? 0);
    });
    return map;
  }, [orderedGeoJsonLayers, orderedLayers]);

  const buildHighlightEntry = useCallback(
    (feature?: MapLibreGeoJSONFeature | null) => {
      if (interaction?.buildHighlightEntry) {
        return interaction.buildHighlightEntry(feature);
      }
      if (!feature) return null;
      const id = defaultFeatureIdAccessor(feature);
      const source = typeof feature.source === 'string' ? feature.source : undefined;
      if (id === undefined || id === null || !source) return null;
      const layerId = typeof feature.layer?.id === 'string' ? feature.layer.id : undefined;
      const sourceLayer = typeof feature.sourceLayer === 'string' ? feature.sourceLayer : undefined;
      return { source, id, layerId, sourceLayer };
    },
    [interaction],
  );

  const [searchText, setSearchText] = useAtom(mapSearchTextAtom);
  const [searchTargets, setSearchTargets] = useAtom(mapSearchTargetsAtom);
  const setSearchMatches = useSetAtom(mapSearchMatchesAtom);
  const setHoverCandidates = useSetAtom(mapHoverCandidatesAtom);
  const setHoverMatches = useSetAtom(mapHoverMatchesAtom);
  const searchMatches = useAtomValue(mapSearchMatchesAtom);
  const hoverMatches = useAtomValue(mapHoverMatchesAtom);
  const hoveredInteractionFeatures = useAtomValue(mapHoveredFeaturesAtom);
  const selectedMatches = useAtomValue(mapSelectedMatchesAtom);
  const setSelectedMatches = useSetAtom(mapSelectedMatchesAtom);
  const setViewportFeatureIds = useSetAtom(mapViewportFeatureIdsAtom);

  useEffect(() => {
    if (!searchEnabled || !searchConfig?.targetDefinitions) return;
    if (Object.keys(searchTargets).length > 0) return;
    const defaults = Object.fromEntries(
      Object.keys(searchConfig.targetDefinitions).map((targetId) => [targetId, true]),
    );
    setSearchTargets(defaults);
  }, [searchConfig?.targetDefinitions, searchEnabled, searchTargets, setSearchTargets]);

  const dedupeEntries = useCallback((entries: MapHighlightEntry[]) => {
    const map = new Map<string, MapHighlightEntry>();
    entries.forEach((entry) => {
      map.set(buildHighlightKey(entry), entry);
    });
    return Array.from(map.values());
  }, []);

  const applySelectionChange = useCallback(
    (mode: 'replace' | 'toggle' | 'add' | 'clear' | 'box', entries: MapHighlightEntry[]) => {
      if (mode === 'clear') {
        setSelectedMatches([]);
        return;
      }
      if (mode === 'replace') {
        setSelectedMatches(dedupeEntries(entries));
        return;
      }
      if (mode === 'box') {
        setSelectedMatches((prev) => {
          const next = new Map(prev.map((entry) => [buildHighlightKey(entry), entry]));
          entries.forEach((entry) => {
            next.set(buildHighlightKey(entry), entry);
          });
          return Array.from(next.values());
        });
        return;
      }
      setSelectedMatches((prev) => {
        const next = new Map(prev.map((entry) => [buildHighlightKey(entry), entry]));
        entries.forEach((entry) => {
          const key = buildHighlightKey(entry);
          if (mode === 'toggle') {
            if (next.has(key)) {
              next.delete(key);
            } else {
              next.set(key, entry);
            }
          } else {
            next.set(key, entry);
          }
        });
        return Array.from(next.values());
      });
    },
    [dedupeEntries, setSelectedMatches],
  );

  const fitPadding = fitSelectionConfig?.padding ?? 64;
  const fitSearchPadding = searchConfig?.fitPadding ?? 64;

  const visitCoordinates = useCallback(
    (coords: unknown, bounds: Bounds | null): Bounds | null => {
      if (!Array.isArray(coords)) return bounds;
      if (coords.length >= 2 && typeof coords[0] === 'number' && typeof coords[1] === 'number') {
        const [lng, lat] = coords;
        if (!bounds) {
          return { minLng: lng, minLat: lat, maxLng: lng, maxLat: lat };
        }
        return {
          minLng: Math.min(bounds.minLng, lng),
          minLat: Math.min(bounds.minLat, lat),
          maxLng: Math.max(bounds.maxLng, lng),
          maxLat: Math.max(bounds.maxLat, lat),
        };
      }
      return coords.reduce(
        (current, entry) => visitCoordinates(entry, current),
        bounds,
      );
    },
    [],
  );

  const fitToFeatures = useCallback(
    (features: MapLibreGeoJSONFeature[], padding: number) => {
      if (!mapInstance || features.length === 0) return;
      let bounds: Bounds | null = null;
      features.forEach((feature) => {
        const geometry = (feature as { geometry?: { coordinates?: unknown } }).geometry;
        if (!geometry?.coordinates) return;
        bounds = visitCoordinates(geometry.coordinates, bounds);
      });
      if (!bounds) return;
      const resolvedBounds: Bounds = bounds;
      mapInstance.fitBounds(
        [
          [resolvedBounds.minLng, resolvedBounds.minLat],
          [resolvedBounds.maxLng, resolvedBounds.maxLat],
        ],
        { padding },
      );
    },
    [mapInstance, visitCoordinates],
  );

  const handleFitSelection = useCallback(() => {
    if (!mapInstance || selectedMatches.length === 0) return;
    const selectedKeySet = new Set(selectedMatches.map(buildHighlightKey));
    const canvas = mapInstance.getCanvas();
    const queryBounds: [[number, number], [number, number]] = [
      [0, 0],
      [canvas.width, canvas.height],
    ];
    let features: MapLibreGeoJSONFeature[] = [];
    try {
      features = mapInstance.queryRenderedFeatures(queryBounds, { layers: highlightLayerIds }) as MapLibreGeoJSONFeature[];
    } catch (error) {
      console.debug('[ResourceLayerMap] Failed to query selected features', error);
      return;
    }
    const matched = features.filter((feature) => {
      const source = typeof feature.source === 'string' ? feature.source : undefined;
      const id = defaultFeatureIdAccessor(feature);
      if (!source || id === undefined || id === null) return false;
      return selectedKeySet.has(`${source}:${id}`);
    });
    fitToFeatures(matched, fitPadding);
  }, [fitPadding, fitToFeatures, highlightLayerIds, mapInstance, selectedMatches]);

  const {
    runSearch,
    handleSearchClear,
    handleSearchTargetToggle,
  } = useMapFeatureSearch({
    mapInstance: searchEnabled ? mapInstance : null,
    highlightLayerIds,
    searchText,
    searchTargets,
    targetDefinitions: searchConfig?.targetDefinitions ?? {},
    buildHighlightEntry,
    onMatchesChange: (entries) => {
      setSearchMatches(entries);
    },
    onFeaturesChange: (features) => {
      if (searchConfig?.fitOnSearch) {
        fitToFeatures(features, fitSearchPadding);
      }
    },
    setSearchText,
    setSearchTargets: (updater) => setSearchTargets((prev) => updater(prev)),
    onMissingLayers: interaction?.onMissingLayers,
  });

  useMapFeatureHoverCandidates({
    mapInstance: hoverEnabled ? mapInstance : null,
    highlightLayerIds,
    layerPriorityById: highlightLayerPriorityById,
    buildHighlightEntry,
    radius: hoverConfig?.radius,
    onHoverChange: (entries, features) => {
      const candidates = features
        .map((feature) => {
          const entry = buildHighlightEntry(feature);
          if (!entry) return null;
          return { entry, feature };
        })
        .filter((candidate): candidate is { entry: MapHighlightEntry; feature: MapLibreGeoJSONFeature } => Boolean(candidate));
      setHoverCandidates(candidates);
      setHoverMatches(entries);
    },
  });

  useMapFeatureSelectionGestures({
    mapInstance: selectionEnabled ? mapInstance : null,
    highlightLayerIds,
    layerPriorityById: highlightLayerPriorityById,
    buildHighlightEntry,
    radius: selectionConfig?.radius,
    onSelectionChange: applySelectionChange,
  });

  useMapFeatureHighlights({
    mapInstance: interactionEnabled ? mapInstance : null,
    highlightLayerIds,
    searchMatches,
    hoverMatches,
    selectedMatches,
    onViewportLayerIdsChange: interactionEnabled ? setViewportFeatureIds : undefined,
    onMissingLayers: interaction?.onMissingLayers,
  });

  const snackbarFeatures = interactionEnabled ? hoveredInteractionFeatures : (hoveredFeatures ?? []);
  const effectiveSnackbar = interactionEnabled ? (interactionSnackbar ?? snackbar ?? {}) : snackbar;
  const snackbarPosition = effectiveSnackbar?.position ?? 'bottom-center';
  const anchorOrigin = (() => {
    switch (snackbarPosition) {
      case 'top':
        return { vertical: 'top', horizontal: 'center' } as const;
      case 'bottom':
        return { vertical: 'bottom', horizontal: 'center' } as const;
      case 'bottom-center':
        return { vertical: 'bottom', horizontal: 'center' } as const;
      case 'top-left':
        return { vertical: 'top', horizontal: 'left' } as const;
      case 'top-right':
        return { vertical: 'top', horizontal: 'right' } as const;
      case 'bottom-left':
        return { vertical: 'bottom', horizontal: 'left' } as const;
      case 'bottom-right':
        return { vertical: 'bottom', horizontal: 'right' } as const;
      default:
        return { vertical: 'bottom', horizontal: 'center' } as const;
    }
  })();
  const snackbarContentSx = effectiveSnackbar?.contentSx;
  const snackbarPositionStyle = (() => {
    const base = { position: 'absolute' as const, zIndex: 4 } as const;
    switch (snackbarPosition) {
      case 'top':
        return { ...base, top: 16, left: '50%', transform: 'translateX(-50%)' };
      case 'top-left':
        return { ...base, top: 16, left: 16 };
      case 'top-right':
        return { ...base, top: 16, right: 16 };
      case 'bottom-left':
        return { ...base, bottom: 16, left: 16 };
      case 'bottom-right':
        return { ...base, bottom: 16, right: 16 };
      case 'bottom':
      case 'bottom-center':
      default:
        return { ...base, bottom: 16, left: '50%', transform: 'translateX(-50%)' };
    }
  })();
  const rawSnackbarContent =
    effectiveSnackbar?.content
    ?? effectiveSnackbar?.renderContent?.(snackbarFeatures)
    ?? buildHoverSnackbarContent(snackbarFeatures);
  const snackbarContent = isRenderableNode(rawSnackbarContent) ? rawSnackbarContent : '';
  const snackbarOpen = effectiveSnackbar?.open ?? (snackbarEnabled && snackbarFeatures.length > 0);

  return (
    <Box sx={{ position: 'relative', width: '100%', height: '100%' }}>
      <MapLibreMap
        {...baseMapProps}
        {...mapStyleProps}
        onLoad={handleMapLoad}
        controls={resolvedControls}
      >
        {mapInstance &&
          renderLayerEntries.map((entry) => (
            <VectorTileLayer
              key={entry.layerId}
              map={mapInstance}
              dbName={entry.layer.dbName}
              nodeId={entry.layer.nodeId}
              tiles={entry.layer.tiles}
              tileDataProvider={entry.layer.tileDataProvider}
              onTileRequest={statsActive ? handleTileRequest : undefined}
              layerId={entry.layerId}
              sourceId={entry.sourceId}
              promoteId={entry.layer.promoteId}
              featureState={entry.layer.featureState}
              paint={entry.layerPaint}
              layout={entry.layerConfig.layout}
              filter={entry.layerConfig.filter}
              minzoom={entry.layerConfig.minzoom}
              maxzoom={entry.layerConfig.maxzoom}
              layerType={entry.layerType}
              sourceLayer={entry.layerConfig.sourceLayer}
              visible={entry.layerConfig.visible}
            />
          ))}
      </MapLibreMap>
      {statsActive && statsDisplay === 'overlay' && statsContainer ? (
        createPortal(
          <Box
            sx={{
              position: 'absolute',
              zIndex: 2,
              pointerEvents: 'none',
              ...statsPositionStyle,
            }}
          >
            <MapStatsPanel
              store={statsStore}
              vectorLayerEntries={vectorLayerEntries}
              renderExtra={stats?.renderExtra}
            />
          </Box>,
          statsContainer,
        )
      ) : null}
      {statsActive && statsDisplay === 'floating' && statsWindowOpen ? (
        <FloatingWindow
          title={statsWindowTitle}
          titleIcon={resolvedStatsWindowIcon ?? undefined}
          initialState={statsWindowState}
          onStateChange={setStatsWindowState}
          onClose={() => setStatsWindowState((prev) => ({ ...prev, isVisible: false }))}
          resizable={statsWindowProps.resizable}
          draggable={statsWindowProps.draggable}
          minWidth={statsWindowProps.minWidth}
          minHeight={statsWindowProps.minHeight}
          maxWidth={statsWindowProps.maxWidth}
          maxHeight={statsWindowProps.maxHeight}
        >
          <MapStatsPanel
            store={statsStore}
            vectorLayerEntries={vectorLayerEntries}
            renderExtra={stats?.renderExtra}
            showTitle={false}
          />
        </FloatingWindow>
      ) : null}
      {statsActive && statsDisplay === 'floating' && statsToggleButtonVisible && !statsWindowOpen ? (
        <Box sx={{ position: 'absolute', zIndex: 3, ...resolvedStatsToggleButtonPosition }}>
          <Button
            variant="contained"
            color="primary"
            size="large"
            aria-label="Show data tiles stats"
            onClick={() => setStatsWindowState((prev) => ({ ...prev, isVisible: true }))}
          >
            {resolvedStatsToggleButtonIcon}
          </Button>
        </Box>
      ) : null}
      {searchEnabled && searchConfig?.targetDefinitions ? (
        <>
          <MapPreviewSearchPanel
            searchText={searchText}
            onSearchTextChange={setSearchText}
            onSearch={runSearch}
            onClear={handleSearchClear}
            onOpenSettings={() => setSearchSettingsOpen(true)}
            clearIcon={<CloseIcon fontSize="small" />}
            settingsIcon={<TuneIcon fontSize="small" />}
            showSettingsButton={searchConfig.showSettings ?? Boolean(searchConfig.targetGroups?.length)}
            placeholder={searchConfig.placeholder}
            showFitScreenButton={false}
          />
          {searchConfig.targetGroups ? (
            <MapPreviewSearchSettingsDialog
              open={searchSettingsOpen}
              searchTargets={searchTargets as Record<string, boolean>}
              targetGroups={searchConfig.targetGroups}
              targetDefinitions={searchConfig.targetDefinitions}
              onClose={() => setSearchSettingsOpen(false)}
              onToggleTarget={(targetId) => handleSearchTargetToggle(targetId)}
            />
          ) : null}
        </>
      ) : null}
      {fitSelectionEnabled && fitControlContainer ? (
        createPortal(
          <IconButton
            aria-label="Fit selection"
            onClick={handleFitSelection}
            disabled={selectedMatches.length === 0}
            data-variant="compound"
            sx={{
              width: 29,
              height: 48,
              minWidth: 29,
              minHeight: 48,
              p: 0,
              pr: 0.5,
              m: 0,
              borderRadius: 0,
              bgcolor: 'background.paper',
              color: (theme) =>
                theme.palette.mode === 'dark' ? theme.palette.grey[300] : theme.palette.text.primary,
              '& .MuiSvgIcon-root': { color: 'inherit' },
              '&.Mui-disabled': {
                color: (theme) =>
                  theme.palette.mode === 'dark'
                    ? theme.palette.grey[600]
                    : theme.palette.action.disabled,
              },
              '&:hover': { bgcolor: 'action.hover' },
            }}
          >
            <FitScreenIcon fontSize="small" />
          </IconButton>,
          fitControlContainer,
        )
      ) : null}
      {effectiveSnackbar && (
        <Snackbar
          open={snackbarOpen}
          autoHideDuration={effectiveSnackbar.autoHideDuration ?? null}
          message={snackbarContent}
          anchorOrigin={anchorOrigin}
          ContentProps={snackbarContentSx ? { sx: snackbarContentSx } : undefined}
          sx={snackbarPositionStyle}
        />
      )}
    </Box>
  );
};
