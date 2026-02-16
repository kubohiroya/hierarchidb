import { useCallback, useEffect, useMemo, useRef, useState, type MutableRefObject } from 'react';
import { useTheme } from '@mui/material/styles';
import type {
  DataSourceName,
  FetchTaskPayload,
  ShapeEntity,
  ShapePreviewMapView,
} from '../../../common/types/index.js';
import { isShapePreviewMetadataEnabled } from '../../../common/config/previewFlags.js';
import { toNodeId, type NodeId } from '@hierarchidb/core-types';
import { useTranslation } from '../../i18n.js';
import type { ShapeFeatureMetadata, ShapeDataSourceMetadata, ShapeTransformErrorRecord } from '@hierarchidb/shape-api';
import { useAtom, useAtomValue, useSetAtom } from 'jotai';
import {
  shapePreviewSearchAtom,
  shapePreviewMatchedIdsAtom,
  shapePreviewSelectedIdsAtom,
  shapePreviewHoveredIdAtom,
  shapePreviewSelectionContextAtom,
} from '../../atoms/shapePreviewAtoms.ts';
import type {
  MapHighlightEntry,
  MapPreviewErrorSummaryById,
  MapWithVectorTilesProps,
  ResolvedLayerSetEntry,
  ShapePreviewFeatureRow,
} from '@hierarchidb/ui-map';
import type { MapLibreMapInstance } from '@hierarchidb/ui-map';
import {
  buildHighlightKey,
  getLayerSetDefinition,
  mapHoverCandidatesAtom,
  mapHoverMatchesAtom,
  mapSearchMatchesAtom,
  mapSelectedMatchesAtom,
  mapViewportFeatureIdsAtom,
  resolveLayerSetEntries,
  useVectorTilePreviewMetadata,
  useVectorTilePreviewSearch,
  useVectorTilePreviewSelection,
} from '@hierarchidb/ui-map';
import { getDBName } from '@hierarchidb/util';
import { VectorTile } from '@mapbox/vector-tile';
import Pbf from 'pbf';
//import { getShapeDbAPIClient } from '../../../services/batch/ShapeBuildAPIClient.ts';
import { getWorkerClientHook, type WorkerClientRef } from '@hierarchidb/ui-worker-provider';
import { shapeMutationAPIImpl, shapeQueryAPIImpl } from '../../../services/batch/ShapeBuildAPIClient.ts';

type ShapePreviewDraft = Partial<ShapeEntity> & {
  tilesUrl?: string;
  tilesEndpoint?: string;
  tilesLayer?: string;
};

const DEFAULT_VIEW: MapWithVectorTilesProps['initialViewState'] = {
  longitude: 0,
  latitude: 20,
  zoom: 1.5,
};

const DEFAULT_BOUNDS_MARGIN = 0.1;
const MIN_BOUNDS_MARGIN = 0.25;

const normalizeText = (value?: string): string | undefined => {
  if (typeof value !== 'string') return undefined;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : undefined;
};

const normalizeCountryCodeValue = (value?: string): string | undefined => {
  const trimmed = normalizeText(value);
  if (!trimmed) return undefined;
  const upper = trimmed.toUpperCase();
  const dashIndex = upper.indexOf('-');
  if (dashIndex > 0) return upper.slice(0, dashIndex);
  return upper;
};

const toPropString = (value: unknown): string | undefined => {
  if (typeof value === 'string') return normalizeText(value);
  if (typeof value === 'number' && Number.isFinite(value)) return String(value);
  return undefined;
};

const pickFromProps = (properties: Record<string, unknown> | undefined, keys: string[]): string | undefined => {
  if (!properties) return undefined;
  for (const key of keys) {
    const value = toPropString(properties[key]);
    if (value) return value;
  }
  return undefined;
};

const resolveAdminLevelFromProps = (
  properties: Record<string, unknown> | undefined,
  fallback?: number,
): number | undefined => {
  if (properties) {
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
  }
  return fallback;
};

const pickCountryNameFromProps = (properties: Record<string, unknown> | undefined): string | undefined =>
  pickFromProps(properties, ['countryName', 'country', 'COUNTRY', 'COUNTRY_NAME', 'NAME_0', 'ADMIN', 'SOVEREIGNT']);

const pickCountryCodeFromProps = (properties: Record<string, unknown> | undefined): string | undefined =>
  pickFromProps(properties, ['countryCode', 'ISO_A2', 'ISO2', 'ISO_2', 'ISO_A3', 'ADM0_A3', 'ISO3', 'shapeISO']);

const buildFlagEmoji = (countryCode?: string): string | null => {
  if (!countryCode || countryCode.length !== 2) return null;
  const normalized = countryCode.toUpperCase();
  if (!/^[A-Z]{2}$/.test(normalized)) return null;
  const base = 0x1f1e6;
  const first = normalized.charCodeAt(0) - 65;
  const second = normalized.charCodeAt(1) - 65;
  return String.fromCodePoint(base + first, base + second);
};

const pickAdminNameByLevel = (
  properties: Record<string, unknown> | undefined,
  level: number,
): string | undefined => {
  if (level === 2) {
    return pickFromProps(properties, ['admin2Name', 'NAME_2', 'name_2', 'ADM2_NAME', 'admin2', 'name', 'NAME']);
  }
  if (level === 1) {
    return pickFromProps(properties, ['admin1Name', 'NAME_1', 'name_1', 'ADM1_NAME', 'admin1', 'name', 'NAME']);
  }
  return pickFromProps(properties, ['adminName', 'name', 'NAME', 'shapeName']);
};

const buildHoverLabel = (
  row: ShapeDataSourceMetadata,
  properties?: Record<string, unknown>,
): string => {
  const resolvedLevel = resolveAdminLevelFromProps(properties, row.adminLevel);
  const adminLevel = typeof resolvedLevel === 'number' ? resolvedLevel : 0;
  const countryName =
    pickCountryNameFromProps(properties)
    ?? row.countryName
    ?? row.countryCode
    ?? 'Unknown';
  const countryCode = normalizeCountryCodeValue(
    pickCountryCodeFromProps(properties) ?? row.countryCode,
  );
  const normalizedCountryName = normalizeText(countryName);
  const hasCountryName = Boolean(normalizedCountryName) && normalizedCountryName !== 'unknown';
  const flagEmoji = hasCountryName ? buildFlagEmoji(countryCode) : null;
  const countryLabel = flagEmoji ? `${flagEmoji} ${countryName}` : countryName;
  const countrySuffix = countryCode ? ` (${countryCode})` : '';
  if (adminLevel <= 0) {
    return `ADM0: ${countryLabel}${countrySuffix}`;
  }
  if (adminLevel === 1) {
    const admin1 = pickAdminNameByLevel(properties, 1) ?? countryName;
    return `ADM1: ${admin1} / ${countryLabel}${countrySuffix}`;
  }
  if (adminLevel === 2) {
    const admin2 = pickAdminNameByLevel(properties, 2) ?? pickAdminNameByLevel(properties, 1);
    const admin1 = pickAdminNameByLevel(properties, 1);
    const parts = [admin2, admin1, countryLabel].filter((part, index, arr) => {
      if (!part) return false;
      return arr.indexOf(part) === index;
    });
    return `ADM2: ${parts.join(' / ')}${countrySuffix}`;
  }
  const adminName = pickAdminNameByLevel(properties, adminLevel) ?? countryName;
  return `ADM${adminLevel}: ${adminName} / ${countryLabel}${countrySuffix}`;
};

const parseSourceKey = (sourceKey?: string): { countryCode?: string; adminLevel?: number } => {
  const trimmed = normalizeText(sourceKey);
  if (!trimmed) return {};
  const [countryCodeRaw, adminLevelRaw] = trimmed.split(':');
  const adminLevel = adminLevelRaw != null ? Number(adminLevelRaw) : undefined;
  return {
    countryCode: normalizeCountryCodeValue(countryCodeRaw),
    adminLevel: Number.isFinite(adminLevel) ? adminLevel : undefined,
  };
};

const buildLookupKey = (countryCode?: string, adminLevel?: number): string | null => {
  if (!countryCode || adminLevel == null) return null;
  return `${countryCode}:${adminLevel}`;
};


const buildCountryGroupKey = (countryCode?: string): string | null => {
  const normalized = normalizeCountryCodeValue(countryCode);
  if (!normalized) return null;
  return `country:${normalized}`;
};

const resolveAdminNameFromMetadata = (
  row: ShapeFeatureMetadata,
  adminLevel: number | undefined,
  context: { countryName?: string },
): string | undefined => {
  if (adminLevel === 2) {
    return normalizeText(row.admin2Name)
      ?? normalizeText(row.admin1Name)
      ?? normalizeText(row.admin0Name)
      ?? normalizeText(row.countryName)
      ?? normalizeText(context.countryName);
  }
  if (adminLevel === 1) {
    return normalizeText(row.admin1Name)
      ?? normalizeText(row.admin0Name)
      ?? normalizeText(row.countryName)
      ?? normalizeText(context.countryName);
  }
  return normalizeText(row.admin0Name)
    ?? normalizeText(row.countryName)
    ?? normalizeText(context.countryName);
};

const resolveAdminCodeFromMetadata = (
  row: ShapeFeatureMetadata,
  adminLevel: number | undefined,
  context: { countryCode?: string },
): string | undefined => {
  if (adminLevel === 2) {
    return normalizeText(row.admin2Code)
      ?? normalizeText(row.admin1Code)
      ?? normalizeCountryCodeValue(row.admin0Code)
      ?? normalizeCountryCodeValue(row.countryCode)
      ?? normalizeCountryCodeValue(context.countryCode);
  }
  if (adminLevel === 1) {
    return normalizeText(row.admin1Code)
      ?? normalizeCountryCodeValue(row.admin0Code)
      ?? normalizeCountryCodeValue(row.countryCode)
      ?? normalizeCountryCodeValue(context.countryCode);
  }
  return normalizeCountryCodeValue(row.admin0Code)
    ?? normalizeCountryCodeValue(row.countryCode)
    ?? normalizeCountryCodeValue(context.countryCode);
};


const isNumericId = (value?: string): boolean => {
  if (!value) return false;
  return /^[0-9]+$/.test(value);
};

const isRepairIssueKind = (issueKind?: string): boolean => {
  const normalized = normalizeText(issueKind)?.toLowerCase();
  if (!normalized) return false;
  return normalized.endsWith('-repaired');
};

const parseVectorTileLayerNames = (data: ArrayBuffer): string[] => {
  if (!data || data.byteLength === 0) return [];
  try {
    const tile = new VectorTile(new Pbf(new Uint8Array(data)));
    return Object.keys(tile.layers ?? {});
  } catch {
    return [];
  }
};

const fetchTile = async (
  nodeId: string,
  z: number,
  x: number,
  y: number,
): Promise<ArrayBuffer | null> => {
  const data = await shapeQueryAPIImpl.getVectorTile(toNodeId(nodeId), z, x, y);
  if (!data) return null;
  return data.buffer.slice(data.byteOffset, data.byteOffset + data.byteLength);
};

const resolvePersistedViewState = (
  view?: ShapePreviewMapView,
): MapWithVectorTilesProps['initialViewState'] | null => {
  if (!view) return null;
  const { longitude, latitude, zoom } = view;
  if (!Number.isFinite(longitude) || !Number.isFinite(latitude) || !Number.isFinite(zoom)) {
    return null;
  }
  return {
    longitude,
    latitude,
    zoom,
    bearing: 0,
    pitch: 0,
  };
};

export const useShapePreviewStep = (data: Partial<ShapeEntity>, nodeId?: string) => {
  const { t } = useTranslation();
  const theme = useTheme();
  const metadataEnabled = isShapePreviewMetadataEnabled();
  const [searchKeyword, setSearchKeyword] = useAtom(shapePreviewSearchAtom);
  const [matchedIds, setMatchedIds] = useAtom(shapePreviewMatchedIdsAtom);
  const [selectedIds, setSelectedIds] = useAtom(shapePreviewSelectedIdsAtom);
  const [hoveredId, setHoveredId] = useAtom(shapePreviewHoveredIdAtom);
  const [selectionContext, setSelectionContext] = useAtom(shapePreviewSelectionContextAtom);
  const hoverCandidates = useAtomValue(mapHoverCandidatesAtom);
  const [mapInstance, setMapInstance] = useState<MapLibreMapInstance | null>(null);
  const [tileLayerNames, setTileLayerNames] = useState<string[]>([]);
  const tileLayerNamesRef = useRef<Set<string> | null>(null);
  const [featureSearchKeyword, setFeatureSearchKeyword] = useState('');
  const [matchedFeatureIds, setMatchedFeatureIds] = useState<string[]>([]);
  const [selectedFeatureIds, setSelectedFeatureIds] = useState<string[]>([]);
  const setMapSearchMatches = useSetAtom(mapSearchMatchesAtom);
  const setMapSelectedMatches = useSetAtom(mapSelectedMatchesAtom);
  const setMapHoverMatches = useSetAtom(mapHoverMatchesAtom);
  const viewportFeatureIdsByLayer = useAtomValue(mapViewportFeatureIdsAtom);

  const previewDraft = data as ShapePreviewDraft;
  const tilesUrl = previewDraft.tilesUrl ?? previewDraft.tilesEndpoint ?? '';
  const tilesLayer = previewDraft.tilesLayer ?? 'admin0';
  const activeNodeId = nodeId ? toNodeId(String(nodeId)) : null;
  const nodeKey = activeNodeId;
  const processingStatus = data?.processingStatus ?? null;
  const baseLayerId = 'shape-preview';
  const baseSourceId = 'shape-preview-source';
  const layerSetName = data.buildConfig?.vtConfig?.layerSetName ?? 'shape';
  const tileDbName = getDBName('shape');
  const [selectionMetadata, setSelectionMetadata] = useState<FetchTaskPayload[]>([]);
  const workerClientHook = useMemo(() => {
    try {
      return getWorkerClientHook<WorkerClientRef | null>();
    } catch {
      return null;
    }
  }, []);
  const workerClient = workerClientHook ? workerClientHook() : null;
  const selectionMatrix = previewDraft.selectedArrayByCountries;
  const selectionDataSource = previewDraft.buildConfig?.dataSourceName as DataSourceName | undefined;

  const statusForPolling = processingStatus ?? 'processing';
  const shouldPollMetadata = Boolean(activeNodeId)
    && metadataEnabled
    && statusForPolling === 'processing';
  const metadataPollIntervalMs = shouldPollMetadata ? 2000 : undefined;

  useEffect(() => {
    let cancelled = false;
    const run = async () => {
      if (!workerClient || !selectionDataSource || !selectionMatrix || !activeNodeId) {
        setSelectionMetadata([]);
        return;
      }
      try {
        const api = workerClient.getAPI();
        const payloads = await api.generateShapeDownloadTaskPayloadsFromSelection(
          activeNodeId,
          selectionDataSource,
          selectionMatrix,
        );
        if (!cancelled) {
          setSelectionMetadata(payloads as FetchTaskPayload[]);
        }
      } catch (error) {
        if (!cancelled) {
          console.warn('[ShapePreviewStep] failed to generate download task payloads', error);
          setSelectionMetadata([]);
        }
      }
    };
    void run();
    return () => {
      cancelled = true;
    };
  }, [activeNodeId, selectionDataSource, selectionMatrix, workerClient]);

  const loadDataSourceMetadataRows = useCallback(
    (targetNodeId: NodeId) =>
      shapeQueryAPIImpl.listDataSourceMetadata(targetNodeId) as Promise<ShapeDataSourceMetadata[]>,
    [],
  );

  const loadFeatureMetadataRows = useCallback(
    (targetNodeId: NodeId) =>
      shapeQueryAPIImpl.listFeatureMetadata(targetNodeId) as Promise<ShapeFeatureMetadata[]>,
    [],
  );

  const loadTransformErrorRows = useCallback(
    (targetNodeId: NodeId) =>
      shapeQueryAPIImpl.listTransformErrorRecords(targetNodeId) as Promise<ShapeTransformErrorRecord[]>,
    [],
  );

  const {
    metadataRows: rawDataSourceMetadataRows,
    metadataLoading: dataSourceMetadataLoading,
    metadataError: dataSourceMetadataError,
    metadataLoaded: dataSourceMetadataLoaded,
  } = useVectorTilePreviewMetadata(
    metadataEnabled,
    activeNodeId,
    loadDataSourceMetadataRows,
    metadataPollIntervalMs,
  );

  const {
    metadataRows: rawFeatureMetadataRows,
    metadataLoading: featureMetadataLoading,
    metadataError: featureMetadataError,
    metadataLoaded: featureMetadataLoaded,
  } = useVectorTilePreviewMetadata(
    metadataEnabled,
    activeNodeId,
    loadFeatureMetadataRows,
    metadataPollIntervalMs,
  );
  const [featureMetadataOverride, setFeatureMetadataOverride] = useState<ShapeFeatureMetadata[] | null>(null);
  useEffect(() => {
    setFeatureMetadataOverride(null);
  }, [rawFeatureMetadataRows]);

  const {
    metadataRows: rawTransformErrorRows,
    metadataLoading: transformErrorLoading,
    metadataError: transformErrorError,
    metadataLoaded: transformErrorLoaded,
  } = useVectorTilePreviewMetadata(
    metadataEnabled,
    activeNodeId,
    loadTransformErrorRows,
    metadataPollIntervalMs,
  );

  const selectionFilters = useMemo(() => {
    if (selectionMetadata.length === 0) return null;
    const byCode = new Map<string, Set<number>>();
    const byName = new Map<string, Set<number>>();
    selectionMetadata.forEach((entry) => {
      const code = entry.countryCode?.trim().toUpperCase();
      const name = entry.countryName?.trim().toLowerCase();
      const level = entry.adminLevel;
      if (code) {
        const levels = byCode.get(code) ?? new Set<number>();
        if (typeof level === 'number') {
          levels.add(level);
        }
        byCode.set(code, levels);
      }
      if (name) {
        const levels = byName.get(name) ?? new Set<number>();
        if (typeof level === 'number') {
          levels.add(level);
        }
        byName.set(name, levels);
      }
    });
    if (byCode.size === 0 && byName.size === 0) return null;
    return { byCode, byName };
  }, [selectionMetadata]);

  const selectionLookup = useMemo(() => {
    const byCode = new Map<string, FetchTaskPayload>();
    const byName = new Map<string, FetchTaskPayload>();
    selectionMetadata.forEach((entry) => {
      const code = normalizeCountryCodeValue(entry.countryCode);
      const name = normalizeText(entry.countryName)?.toLowerCase();
      if (code) byCode.set(code, entry);
      if (name) byName.set(name, entry);
    });
    return { byCode, byName };
  }, [selectionMetadata]);

  const filteredMetadataRows = useMemo(() => {
    if (!selectionFilters) return rawDataSourceMetadataRows;
    return rawDataSourceMetadataRows.filter((row) => {
      const rowLevel = row.adminLevel;
      const rowCode = row.countryCode?.trim().toUpperCase();
      const rowName = row.countryName?.trim().toLowerCase();
      const matchesFilter = (key: string | undefined, source: Map<string, Set<number>>) => {
        if (!key) return false;
        const levels = source.get(key);
        if (!levels || levels.size === 0) return false;
        if (rowLevel == null) return true;
        return levels.has(rowLevel);
      };
      if (matchesFilter(rowCode, selectionFilters.byCode)) return true;
      return matchesFilter(rowName, selectionFilters.byName);
    });
  }, [rawDataSourceMetadataRows, selectionFilters]);

  const dataSourceMetadataRows = filteredMetadataRows;
  const featureMetadataRows = featureMetadataOverride ?? rawFeatureMetadataRows;
  const transformErrorRows = rawTransformErrorRows;

  const dataSourceMetadataLookup = useMemo(() => {
    const bySourceKey = new Map<string, ShapeDataSourceMetadata>();
    const byCountryName = new Map<string, ShapeDataSourceMetadata>();
    const byCountryCode = new Map<string, ShapeDataSourceMetadata>();
    dataSourceMetadataRows.forEach((row) => {
      const code = normalizeCountryCodeValue(row.countryCode);
      const level = row.adminLevel;
      const name = normalizeText(row.countryName)?.toLowerCase();
      if (code && level != null) {
        bySourceKey.set(`${code}:${level}`, row);
      }
      if (name && level != null) {
        byCountryName.set(`${name}:${level}`, row);
      }
      if (code && level === 0) {
        byCountryCode.set(code, row);
      }
    });
    return { bySourceKey, byCountryName, byCountryCode };
  }, [dataSourceMetadataRows]);

  const resolveSourceContext = useCallback((input: {
    countryCode?: string;
    countryName?: string;
    adminLevel?: number;
    sourceKey?: string;
    dataSource?: string;
  }) => {
    const parsedSourceKey = parseSourceKey(input.sourceKey);
    const candidateAdminLevel = input.adminLevel ?? parsedSourceKey.adminLevel;
    const candidateCode = normalizeCountryCodeValue(input.countryCode) ?? parsedSourceKey.countryCode;
    const candidateNameInput = normalizeText(input.countryName);
    const selectionByCode = candidateCode ? selectionLookup.byCode.get(candidateCode) : undefined;
    const selectionByName = candidateNameInput
      ? selectionLookup.byName.get(candidateNameInput.toLowerCase())
      : undefined;
    const candidateName = candidateNameInput
      ?? normalizeText(selectionByCode?.countryName)
      ?? normalizeText(selectionByName?.countryName);
    const lookupKey = buildLookupKey(candidateCode, candidateAdminLevel);
    const sourceByKey = lookupKey ? dataSourceMetadataLookup.bySourceKey.get(lookupKey) : undefined;
    const sourceByName = candidateName && candidateAdminLevel != null
      ? dataSourceMetadataLookup.byCountryName.get(`${candidateName.toLowerCase()}:${candidateAdminLevel}`)
      : undefined;
    const sourceByCode = candidateCode ? dataSourceMetadataLookup.byCountryCode.get(candidateCode) : undefined;
    const sourceRow = sourceByKey ?? sourceByName ?? sourceByCode;
    const countryCode = normalizeCountryCodeValue(sourceRow?.countryCode)
      ?? candidateCode
      ?? normalizeCountryCodeValue(selectionByCode?.countryCode)
      ?? normalizeCountryCodeValue(selectionByName?.countryCode);
    const countryName = normalizeText(sourceRow?.countryName) ?? candidateName ?? candidateNameInput;
    const adminLevel = sourceRow?.adminLevel ?? candidateAdminLevel;
    const dataSource = sourceRow?.dataSource ?? input.dataSource ?? selectionDataSource;
    return {
      countryCode,
      countryName,
      adminLevel,
      dataSource,
      sourceKey: parsedSourceKey.countryCode && parsedSourceKey.adminLevel != null
        ? `${parsedSourceKey.countryCode}:${parsedSourceKey.adminLevel}`
        : input.sourceKey,
    };
  }, [selectionDataSource, selectionLookup.byCode, selectionLookup.byName, dataSourceMetadataLookup]);

  const updateBounds = useCallback(
    (bounds: { minLng: number; minLat: number; maxLng: number; maxLat: number } | null, lng: number, lat: number) => {
      if (!bounds) {
        return { minLng: lng, minLat: lat, maxLng: lng, maxLat: lat };
      }
      return {
        minLng: Math.min(bounds.minLng, lng),
        minLat: Math.min(bounds.minLat, lat),
        maxLng: Math.max(bounds.maxLng, lng),
        maxLat: Math.max(bounds.maxLat, lat),
      };
    },
    [],
  );

  const visitCoordinates = useCallback(
    (coords: unknown, bounds: { minLng: number; minLat: number; maxLng: number; maxLat: number } | null) => {
      if (!Array.isArray(coords)) return bounds;
      if (coords.length >= 2 && typeof coords[0] === 'number' && typeof coords[1] === 'number') {
        return updateBounds(bounds, coords[0], coords[1]);
      }
      return coords.reduce(
        (current, entry) => visitCoordinates(entry, current),
        bounds,
      );
    },
    [updateBounds],
  );

  const finalizeBounds = useCallback(
    (bounds: { minLng: number; minLat: number; maxLng: number; maxLat: number } | null) => {
      if (!bounds) return null;
      const lngPadding = Math.max((bounds.maxLng - bounds.minLng) * DEFAULT_BOUNDS_MARGIN, MIN_BOUNDS_MARGIN);
      const latPadding = Math.max((bounds.maxLat - bounds.minLat) * DEFAULT_BOUNDS_MARGIN, MIN_BOUNDS_MARGIN);
      const clampLng = (value: number) => Math.max(-180, Math.min(180, value));
      const clampLat = (value: number) => Math.max(-90, Math.min(90, value));
      return {
        minLng: clampLng(bounds.minLng - lngPadding),
        minLat: clampLat(bounds.minLat - latPadding),
        maxLng: clampLng(bounds.maxLng + lngPadding),
        maxLat: clampLat(bounds.maxLat + latPadding),
      };
    },
    [],
  );

  const selectionBounds = useMemo(() => {
    let minLng = Number.POSITIVE_INFINITY;
    let minLat = Number.POSITIVE_INFINITY;
    let maxLng = Number.NEGATIVE_INFINITY;
    let maxLat = Number.NEGATIVE_INFINITY;
    let hasBounds = false;
    filteredMetadataRows.forEach((row) => {
      const bbox = row.bbox;
      if (!bbox || bbox.length !== 4) return;
      const [minX, minY, maxX, maxY] = bbox;
      if (!Number.isFinite(minX) || !Number.isFinite(minY) || !Number.isFinite(maxX) || !Number.isFinite(maxY)) {
        return;
      }
      hasBounds = true;
      minLng = Math.min(minLng, minX);
      minLat = Math.min(minLat, minY);
      maxLng = Math.max(maxLng, maxX);
      maxLat = Math.max(maxLat, maxY);
    });
    if (!hasBounds) return null;
    const lngPadding = Math.max((maxLng - minLng) * DEFAULT_BOUNDS_MARGIN, MIN_BOUNDS_MARGIN);
    const latPadding = Math.max((maxLat - minLat) * DEFAULT_BOUNDS_MARGIN, MIN_BOUNDS_MARGIN);
    const clampLng = (value: number) => Math.max(-180, Math.min(180, value));
    const clampLat = (value: number) => Math.max(-90, Math.min(90, value));
    return {
      minLng: clampLng(minLng - lngPadding),
      minLat: clampLat(minLat - latPadding),
      maxLng: clampLng(maxLng + lngPadding),
      maxLat: clampLat(maxLat + latPadding),
    };
  }, [filteredMetadataRows]);

  const persistedViewState = useMemo(
    () => resolvePersistedViewState(data.previewMapView),
    [data.previewMapView?.latitude, data.previewMapView?.longitude, data.previewMapView?.zoom],
  );

  const normalizedTransformErrorRows = useMemo(() => transformErrorRows.map((row) => {
    const context = resolveSourceContext({
      countryCode: row.countryCode,
      countryName: row.countryName,
      adminLevel: row.adminLevel,
      sourceKey: row.sourceKey,
    });
    const rawFeatureId = normalizeText(row.featureId);
    const fallbackId = normalizeText(row.id);
    const normalizedFeatureId = !rawFeatureId || isNumericId(rawFeatureId)
      ? [
        context.countryCode ?? 'XX',
        context.adminLevel != null ? `ADM${context.adminLevel}` : 'ADM?',
        context.sourceKey,
        row.featureIndex != null ? String(row.featureIndex) : fallbackId ?? rawFeatureId ?? '0',
      ].filter(Boolean).join(':')
      : rawFeatureId;
    return {
      ...row,
      featureId: normalizedFeatureId,
      countryName: context.countryName ?? row.countryName,
      countryCode: context.countryCode ?? row.countryCode,
      adminLevel: context.adminLevel ?? row.adminLevel,
    };
  }), [resolveSourceContext, transformErrorRows]);

  const initialViewState = useMemo<MapWithVectorTilesProps['initialViewState']>(() => {
    if (persistedViewState) {
      return persistedViewState;
    }
    if (!selectionBounds) {
      return DEFAULT_VIEW;
    }
    const centerLng = (selectionBounds.minLng + selectionBounds.maxLng) / 2;
    const centerLat = (selectionBounds.minLat + selectionBounds.maxLat) / 2;
    return {
      longitude: centerLng,
      latitude: centerLat,
      zoom: DEFAULT_VIEW.zoom,
      bearing: 0,
      pitch: 0,
    };
  }, [persistedViewState, selectionBounds]);

  useEffect(() => {
    if (!mapInstance || !selectionBounds || persistedViewState) return;
    const bounds: [[number, number], [number, number]] = [
      [selectionBounds.minLng, selectionBounds.minLat],
      [selectionBounds.maxLng, selectionBounds.maxLat],
    ];
    mapInstance.fitBounds(bounds, {
      padding: 24,
    });
  }, [mapInstance, selectionBounds]);

  const getRowId = useCallback((row: ShapeDataSourceMetadata) => row.originKey, []);
  const buildSearchText = useCallback((row: ShapeDataSourceMetadata) => {
    return [
      row.originLabel,
      row.countryName,
      row.countryCode,
      row.adminLevel != null ? String(row.adminLevel) : undefined,
      row.featureLabel,
      row.featureGroupId,
      row.dataSource,
      row.originKey,
    ]
      .filter(Boolean)
      .join(' ');
  }, []);

  useVectorTilePreviewSearch(
    metadataEnabled,
    dataSourceMetadataRows,
    searchKeyword,
    getRowId,
    buildSearchText,
    setMatchedIds,
  );

  const deriveSelectionContext = useCallback((
    rows: ShapeDataSourceMetadata[],
    ids: string[],
  ) => {
    if (!ids.length) return null;
    const selectedRows = rows.filter((row) => ids.includes(row.originKey));
    const first = selectedRows[0];
    if (!first) return null;
    const consistent = selectedRows.every(
      (row) => row.countryCode === first.countryCode && row.adminLevel === first.adminLevel,
    );
    return consistent && first.countryCode != null && first.adminLevel != null
      ? { countryCode: first.countryCode, adminLevel: first.adminLevel }
      : null;
  }, []);

  const resolveSelection = useCallback((
    row: ShapeDataSourceMetadata,
    current: typeof selectionContext,
    rows: ShapeDataSourceMetadata[],
  ) => {
    const adminLevel = row.adminLevel ?? 0;
    const countryCode = row.countryCode ?? '';
    if (!countryCode) {
      return { nextContext: null, selectedIds: [] as string[] };
    }
    const isSameCountry = current?.countryCode === countryCode;
    const currentLevel = isSameCountry ? current?.adminLevel : null;
    const nextLevel = currentLevel != null
      ? currentLevel > 0
        ? currentLevel - 1
        : null
      : adminLevel;
    if (nextLevel === null) {
      return { nextContext: null, selectedIds: [] as string[] };
    }
    const selectedIds = rows
      .filter((item) => item.countryCode === countryCode && item.adminLevel === nextLevel)
      .map((item) => item.originKey);
    return {
      nextContext: selectedIds.length ? { countryCode, adminLevel: nextLevel } : null,
      selectedIds,
    };
  }, []);


  const resolveHoverOriginKey = useCallback((feature: { id?: unknown; properties?: Record<string, unknown> | null }) => {
    const candidate = feature?.properties?.__hdbOriginKey ?? feature?.properties?.id ?? feature?.id;
    if (candidate === null || candidate === undefined) return '';
    return normalizeText(String(candidate)) ?? '';
  }, []);

  const hoverFeatureByOriginKey = useMemo(() => {
    const map = new Map<string, { props: Record<string, unknown>; adminLevel: number }>();
    hoverCandidates.forEach(({ feature }) => {
      const originKey = resolveHoverOriginKey(feature);
      if (!originKey) return;
      const props = (feature.properties ?? {}) as Record<string, unknown>;
      const level = resolveAdminLevelFromProps(props, -1) ?? -1;
      const existing = map.get(originKey);
      if (!existing || level > existing.adminLevel) {
        map.set(originKey, { props, adminLevel: level });
      }
    });
    return map;
  }, [hoverCandidates, resolveHoverOriginKey]);

  const getHoverLabel = useCallback((row: ShapeDataSourceMetadata) => {
    const hoverProps = hoverFeatureByOriginKey.get(row.originKey)?.props;
    return buildHoverLabel(row, hoverProps);
  }, [hoverFeatureByOriginKey]);

  const {
    selectedIdSet,
    hoveredIdSet,
    hoverMessage,
    handleMapIdentify,
  } = useVectorTilePreviewSelection({
    rows: dataSourceMetadataRows,
    selectedIds,
    setSelectedIds,
    hoveredId,
    selectionContext,
    setSelectionContext,
    getRowId,
    resolveSelection,
    deriveSelectionContext,
    getHoverLabel,
    resolveFeatureId: (feature) =>
      String(feature.properties?.__hdbOriginKey ?? feature.properties?.id ?? feature.id ?? ''),
  });

  useEffect(() => {
    const candidate = hoverCandidates[0];
    if (!candidate) {
      if (hoveredId !== null) {
        setHoveredId(null);
      }
      return;
    }
    const feature = candidate.feature;
    const resolved = String(
      feature.properties?.__hdbOriginKey ?? feature.properties?.id ?? feature.id ?? '',
    );
    if (!resolved) {
      if (hoveredId !== null) {
        setHoveredId(null);
      }
      return;
    }
    if (resolved !== hoveredId) {
      setHoveredId(resolved);
    }
  }, [hoverCandidates, hoveredId, setHoveredId]);

  const toFeatureListRow = useCallback(
    (row: ShapeFeatureMetadata): ShapePreviewFeatureRow => {
      const context = resolveSourceContext({
        countryCode: row.countryCode,
        countryName: row.countryName,
        adminLevel: row.adminLevel,
        dataSource: row.dataSource,
      });
      const adminLevel = context.adminLevel ?? row.adminLevel;
      const adminName = resolveAdminNameFromMetadata(row, adminLevel, context);
      const adminCode = resolveAdminCodeFromMetadata(row, adminLevel, context);
      return {
        id: row.id,
        featureId: row.featureId,
        errorCount: row.errorCount,
        repairCount: row.repairCount,
        countryName: context.countryName ?? row.countryName,
        countryCode: context.countryCode ?? row.countryCode,
        adminName,
        adminLevel,
        adminCode,
        dataSource: context.dataSource ?? row.dataSource,
        createdAt: row.createdAt,
        vertexCount: row.vertexCount,
        polygonCount: row.polygonCount,
        bbox: row.bbox,
        area: row.area,
        recycling: row.recycling ?? false,
      };
    },
    [resolveSourceContext],
  );

  const {
    featureListRows,
    rowIdToMembers,
    featureToCountryKey,
    countryGroupMembers,
  } = useMemo(() => {
    const rows = featureMetadataRows.map((row) => toFeatureListRow(row));
    const collapsed = new Map<string, ShapePreviewFeatureRow>();
    const pickPreferredRow = (current: ShapePreviewFeatureRow, next: ShapePreviewFeatureRow) => {
      const currentVertices = current.vertexCount ?? 0;
      const nextVertices = next.vertexCount ?? 0;
      const currentPolygons = current.polygonCount ?? 0;
      const nextPolygons = next.polygonCount ?? 0;
      if (nextVertices + nextPolygons > currentVertices + currentPolygons) {
        return next;
      }
      if (!current.dataSource && next.dataSource) return next;
      if (!current.adminName && next.adminName) return next;
      if (!current.adminCode && next.adminCode) return next;
      return current;
    };
    rows.forEach((row) => {
      const key = row.featureId ?? row.id;
      if (!key) return;
      const existingRow = collapsed.get(key);
      collapsed.set(key, existingRow ? pickPreferredRow(existingRow, row) : row);
    });
    const existing = new Set(collapsed.keys());
    normalizedTransformErrorRows.forEach((errorRow) => {
      const featureId = errorRow.featureId;
      if (!featureId) return;
      if (existing.has(featureId)) return;
      const context = resolveSourceContext({
        countryCode: errorRow.countryCode,
        countryName: errorRow.countryName,
        adminLevel: errorRow.adminLevel,
        sourceKey: errorRow.sourceKey,
      });
      const adminLevel = context.adminLevel ?? errorRow.adminLevel;
      const adminName = adminLevel === 0 ? context.countryName : undefined;
      const adminCode = adminLevel === 0 ? context.countryCode : undefined;
      collapsed.set(featureId, {
        id: featureId,
        featureId,
        countryName: context.countryName ?? errorRow.countryName,
        countryCode: context.countryCode ?? errorRow.countryCode,
        adminName,
        adminLevel,
        adminCode,
        dataSource: context.dataSource,
        createdAt: errorRow.createdAt,
      });
      existing.add(featureId);
    });

    const baseRows = Array.from(collapsed.values());
    const listRows: ShapePreviewFeatureRow[] = [];
    const rowIdToMembers = new Map<string, string[]>();
    const featureToCountryKey = new Map<string, string>();
    const countryGroupMembers = new Map<string, string[]>();

    baseRows.forEach((row) => {
      const memberId = String(row.featureId ?? row.id ?? '');
      if (!memberId) return;
      const rowKey = String(row.featureId ?? row.id ?? '');
      const countryKey = buildCountryGroupKey(row.countryCode);
      if (countryKey) {
        featureToCountryKey.set(memberId, countryKey);
        const members = countryGroupMembers.get(countryKey) ?? [];
        members.push(memberId);
        countryGroupMembers.set(countryKey, members);
      }
      listRows.push({ ...row, aggregationLevel: 'feature' });
      rowIdToMembers.set(rowKey, [memberId]);
    });

    const featureListRows = [...listRows];
    return {
      featureListRows,
      rowIdToMembers,
      featureToCountryKey,
      countryGroupMembers,
    };
  }, [featureMetadataRows, normalizedTransformErrorRows, resolveSourceContext, toFeatureListRow]);

  const getFeatureRowId = useCallback((row: ShapePreviewFeatureRow) => String(row.featureId ?? row.id ?? ''), []);
  const buildFeatureSearchText = useCallback((row: ShapePreviewFeatureRow) => (
    [
      row.featureId,
      row.countryName,
      row.countryCode,
      row.adminName,
      row.adminCode,
      row.adminLevel != null ? String(row.adminLevel) : undefined,
      row.dataSource,
    ]
      .filter(Boolean)
      .join(' ')
  ), []);

  useVectorTilePreviewSearch(
    metadataEnabled,
    featureListRows,
    featureSearchKeyword,
    getFeatureRowId,
    buildFeatureSearchText,
    setMatchedFeatureIds,
  );

  const matchedFeatureIdSet = useMemo<Set<string>>(
    () => new Set(matchedFeatureIds),
    [matchedFeatureIds],
  );
  const [featureRowFilterMode, setFeatureRowFilterMode] = useState<'all' | 'viewport'>('all');
  const [featureRowSearchOnly, setFeatureRowSearchOnly] = useState(true);

  const viewportFeatureIdSet = useMemo(() => {
    if (!viewportFeatureIdsByLayer) return null;
    const collected = new Set<string>();
    viewportFeatureIdsByLayer.forEach((ids) => {
      ids.forEach((id) => collected.add(String(id)));
    });
    return collected;
  }, [viewportFeatureIdsByLayer]);

  const displayedFeatureRows = useMemo(() => {
    if (featureRowFilterMode !== 'viewport') return featureListRows;
    if (!viewportFeatureIdSet || viewportFeatureIdSet.size === 0) return [];
    return featureListRows.filter((row) => viewportFeatureIdSet.has(String(row.featureId ?? row.id)));
  }, [featureListRows, featureRowFilterMode, viewportFeatureIdSet]);

  const baseErrorSummaryById = useMemo<MapPreviewErrorSummaryById>(() => {
    const summary = new Map<string, {
      errorCount: number;
      repairCount: number;
      count: number;
      messages: string[];
    }>();
    normalizedTransformErrorRows.forEach((row) => {
      const id = row.featureId;
      if (!id) return;
      const key = String(id);
      const entry = summary.get(key) ?? {
        errorCount: 0,
        repairCount: 0,
        count: 0,
        messages: [],
      };
      if (isRepairIssueKind(row.issueKind)) {
        entry.repairCount += 1;
      } else {
        entry.errorCount += 1;
      }
      entry.count = entry.errorCount;
      const message = normalizeText(row.message);
      if (message) {
        entry.messages.push(message);
      }
      summary.set(key, entry);
    });
    return summary;
  }, [normalizedTransformErrorRows]);

  const toggleRecyclingForSelection = useCallback(async () => {
    if (selectedFeatureIds.length === 0) return;
    const expandedIds = new Set<string>();
    selectedFeatureIds.forEach((id) => {
      const members = rowIdToMembers.get(id) ?? [id];
      members.forEach((memberId) => expandedIds.add(memberId));
    });
    if (expandedIds.size === 0) return;
    const selectedRows = featureMetadataRows.filter((row) => {
      const key = String(row.featureId ?? row.id);
      return expandedIds.has(key);
    });
    if (selectedRows.length === 0) return;
    const recyclingCount = selectedRows.filter((row) => row.recycling).length;
    const nextValue = recyclingCount !== selectedRows.length;
    const updatedRows = selectedRows.map((row) => ({ ...row, recycling: nextValue }));
    try {
      await shapeMutationAPIImpl.putFeatureMetadata(updatedRows);
      const updatedRowIds = new Set(updatedRows.map((row) => String(row.featureId ?? row.id)));
      const nextRows = featureMetadataRows.map((row) => {
        const key = String(row.featureId ?? row.id);
        if (!updatedRowIds.has(key)) return row;
        const updated = updatedRows.find((entry) => String(entry.featureId ?? entry.id) === key);
        return updated ?? row;
      });
      setFeatureMetadataOverride(nextRows);
    } catch (error) {
      console.warn('[ShapePreviewStep] failed to toggle recycling', error);
    }
  }, [featureMetadataRows, rowIdToMembers, selectedFeatureIds]);

  const errorSummaryById = useMemo<MapPreviewErrorSummaryById>(() => {
    if (featureListRows.length === 0) return baseErrorSummaryById;
    const aggregated = new Map(baseErrorSummaryById);
    featureListRows.forEach((row) => {
      if (!row.memberFeatureIds || row.memberFeatureIds.length === 0) return;
      const groupId = String(row.featureId ?? row.id ?? '');
      if (!groupId) return;
      let errorCount = 0;
      let repairCount = 0;
      const messages: string[] = [];
      row.memberFeatureIds.forEach((memberId) => {
        const summary = baseErrorSummaryById.get(String(memberId));
        if (!summary) return;
        errorCount += summary.errorCount ?? summary.count ?? 0;
        repairCount += summary.repairCount ?? 0;
        if (summary.messages.length > 0) {
          messages.push(...summary.messages);
        }
      });
      if (errorCount > 0 || repairCount > 0) {
        aggregated.set(groupId, { errorCount, repairCount, count: errorCount, messages });
      }
    });
    return aggregated;
  }, [baseErrorSummaryById, featureListRows]);

  const expandMapIds = useCallback((ids: string[]) => {
    const result = new Set<string>();
    const addMembers = (members?: string[]) => {
      members?.forEach((memberId) => result.add(memberId));
    };
    ids.forEach((id) => {
      const members = rowIdToMembers.get(id) ?? [id];
      members.forEach((memberId) => {
        result.add(memberId);
        const countryKey = featureToCountryKey.get(memberId);
        if (countryKey) addMembers(countryGroupMembers.get(countryKey));
      });
    });
    return Array.from(result);
  }, [countryGroupMembers, featureToCountryKey, rowIdToMembers]);

  const resolvedLayerSetEntries = useMemo<ResolvedLayerSetEntry[]>(() => {
    const definition = getLayerSetDefinition(layerSetName);
    if (!definition) return [];
    return resolveLayerSetEntries(tileLayerNames, definition);
  }, [layerSetName, tileLayerNames]);

  const layerEntriesByAdminLevel = useMemo(() => {
    const map = new Map<number, ResolvedLayerSetEntry[]>();
    resolvedLayerSetEntries.forEach((entry) => {
      const adminLevel = entry.adminLevel;
      if (adminLevel == null) return;
      const list = map.get(adminLevel) ?? [];
      list.push(entry);
      map.set(adminLevel, list);
    });
    return map;
  }, [resolvedLayerSetEntries]);

  const featureAdminLevelById = useMemo(() => {
    const map = new Map<string, number>();
    featureMetadataRows.forEach((row) => {
      const adminLevel = row.adminLevel;
      if (!row.featureId || adminLevel == null) return;
      map.set(String(row.featureId), adminLevel);
    });
    normalizedTransformErrorRows.forEach((row) => {
      const adminLevel = row.adminLevel;
      if (!row.featureId || adminLevel == null) return;
      map.set(String(row.featureId), adminLevel);
    });
    return map;
  }, [featureMetadataRows, normalizedTransformErrorRows]);

  const buildMapEntries = useCallback((id: string): MapHighlightEntry[] => {
    const adminLevel = featureAdminLevelById.get(id);
    const entries = typeof adminLevel === 'number' ? layerEntriesByAdminLevel.get(adminLevel) : undefined;
    const effectiveEntries = entries && entries.length > 0 ? entries : resolvedLayerSetEntries.slice(0, 1);
    if (effectiveEntries.length > 0) {
      return effectiveEntries.map((entry) => ({
        source: `${baseSourceId}-${entry.id}`,
        id,
        layerId: `${baseLayerId}-${entry.id}`,
        sourceLayer: entry.sourceLayer,
        nodeId: nodeKey ? String(nodeKey) : undefined,
        nodeType: 'shape',
      }));
    }
    return [];
  }, [
    baseLayerId,
    baseSourceId,
    featureAdminLevelById,
    layerEntriesByAdminLevel,
    nodeKey,
    resolvedLayerSetEntries,
  ]);

  const expandedMatchedIds = useMemo(
    () => expandMapIds(matchedFeatureIds),
    [expandMapIds, matchedFeatureIds],
  );
  const expandedSelectedIds = useMemo(
    () => expandMapIds(selectedFeatureIds),
    [expandMapIds, selectedFeatureIds],
  );
  const expandedHoverIds = useMemo(
    () => (hoveredId ? expandMapIds([hoveredId]) : []),
    [expandMapIds, hoveredId],
  );

  const selectedFeatureIdSet = useMemo(() => new Set(expandedSelectedIds), [expandedSelectedIds]);

  const searchMatchKeysRef = useRef<string[]>([]);
  const selectedMatchKeysRef = useRef<string[]>([]);
  const hoverMatchKeysRef = useRef<string[]>([]);
  const setMatchesIfChanged = useCallback((
    next: MapHighlightEntry[],
    keyRef: MutableRefObject<string[]>,
    setter: (entries: MapHighlightEntry[]) => void,
  ) => {
    const nextKeys = next.map(buildHighlightKey);
    const prevKeys = keyRef.current;
    if (prevKeys.length === nextKeys.length && prevKeys.every((value, index) => value === nextKeys[index])) {
      return;
    }
    keyRef.current = nextKeys;
    setter(next);
  }, [buildHighlightKey]);

  const selectedErrorBounds = useMemo(() => {
    if (selectedFeatureIdSet.size === 0) return null;
    let bounds: { minLng: number; minLat: number; maxLng: number; maxLat: number } | null = null;
    normalizedTransformErrorRows.forEach((row) => {
      if (!row.featureId || !selectedFeatureIdSet.has(row.featureId)) return;
      row.lineFeatures?.features?.forEach((feature) => {
        const geometry = (feature as { geometry?: { coordinates?: unknown } }).geometry;
        if (!geometry?.coordinates) return;
        bounds = visitCoordinates(geometry.coordinates, bounds);
      });
    });
    return finalizeBounds(bounds);
  }, [finalizeBounds, normalizedTransformErrorRows, selectedFeatureIdSet, visitCoordinates]);

  useEffect(() => {
    if (!mapInstance || !selectedErrorBounds) return;
    const bounds: [[number, number], [number, number]] = [
      [selectedErrorBounds.minLng, selectedErrorBounds.minLat],
      [selectedErrorBounds.maxLng, selectedErrorBounds.maxLat],
    ];
    mapInstance.fitBounds(bounds, {
      padding: 24,
    });
  }, [mapInstance, selectedErrorBounds]);

  const errorLineCollection = useMemo<ShapeTransformErrorRecord['lineFeatures'] | null>(() => {
    if (normalizedTransformErrorRows.length === 0) return null;
    const features = normalizedTransformErrorRows.flatMap((row) => {
      const isSelected = row.featureId ? selectedFeatureIdSet.has(row.featureId) : false;
      return (row.lineFeatures?.features ?? []).map((feature) => ({
        ...feature,
        properties: {
          ...(feature.properties ?? {}),
          selected: isSelected,
        },
      }));
    });
    return features.length ? { type: 'FeatureCollection', features } : null;
  }, [normalizedTransformErrorRows, selectedFeatureIdSet]);

  useEffect(() => {
    if (!mapInstance) return;
    const interactiveMap = mapInstance as MapLibreMapInstance & {
      scrollZoom?: { enable?: () => void };
      dragPan?: { enable?: () => void };
      dragRotate?: { enable?: () => void };
      doubleClickZoom?: { enable?: () => void };
      touchZoomRotate?: { enable?: () => void };
    };
    interactiveMap.scrollZoom?.enable?.();
    interactiveMap.dragPan?.enable?.();
    interactiveMap.dragRotate?.enable?.();
    interactiveMap.doubleClickZoom?.enable?.();
    interactiveMap.touchZoomRotate?.enable?.();
  }, [mapInstance]);

  useEffect(() => {
    tileLayerNamesRef.current = null;
    setTileLayerNames([]);
  }, [activeNodeId, tilesUrl]);

  const tileDataProvider = useCallback<NonNullable<MapWithVectorTilesProps['tileDataProvider']>>(
    async (z: number, x: number, y: number, nodeId?: string) => {
      const resolvedNodeId = nodeId ?? (activeNodeId ? String(activeNodeId) : undefined);
      if (!resolvedNodeId) return null;
      const data = await fetchTile(resolvedNodeId, z, x, y);
      if (!data) return null;
      if (!tileLayerNamesRef.current) {
        const names = parseVectorTileLayerNames(data);
        if (names.length > 0) {
          tileLayerNamesRef.current = new Set(names);
          setTileLayerNames(names);
        }
      }
      return data;
    },
    [activeNodeId],
  );

  useEffect(() => {
    const entries = expandedMatchedIds.flatMap((id) => buildMapEntries(String(id)));
    setMatchesIfChanged(entries, searchMatchKeysRef, setMapSearchMatches);
  }, [buildMapEntries, expandedMatchedIds, setMapSearchMatches, setMatchesIfChanged]);

  useEffect(() => {
    const entries = expandedSelectedIds.flatMap((id) => buildMapEntries(String(id)));
    setMatchesIfChanged(entries, selectedMatchKeysRef, setMapSelectedMatches);
  }, [buildMapEntries, expandedSelectedIds, setMapSelectedMatches, setMatchesIfChanged]);

  useEffect(() => {
    if (expandedHoverIds.length === 0) {
      setMatchesIfChanged([], hoverMatchKeysRef, setMapHoverMatches);
      return;
    }
    setMatchesIfChanged(expandedHoverIds.flatMap((id) => buildMapEntries(String(id))), hoverMatchKeysRef, setMapHoverMatches);
  }, [buildMapEntries, expandedHoverIds, setMapHoverMatches, setMatchesIfChanged]);

  return {
    t,
    theme,
    metadataEnabled,
    dataSourceMetadataRows,
    dataSourceMetadataLoading,
    dataSourceMetadataError,
    dataSourceMetadataLoaded,
    featureMetadataRows,
    featureListRows,
    featureMetadataLoading,
    featureMetadataError,
    featureMetadataLoaded,
    transformErrorRows: normalizedTransformErrorRows,
    transformErrorLoading,
    transformErrorError,
    transformErrorLoaded,
    searchKeyword,
    setSearchKeyword,
    featureSearchKeyword,
    setFeatureSearchKeyword,
    matchedIds,
    selectedIds,
    setSelectedIds,
    selectedFeatureIds,
    setSelectedFeatureIds,
    toggleRecyclingForSelection,
    hoveredId,
    setHoveredId,
    selectionContext,
    setSelectionContext,
    errorSummaryById,
    matchedFeatureIdSet,
    displayedFeatureRows,
    featureRowFilterMode,
    setFeatureRowFilterMode,
    featureRowSearchOnly,
    setFeatureRowSearchOnly,
    selectedIdSet,
    hoveredIdSet,
    hoverMessage,
    tilesUrl,
    tilesLayer,
    nodeId: activeNodeId,
    processingStatus,
    tileDbName,
    tileDataProvider,
    tileLayerNames,
    baseLayerId,
    baseSourceId,
    mapInstance,
    setMapInstance,
    handleMapIdentify,
    defaultView: initialViewState,
    selectionDataSource,
    errorLineCollection,
  };
};
