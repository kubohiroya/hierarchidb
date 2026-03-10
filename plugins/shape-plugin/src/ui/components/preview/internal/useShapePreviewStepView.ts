import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type {
  MapAttributionItem,
  MapViewState,
  ResourceGeoJsonLayer,
  ResourceVectorLayer,
  ResolvedLayerSetEntry,
} from '@hierarchidb/ui-map';
import type { MapLibreGeoJSONFeature } from '@hierarchidb/ui-map';
import {
  buildShapeLayerEntryId,
  formatAdminLevelLabel,
  getLayerSetDefinition,
  resolveLayerSetEntries,
} from '@hierarchidb/ui-map';
import {
  loadTreeConsoleSettings,
  TREE_CONSOLE_ZOOM_BAND_MAX_ZOOM,
  TREE_CONSOLE_ZOOM_BAND_MIN_ZOOM,
} from '@hierarchidb/util';
import {
  ensureIso3166Data,
  getCountry,
} from '@hierarchidb/gen-iso3166-2/browser';
import { getDataSourceConfig } from '~/services/utils/shapeBuildUtils';
import type { ShapeEntity } from '~/common/types/index';
import { useShapePreviewStep } from '~/ui/components/preview/useShapePreviewStep';

const resolveCommonZoomBounds = () => {
  const settings = loadTreeConsoleSettings();
  const boundaries = Array.isArray(settings.zoomBandBoundaries)
    ? settings.zoomBandBoundaries.filter((value) => typeof value === 'number' && Number.isFinite(value))
    : [];
  if (boundaries.length === 0) {
    return {
      minZoom: TREE_CONSOLE_ZOOM_BAND_MIN_ZOOM,
      maxZoom: TREE_CONSOLE_ZOOM_BAND_MAX_ZOOM,
    };
  }
  const sorted = [...boundaries].sort((a, b) => a - b);
  const minZoom = sorted[0] ?? TREE_CONSOLE_ZOOM_BAND_MIN_ZOOM;
  const maxZoom = sorted[sorted.length - 1] ?? TREE_CONSOLE_ZOOM_BAND_MAX_ZOOM;
  return {
    minZoom,
    maxZoom: Math.max(minZoom, maxZoom),
  };
};

const resolveCountryFlag = (countryCode?: string): string | undefined => {
  if (!countryCode || countryCode.length !== 2) return undefined;
  const normalized = countryCode.toUpperCase();
  if (!/^[A-Z]{2}$/.test(normalized)) return undefined;
  const base = 0x1f1e6;
  const codes = Array.from(normalized).map((char) => base + char.charCodeAt(0) - 65);
  return String.fromCodePoint(...codes);
};

const resolveIso3166CsvUrl = (): string => {
  const meta = (typeof import.meta !== 'undefined'
    ? (import.meta as { env?: { BASE_URL?: string; VITE_BASE_URL?: string } })
    : null);
  const envBase = meta?.env?.VITE_BASE_URL || meta?.env?.BASE_URL || '/';
  const normalizedBase = envBase.endsWith('/') ? envBase : `${envBase}/`;
  return `${normalizedBase}iso3166-2-level1.csv`;
};

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

const buildDefaultHoverLabel = (properties: Record<string, unknown>): string | null => {
  const label =
    (properties.name as string | undefined) ??
    (properties.NAME as string | undefined) ??
    (properties.label as string | undefined) ??
    (properties.id as string | number | undefined);
  return label ? String(label) : null;
};

type ShapePreviewLayerGroupId = 'adm0' | 'adm1' | 'adm2';

type ShapePreviewLayerDetailId =
  | 'adm0Boundary'
  | 'adm0Fill'
  | 'adm1Boundary'
  | 'adm1Fill'
  | 'adm2Boundary'
  | 'adm2Fill';

export type ShapePreviewLayerToggleId = ShapePreviewLayerGroupId | ShapePreviewLayerDetailId;

type ShapePreviewLayerVisibility = Record<ShapePreviewLayerToggleId, boolean>;
type ShapePreviewLayerFeatureCounts = Record<ShapePreviewLayerToggleId, number>;

export type ShapePreviewLayerToggleItem = {
  id: ShapePreviewLayerToggleId;
  label: string;
};

const SHAPE_PREVIEW_LAYER_VISIBILITY_DEFAULT: ShapePreviewLayerVisibility = {
  adm0: true,
  adm0Boundary: true,
  adm0Fill: true,
  adm1: true,
  adm1Boundary: true,
  adm1Fill: true,
  adm2: true,
  adm2Boundary: true,
  adm2Fill: true,
};

const SHAPE_PREVIEW_LAYER_FEATURE_COUNTS_DEFAULT: ShapePreviewLayerFeatureCounts = {
  adm0: 0,
  adm0Boundary: 0,
  adm0Fill: 0,
  adm1: 0,
  adm1Boundary: 0,
  adm1Fill: 0,
  adm2: 0,
  adm2Boundary: 0,
  adm2Fill: 0,
};

const SHAPE_PREVIEW_DETAIL_TOGGLE_IDS: ShapePreviewLayerDetailId[] = [
  'adm0Boundary',
  'adm0Fill',
  'adm1Boundary',
  'adm1Fill',
  'adm2Boundary',
  'adm2Fill',
];

const SHAPE_LAYER_VISIBILITY_KEYS_BY_LEVEL: Record<number, {
  group: ShapePreviewLayerGroupId;
  boundary: ShapePreviewLayerDetailId;
  fill: ShapePreviewLayerDetailId;
}> = {
  0: { group: 'adm0', boundary: 'adm0Boundary', fill: 'adm0Fill' },
  1: { group: 'adm1', boundary: 'adm1Boundary', fill: 'adm1Fill' },
  2: { group: 'adm2', boundary: 'adm2Boundary', fill: 'adm2Fill' },
};

const isResolvedLayerEntryVisible = (
  entry: ResolvedLayerSetEntry,
  visibility: ShapePreviewLayerVisibility,
): boolean => {
  if (typeof entry.adminLevel !== 'number') return true;
  const keys = SHAPE_LAYER_VISIBILITY_KEYS_BY_LEVEL[entry.adminLevel];
  if (!keys) return true;
  const detailKey = (entry.boundary === true || entry.layerType === 'line') ? keys.boundary : keys.fill;
  return visibility[keys.group] && visibility[detailKey];
};

const areShapePreviewLayerFeatureCountsEqual = (
  current: ShapePreviewLayerFeatureCounts,
  next: ShapePreviewLayerFeatureCounts,
): boolean => (
  current.adm0 === next.adm0
  && current.adm0Boundary === next.adm0Boundary
  && current.adm0Fill === next.adm0Fill
  && current.adm1 === next.adm1
  && current.adm1Boundary === next.adm1Boundary
  && current.adm1Fill === next.adm1Fill
  && current.adm2 === next.adm2
  && current.adm2Boundary === next.adm2Boundary
  && current.adm2Fill === next.adm2Fill
);

const buildFeatureCountKey = (feature: MapLibreGeoJSONFeature): string => {
  const source = typeof feature.source === 'string' ? feature.source : '';
  const sourceLayer = typeof feature.sourceLayer === 'string' ? feature.sourceLayer : '';
  const id = feature.id;
  if (typeof id === 'string' || typeof id === 'number') {
    return `${source}:${sourceLayer}:id:${String(id)}`;
  }
  const properties = feature.properties ?? {};
  const fallbackId = properties.id ?? properties.featureId ?? properties.shapeID ?? properties.shapeId;
  if (typeof fallbackId === 'string' || typeof fallbackId === 'number') {
    return `${source}:${sourceLayer}:prop:${String(fallbackId)}`;
  }
  const name = typeof properties.name === 'string' ? properties.name : '';
  return `${source}:${sourceLayer}:anon:${name}`;
};

export const useShapePreviewStepView = (
  data: Partial<ShapeEntity>,
  nodeId: string,
) => {
  const preview = useShapePreviewStep(data, nodeId);
  const { minZoom, maxZoom } = useMemo(() => resolveCommonZoomBounds(), []);
  const mapContainerRef = useRef<HTMLDivElement | null>(null);
  const lastZoomRef = useRef<number | null>(null);
  const [zoomSnackbarMessage, setZoomSnackbarMessage] = useState<string>('');
  const [zoomSnackbarOpen, setZoomSnackbarOpen] = useState(false);
  const [countryByCode, setCountryByCode] = useState<Map<string, { name: string; alpha2?: string }>>(new Map());
  const [isoReady, setIsoReady] = useState(false);
  const pendingCountryCodesRef = useRef<Set<string>>(new Set());
  const [mapRenderPending, setMapRenderPending] = useState(false);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      const result = await ensureIso3166Data({ csvUrl: resolveIso3166CsvUrl() });
      if (cancelled) return;
      setIsoReady(result.source !== 'none');
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const [shapePreviewLayerVisibility, setShapePreviewLayerVisibility] = useState<ShapePreviewLayerVisibility>(
    () => ({ ...SHAPE_PREVIEW_LAYER_VISIBILITY_DEFAULT }),
  );
  const [shapePreviewLayerFeatureCounts, setShapePreviewLayerFeatureCounts] = useState<ShapePreviewLayerFeatureCounts>(
    () => ({ ...SHAPE_PREVIEW_LAYER_FEATURE_COUNTS_DEFAULT }),
  );

  const toggleShapePreviewLayerVisibility = useCallback((id: ShapePreviewLayerToggleId) => {
    setShapePreviewLayerVisibility((prev) => ({
      ...prev,
      [id]: !prev[id],
    }));
  }, []);

  const handleViewStateChange = useCallback((viewState: MapViewState) => {
    const zoom = Number(viewState.zoom);
    if (!Number.isFinite(zoom)) return;
    const lastZoom = lastZoomRef.current;
    if (lastZoom !== null && Math.abs(lastZoom - zoom) < 0.01) return;
    lastZoomRef.current = zoom;
    setZoomSnackbarMessage(String(preview.t('preview.zoom', 'Zoom: {{zoom}}', { zoom: zoom.toFixed(2) })));
    setZoomSnackbarOpen(true);
  }, [preview.t]);

  const handleZoomSnackbarClose = useCallback(() => {
    setZoomSnackbarOpen(false);
  }, []);

  const queueCountryCode = useCallback((code: string) => {
    const upper = code.toUpperCase();
    if (!upper) return;
    if (countryByCode.has(upper)) return;
    if (pendingCountryCodesRef.current.has(upper)) return;
    pendingCountryCodesRef.current.add(upper);
    getCountry(upper)
      .then((result) => {
        const resolved = result?.country ?? null;
        if (!resolved) return;
        setCountryByCode((prev) => {
          const next = new Map(prev);
          const name = resolved.countryEn;
          const alpha2 = resolved.alpha2;
          if (resolved.alpha2) next.set(resolved.alpha2.toUpperCase(), { name, alpha2 });
          if (resolved.alpha3) next.set(resolved.alpha3.toUpperCase(), { name, alpha2 });
          return next;
        });
      })
      .catch(() => {
        // ignore
      })
      .finally(() => {
        pendingCountryCodesRef.current.delete(upper);
      });
  }, [countryByCode]);

  const buildAdminHoverCandidate = useCallback((properties: Record<string, unknown>) => {
    const level = resolveAdminLevel(properties);
    if (level == null) return null;
    const adminLabel = formatAdminLevelLabel(level);
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
    const countryNameCandidate = pickFirstString(properties, [
      'countryName',
      'country',
      'COUNTRY',
      'COUNTRY_NAME',
      'NAME_0',
      'ADMIN',
      'SOVEREIGNT',
    ]);
    const countryCodeCandidate = pickFirstString(properties, [
      'countryCode',
      'ISO_A2',
      'ISO2',
      'ISO_2',
      'ISO_A3',
      'ADM0_A3',
      'ISO3',
      'shapeISO',
    ]);
    const codeFromName = (!countryCodeCandidate && countryNameCandidate && /^[A-Z]{2,3}$/.test(countryNameCandidate))
      ? countryNameCandidate
      : undefined;
    const countryCode = countryCodeCandidate ?? codeFromName;
    if (isoReady && countryCode) {
      queueCountryCode(countryCode);
    }
    const mappedCountry = countryCode ? countryByCode.get(countryCode.toUpperCase()) : undefined;
    const mappedCountryName = mappedCountry?.name;
    const countryName =
      mappedCountryName ??
      (countryNameCandidate && !/^[A-Z]{2,3}$/.test(countryNameCandidate) ? countryNameCandidate : undefined);
    const flag = resolveCountryFlag(mappedCountry?.alpha2 ?? countryCode);
    const countryLabel = countryName
      ? `${flag ? `${flag} ` : ''}${countryName}`
      : countryCode
        ? `${flag ? `${flag} ` : ''}${countryCode}`
        : 'Unknown';

    if (level <= 0) {
      return { level, label: `${adminLabel}: ${countryLabel}` };
    }
    if (level === 1) {
      const admin1 = adminName ?? countryName ?? 'Unknown';
      return { level, label: `${adminLabel}: ${admin1} / ${countryLabel}` };
    }
    const admin2 = adminName ?? 'Unknown';
    const admin1 = pickFirstString(properties, [
      'admin1Name',
      'NAME_1',
      'name_1',
      'ADM1_NAME',
      'admin1',
    ]);
    const parts = [admin2, admin1, countryLabel].filter(
      (part): part is string => Boolean(part && part.trim().length > 0),
    );
    return { level, label: `${adminLabel}: ${parts.join(' / ')}` };
  }, [countryByCode, isoReady, queueCountryCode]);

  const hoverSnackbarContent = useCallback((features: MapLibreGeoJSONFeature[]) => {
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
  }, [buildAdminHoverCandidate]);

  useEffect(() => {
    if (!isoReady) return;
    preview.featureListRows.forEach((row) => {
      const code = row.countryCode
        ?? (row.countryName && /^[A-Z]{2,3}$/.test(row.countryName) ? row.countryName : undefined);
      if (code) queueCountryCode(code);
    });
  }, [isoReady, preview.featureListRows, queueCountryCode]);

  const featureListRowsWithFlags = useMemo(() => {
    if (!preview.featureListRows.length) return preview.featureListRows;
    return preview.featureListRows.map((row) => {
      const code = row.countryCode
        ?? (row.countryName && /^[A-Z]{2,3}$/.test(row.countryName) ? row.countryName : undefined);
      const mapped = code ? countryByCode.get(code.toUpperCase()) : undefined;
      const name = mapped?.name
        ?? (row.countryName && !/^[A-Z]{2,3}$/.test(row.countryName) ? row.countryName : undefined)
        ?? '';
      const flag = resolveCountryFlag(mapped?.alpha2 ?? code);
      const countryName = name
        ? `${flag ? `${flag} ` : ''}${name}`
        : row.countryName ?? '';
      return {
        ...row,
        countryName,
      };
    });
  }, [countryByCode, preview.featureListRows]);

  const displayedFeatureRowsWithFlags = useMemo(() => {
    if (!preview.displayedFeatureRows.length) return preview.displayedFeatureRows;
    return preview.displayedFeatureRows.map((row) => {
      const code = row.countryCode
        ?? (row.countryName && /^[A-Z]{2,3}$/.test(row.countryName) ? row.countryName : undefined);
      const mapped = code ? countryByCode.get(code.toUpperCase()) : undefined;
      const name = mapped?.name
        ?? (row.countryName && !/^[A-Z]{2,3}$/.test(row.countryName) ? row.countryName : undefined)
        ?? '';
      const flag = resolveCountryFlag(mapped?.alpha2 ?? code);
      const countryName = name
        ? `${flag ? `${flag} ` : ''}${name}`
        : row.countryName ?? '';
      return {
        ...row,
        countryName,
      };
    });
  }, [countryByCode, preview.displayedFeatureRows]);

  const layerSetName = data.buildConfig?.tileEmitConfig?.layerSetName ?? 'shape';
  const layerSetDefinition = useMemo(
    () => getLayerSetDefinition(layerSetName),
    [layerSetName],
  );

  const resolvedLayerSetEntries = useMemo<ResolvedLayerSetEntry[]>(() => {
    if (!layerSetDefinition) return [];
    return resolveLayerSetEntries(
      preview.tileLayerNames ?? [],
      layerSetDefinition,
      { allowedAdminLevels: preview.shapeLayerAdminLevels },
    );
  }, [layerSetDefinition, preview.tileLayerNames, preview.shapeLayerAdminLevels]);

  const shapePreviewLayerToggleItems = useMemo<ShapePreviewLayerToggleItem[]>(
    () => [
      { id: 'adm0', label: preview.t('preview.layerSets.adm0', formatAdminLevelLabel(0)) },
      {
        id: 'adm0Boundary',
        label: preview.t('preview.layerSets.adm0Boundary', `${formatAdminLevelLabel(0)} Boundary`),
      },
      {
        id: 'adm0Fill',
        label: preview.t('preview.layerSets.adm0Fill', `${formatAdminLevelLabel(0)} Fill`),
      },
      { id: 'adm1', label: preview.t('preview.layerSets.adm1', formatAdminLevelLabel(1)) },
      {
        id: 'adm1Boundary',
        label: preview.t('preview.layerSets.adm1Boundary', `${formatAdminLevelLabel(1)} Boundary`),
      },
      {
        id: 'adm1Fill',
        label: preview.t('preview.layerSets.adm1Fill', `${formatAdminLevelLabel(1)} Fill`),
      },
      { id: 'adm2', label: preview.t('preview.layerSets.adm2', formatAdminLevelLabel(2)) },
      {
        id: 'adm2Boundary',
        label: preview.t('preview.layerSets.adm2Boundary', `${formatAdminLevelLabel(2)} Boundary`),
      },
      {
        id: 'adm2Fill',
        label: preview.t('preview.layerSets.adm2Fill', `${formatAdminLevelLabel(2)} Fill`),
      },
    ],
    [preview.t],
  );

  const vectorLayers = useMemo<ResourceVectorLayer[]>(() => {
    if (!preview.nodeId || !layerSetDefinition) return [];
    const hasRemoteTiles = Boolean(preview.tilesUrl);
    const tiles = hasRemoteTiles ? [preview.tilesUrl] : undefined;
    const baseLayer = {
      nodeId: String(preview.nodeId),
      nodeType: 'shape' as const,
      tiles,
      dbName: !hasRemoteTiles ? preview.tileDbName : undefined,
      tileDataProvider: !hasRemoteTiles ? preview.tileDataProvider : undefined,
      promoteId: 'id',
      layerSetId: layerSetDefinition.id,
    };
    const fillPaint = {
      'fill-color': preview.theme.palette.primary.main,
      'fill-opacity': 0.35,
      'fill-outline-color': preview.theme.palette.primary.dark,
    };
    const linePaint = {
      'line-color': preview.theme.palette.primary.dark,
      'line-opacity': 0.7,
      'line-width': 1.5,
    };
    return resolvedLayerSetEntries
      .filter((entry) => isResolvedLayerEntryVisible(entry, shapePreviewLayerVisibility))
      .filter((entry): entry is ResolvedLayerSetEntry & { sourceLayer: string } =>
        typeof entry.sourceLayer === 'string' && entry.sourceLayer.length > 0)
      .map((entry) => ({
        ...baseLayer,
        layerPriority: entry.priority,
        hierarchyLevel: entry.hierarchyLevel,
        layerLabel: entry.label,
        layerConfig: {
          layerId: `${preview.baseLayerId}-${entry.id}`,
          sourceId: `${preview.baseSourceId}-${entry.id}`,
          sourceLayer: entry.sourceLayer,
          layerType: entry.layerType,
          paint: entry.layerType === 'line' ? linePaint : fillPaint,
        },
      }));
  }, [
    layerSetDefinition,
    preview.baseLayerId,
    preview.baseSourceId,
    preview.nodeId,
    preview.theme.palette.primary.dark,
    preview.theme.palette.primary.main,
    preview.tileDataProvider,
    preview.tileDbName,
    preview.tilesUrl,
    resolvedLayerSetEntries,
    shapePreviewLayerVisibility,
  ]);

  const vectorLayerIds = useMemo(
    () => vectorLayers.map((layer) => layer.layerConfig?.layerId ?? `resource-layer-${layer.nodeId}`),
    [vectorLayers],
  );
  const shapePreviewLayerSourceIds = useMemo(
    () => new Set(
      vectorLayers
        .map((layer) => layer.layerConfig?.sourceId)
        .filter((sourceId): sourceId is string => Boolean(sourceId)),
    ),
    [vectorLayers],
  );
  const refreshCountsTimeoutRef = useRef<number | null>(null);
  const sourceLoadStateRef = useRef<Map<string, boolean>>(new Map());

  const visibleLayerIdsByDetail = useMemo(() => {
    const map = new Map<ShapePreviewLayerDetailId, string[]>();
    SHAPE_PREVIEW_DETAIL_TOGGLE_IDS.forEach((detailId) => {
      map.set(detailId, []);
    });
    resolvedLayerSetEntries
      .filter((entry): entry is ResolvedLayerSetEntry & { sourceLayer: string } =>
        typeof entry.sourceLayer === 'string' && entry.sourceLayer.length > 0,
      )
      .forEach((entry) => {
      if (typeof entry.adminLevel !== 'number') return;
      const keys = SHAPE_LAYER_VISIBILITY_KEYS_BY_LEVEL[entry.adminLevel];
      if (!keys) return;
      const detailId = (entry.boundary === true || entry.layerType === 'line') ? keys.boundary : keys.fill;
      const layerId = `${preview.baseLayerId}-${entry.id}`;
      const existing = map.get(detailId);
      if (!existing) return;
      existing.push(layerId);
    });
    return map;
  }, [resolvedLayerSetEntries, preview.baseLayerId, shapePreviewLayerVisibility]);

  const visibleLayerIdsForCounts = useMemo(() => {
    const ids: string[] = [];
    const seen = new Set<string>();
    visibleLayerIdsByDetail.forEach((layerIds) => {
      layerIds.forEach((layerId) => {
        if (seen.has(layerId)) return;
        seen.add(layerId);
        ids.push(layerId);
      });
    });
    return ids;
  }, [visibleLayerIdsByDetail]);

  const detailIdsByLayerId = useMemo(() => {
    const map = new Map<string, ShapePreviewLayerDetailId[]>();
    visibleLayerIdsByDetail.forEach((layerIds, detailId) => {
      layerIds.forEach((layerId) => {
        const current = map.get(layerId);
        if (current) {
          current.push(detailId);
          return;
        }
        map.set(layerId, [detailId]);
      });
    });
    return map;
  }, [visibleLayerIdsByDetail]);

  const refreshShapePreviewLayerFeatureCounts = useCallback(() => {
    const map = preview.mapInstance;
    if (!map || !map.isStyleLoaded()) {
      setShapePreviewLayerFeatureCounts((current) => (
        areShapePreviewLayerFeatureCountsEqual(current, SHAPE_PREVIEW_LAYER_FEATURE_COUNTS_DEFAULT)
          ? current
          : { ...SHAPE_PREVIEW_LAYER_FEATURE_COUNTS_DEFAULT }
      ));
      return;
    }

    const layerIdsByDetail = new Map<ShapePreviewLayerDetailId, Set<string>>();
    const detailIdByLayerId = detailIdsByLayerId;
    const layerIdsForQuery = visibleLayerIdsForCounts.filter((layerId) => map.getLayer(layerId));
    SHAPE_PREVIEW_DETAIL_TOGGLE_IDS.forEach((detailId) => {
      layerIdsByDetail.set(detailId, new Set());
    });
    if (layerIdsForQuery.length === 0) {
      setShapePreviewLayerFeatureCounts((current) => (
        areShapePreviewLayerFeatureCountsEqual(current, SHAPE_PREVIEW_LAYER_FEATURE_COUNTS_DEFAULT)
          ? current
          : { ...SHAPE_PREVIEW_LAYER_FEATURE_COUNTS_DEFAULT }
      ));
      return;
    }

    let features: MapLibreGeoJSONFeature[] = [];
    try {
      features = map.queryRenderedFeatures(undefined, { layers: layerIdsForQuery });
    } catch {
      // ignore map query errors during style transitions
      features = [];
    }

    features.forEach((feature) => {
      const layerId = feature.layer?.id;
      if (!layerId) return;
      const detailIds = detailIdByLayerId.get(layerId);
      if (!detailIds || detailIds.length === 0) return;
      const key = buildFeatureCountKey(feature);
      detailIds.forEach((detailId) => {
        const next = layerIdsByDetail.get(detailId);
        if (next) {
          next.add(key);
        }
      });
    });

    const adm0BoundaryFeatures = layerIdsByDetail.get('adm0Boundary') ?? new Set<string>();
    const adm0FillFeatures = layerIdsByDetail.get('adm0Fill') ?? new Set<string>();
    const adm1BoundaryFeatures = layerIdsByDetail.get('adm1Boundary') ?? new Set<string>();
    const adm1FillFeatures = layerIdsByDetail.get('adm1Fill') ?? new Set<string>();
    const adm2BoundaryFeatures = layerIdsByDetail.get('adm2Boundary') ?? new Set<string>();
    const adm2FillFeatures = layerIdsByDetail.get('adm2Fill') ?? new Set<string>();
    const adm0Features = new Set<string>([
      ...adm0BoundaryFeatures,
      ...adm0FillFeatures,
    ]);
    const adm1Features = new Set<string>([
      ...adm1BoundaryFeatures,
      ...adm1FillFeatures,
    ]);
    const adm2Features = new Set<string>([
      ...adm2BoundaryFeatures,
      ...adm2FillFeatures,
    ]);

    const nextCounts: ShapePreviewLayerFeatureCounts = {
      adm0: adm0Features.size,
      adm0Boundary: adm0BoundaryFeatures.size,
      adm0Fill: adm0FillFeatures.size,
      adm1: adm1Features.size,
      adm1Boundary: adm1BoundaryFeatures.size,
      adm1Fill: adm1FillFeatures.size,
      adm2: adm2Features.size,
      adm2Boundary: adm2BoundaryFeatures.size,
      adm2Fill: adm2FillFeatures.size,
    };

    setShapePreviewLayerFeatureCounts((current) => (
      areShapePreviewLayerFeatureCountsEqual(current, nextCounts) ? current : nextCounts
    ));
  }, [
    detailIdsByLayerId,
    preview.mapInstance,
    visibleLayerIdsForCounts,
  ]);

  const scheduleRefreshShapePreviewLayerFeatureCounts = useCallback(() => {
    if (refreshCountsTimeoutRef.current !== null) {
      return;
    }

    refreshCountsTimeoutRef.current = window.setTimeout(() => {
      refreshCountsTimeoutRef.current = null;
      refreshShapePreviewLayerFeatureCounts();
    }, 250);
  }, [refreshShapePreviewLayerFeatureCounts]);

  useEffect(() => () => {
    if (refreshCountsTimeoutRef.current !== null) {
      window.clearTimeout(refreshCountsTimeoutRef.current);
      refreshCountsTimeoutRef.current = null;
    }
  }, []);

  useEffect(() => {
    const map = preview.mapInstance;
    if (!map || !preview.nodeId || vectorLayerIds.length === 0) {
      setMapRenderPending(false);
      return;
    }
    setMapRenderPending(true);
    const handleIdle = () => {
      setMapRenderPending(false);
    };
    map.on('idle', handleIdle);
    return () => {
      map.off('idle', handleIdle);
    };
  }, [preview.mapInstance, preview.nodeId, vectorLayerIds]);

  useEffect(() => {
    scheduleRefreshShapePreviewLayerFeatureCounts();
  }, [
    scheduleRefreshShapePreviewLayerFeatureCounts,
    visibleLayerIdsForCounts,
    shapePreviewLayerSourceIds,
  ]);

  useEffect(() => {
    sourceLoadStateRef.current.forEach((_loaded, sourceId) => {
      if (!shapePreviewLayerSourceIds.has(sourceId)) {
        sourceLoadStateRef.current.delete(sourceId);
      }
    });
    shapePreviewLayerSourceIds.forEach((sourceId) => {
      if (!sourceLoadStateRef.current.has(sourceId)) {
        sourceLoadStateRef.current.set(sourceId, false);
      }
    });
  }, [shapePreviewLayerSourceIds]);

  useEffect(() => {
    const map = preview.mapInstance;
    if (!map) return;
  const handleRefresh = () => {
      scheduleRefreshShapePreviewLayerFeatureCounts();
    };
    const handleSourceData = (...args: unknown[]) => {
      const event = args[0] as
        | {
            sourceId?: string;
            dataType?: string;
            sourceDataType?: string;
            isSourceLoaded?: boolean;
            tile?: unknown;
          }
        | undefined;
      if (!event) return;
      if (typeof event.sourceId !== 'string') return;
      if (!shapePreviewLayerSourceIds.has(event.sourceId)) return;
      if (event.dataType !== 'source') return;
      if (Object.prototype.hasOwnProperty.call(event, 'tile')) return;

      const sourceId = event.sourceId;
      if (event.isSourceLoaded === false) {
        sourceLoadStateRef.current.set(sourceId, false);
        return;
      }
      if (event.isSourceLoaded !== true) return;

      const alreadyHandled = sourceLoadStateRef.current.get(sourceId) === true;
      if (alreadyHandled) return;

      sourceLoadStateRef.current.set(sourceId, true);
      handleRefresh();
    };
    map.on('moveend', handleRefresh);
    map.on('sourcedata', handleSourceData);
    return () => {
      map.off('moveend', handleRefresh);
      map.off('sourcedata', handleSourceData);
    };
  }, [preview.mapInstance, scheduleRefreshShapePreviewLayerFeatureCounts, shapePreviewLayerSourceIds]);

  const resolvedLayerNames = useMemo(() => {
    const tileLayerNames = preview.tileLayerNames ?? [];
    const lookup = new Map(resolvedLayerSetEntries.map((entry) => [entry.id, entry]));
    const admin0Boundary = lookup.get(buildShapeLayerEntryId(0, true));
    const admin0Fill = lookup.get(buildShapeLayerEntryId(0, false));
    const admin1Boundary = lookup.get(buildShapeLayerEntryId(1, true));
    const admin1Fill = lookup.get(buildShapeLayerEntryId(1, false));
    return {
      available: tileLayerNames,
      admin0: admin0Fill?.sourceLayer ?? admin0Boundary?.sourceLayer ?? null,
      admin1: admin1Fill?.sourceLayer ?? admin1Boundary?.sourceLayer ?? null,
      admin0IsBoundary: Boolean(admin0Boundary?.sourceLayer) && admin0Boundary?.sourceLayer !== admin0Fill?.sourceLayer,
      admin1IsBoundary: Boolean(admin1Boundary?.sourceLayer) && admin1Boundary?.sourceLayer !== admin1Fill?.sourceLayer,
    };
  }, [preview.tileLayerNames, resolvedLayerSetEntries]);

  const highlightOverridesByType = useMemo(() => {
    const hasSearch = ['boolean', ['feature-state', 'hdbSearch'], false];
    const hasHover = ['boolean', ['feature-state', 'hdbHover'], false];
    const hasSelected = ['boolean', ['feature-state', 'hdbSelected'], false];
    const baseFill = preview.theme.palette.primary.main;
    const baseOutline = preview.theme.palette.primary.dark;
    return {
      fill: {
        'fill-color': ['case', hasSelected, preview.theme.palette.primary.main, hasHover, preview.theme.palette.primary.light, hasSearch, preview.theme.palette.secondary.light, baseFill],
        'fill-outline-color': ['case', hasSelected, preview.theme.palette.primary.dark, hasHover, preview.theme.palette.primary.main, hasSearch, preview.theme.palette.secondary.main, baseOutline],
        'fill-opacity': [
          'case',
          hasSelected,
          0.6,
          hasHover,
          0.5,
          hasSearch,
          0.45,
          0.35,
        ],
      },
      line: {
        'line-color': ['case', hasSelected, preview.theme.palette.primary.main, hasHover, preview.theme.palette.primary.light, hasSearch, preview.theme.palette.secondary.light, baseOutline],
        'line-opacity': [
          'case',
          hasSelected,
          0.9,
          hasHover,
          0.8,
          hasSearch,
          0.7,
          0.6,
        ],
        'line-width': [
          'case',
          hasSelected,
          3,
          hasHover,
          2.5,
          hasSearch,
          2,
          1.5,
        ],
      },
    };
  }, [
    preview.theme.palette.primary.dark,
    preview.theme.palette.primary.light,
    preview.theme.palette.primary.main,
    preview.theme.palette.secondary.light,
    preview.theme.palette.secondary.main,
  ]);

  const attributionItems = useMemo<MapAttributionItem[]>(() => {
    if (!preview.selectionDataSource) return [];
    const config = getDataSourceConfig(preview.selectionDataSource);
    if (!config) return [];
    return [{
      id: `shape:${config.name}`,
      label: config.displayName ?? config.name,
      attribution: config.attribution,
      license: config.license,
      licenseUrl: config.licenseUrl,
    }];
  }, [preview.selectionDataSource]);

  const geoJsonLayers = useMemo<ResourceGeoJsonLayer[]>(() => {
    if (!preview.errorLineCollection || preview.errorLineCollection.features.length === 0) {
      return [];
    }
    const sourceId = 'shape-geometry-errors';
    const selectedFilter = ['==', ['get', 'selected'], true] as const;
    const unselectedFilter = ['!=', ['get', 'selected'], true] as const;
    const issueKindColor = [
      'case',
      ['has', 'issueKind'],
      [
        'match',
        ['get', 'issueKind'],
        'nonFinite',
        preview.theme.palette.error.dark,
        'invalidGeometry',
        preview.theme.palette.error.main,
        'invalidRing',
        preview.theme.palette.error.main,
        'openRing',
        preview.theme.palette.warning.main,
        'degenerateRing',
        preview.theme.palette.warning.dark,
        'duplicateVertex',
        preview.theme.palette.info.main,
        'smallPolygon',
        preview.theme.palette.secondary.main,
        'droppedPolygon',
        preview.theme.palette.secondary.dark,
        preview.theme.palette.error.main,
      ],
      preview.theme.palette.error.main,
    ] as const;
    return [
      {
        layerId: 'shape-geometry-errors-selected-outline-glow',
        sourceId,
        data: preview.errorLineCollection,
        layerType: 'line',
        paint: {
          'line-color': preview.theme.palette.primary.light,
          'line-width': 6,
          'line-blur': 2,
          'line-opacity': 0.6,
        },
        filter: ['all', ['==', ['get', 'ringRole'], 'outline'], selectedFilter],
      },
      {
        layerId: 'shape-geometry-errors-selected-outline',
        sourceId,
        data: preview.errorLineCollection,
        layerType: 'line',
        paint: {
          'line-color': preview.theme.palette.primary.main,
          'line-width': 3,
        },
        filter: ['all', ['==', ['get', 'ringRole'], 'outline'], selectedFilter],
      },
      {
        layerId: 'shape-geometry-errors-selected-hole-glow',
        sourceId,
        data: preview.errorLineCollection,
        layerType: 'line',
        paint: {
          'line-color': preview.theme.palette.primary.light,
          'line-width': 4,
          'line-blur': 2,
          'line-opacity': 0.5,
          'line-dasharray': ['literal', [2, 2]],
        },
        filter: ['all', ['==', ['get', 'ringRole'], 'hole'], selectedFilter],
      },
      {
        layerId: 'shape-geometry-errors-selected-hole',
        sourceId,
        data: preview.errorLineCollection,
        layerType: 'line',
        paint: {
          'line-color': preview.theme.palette.primary.main,
          'line-width': 2,
          'line-dasharray': ['literal', [2, 2]],
        },
        filter: ['all', ['==', ['get', 'ringRole'], 'hole'], selectedFilter],
      },
      {
        layerId: 'shape-geometry-errors-outline',
        sourceId,
        data: preview.errorLineCollection,
        layerType: 'line',
        paint: {
          'line-color': issueKindColor,
          'line-width': 2,
        },
        filter: ['all', ['==', ['get', 'ringRole'], 'outline'], unselectedFilter],
      },
      {
        layerId: 'shape-geometry-errors-hole',
        sourceId,
        data: preview.errorLineCollection,
        layerType: 'line',
        paint: {
          'line-color': issueKindColor,
          'line-width': 1.5,
          'line-dasharray': ['literal', [2, 2]],
        },
        filter: ['all', ['==', ['get', 'ringRole'], 'hole'], unselectedFilter],
      },
    ];
  }, [
    preview.errorLineCollection,
    preview.theme.palette.error.main,
    preview.theme.palette.error.dark,
    preview.theme.palette.info.main,
    preview.theme.palette.primary.light,
    preview.theme.palette.primary.main,
    preview.theme.palette.secondary.dark,
    preview.theme.palette.secondary.main,
    preview.theme.palette.warning.main,
    preview.theme.palette.warning.dark,
  ]);

  return {
    ...preview,
    featureListRows: featureListRowsWithFlags,
    displayedFeatureRows: displayedFeatureRowsWithFlags,
    minZoom,
    maxZoom,
    mapContainerRef,
    zoomSnackbarMessage,
    zoomSnackbarOpen,
    handleViewStateChange,
    handleZoomSnackbarClose,
    hoverSnackbarContent,
    showMapLoading: mapRenderPending,
    vectorLayers,
    vectorLayerIds,
    tileLayerNames: resolvedLayerNames.available,
    resolvedLayerNames,
    highlightOverridesByType,
    geoJsonLayers,
    attributionItems,
    shapePreviewLayerVisibility,
    shapePreviewLayerFeatureCounts,
    toggleShapePreviewLayerVisibility,
    shapePreviewLayerToggleItems,
  };
};
