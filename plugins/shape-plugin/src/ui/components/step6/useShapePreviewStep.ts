import { useCallback, useEffect, useMemo, useState } from 'react';
import { useTheme } from '@mui/material/styles';
import type { DataSourceName, FetchTaskPayload, ShapeEntity } from '../../../common/types/index.js';
import { isShapePreviewMetadataEnabled } from '../../../common/config/previewFlags.js';
import { toNodeId, type NodeId } from '@hierarchidb/common-types';
import { useTranslation } from '../../i18n.js';
import type { ShapeFeatureMetadata, ShapeSourceMetadata, ShapeTransformErrorRecord } from '@hierarchidb/plugin-service-api';
import { useAtom, useSetAtom } from 'jotai';
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
  ShapePreviewFeatureRow,
} from '@hierarchidb/ui-map';
import type { MapLibreMapInstance } from '@hierarchidb/ui-map';
import {
  buildErrorSummaryById,
  mapHoverMatchesAtom,
  mapSearchMatchesAtom,
  mapSelectedMatchesAtom,
  useVectorTilePreviewMetadata,
  useVectorTilePreviewSearch,
  useVectorTilePreviewSelection,
} from '@hierarchidb/ui-map';
import { getDBName } from '@hierarchidb/util';
//import { getShapeDbAPIClient } from '../../../services/batch/ShapeBuildAPIClient.ts';
import { getWorkerClientHook, type WorkerClientRef } from '@hierarchidb/ui-worker-provider';
import { shapeQueryAPIImpl } from '../../../services/batch/ShapeBuildAPIClient.ts';

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

const buildAdminGroupKey = (row: ShapePreviewFeatureRow): string | null => {
  if (row.dataSource !== 'geoboundaries') return null;
  if (row.adminLevel !== 1) return null;
  const countryCode = normalizeCountryCodeValue(row.countryCode);
  const adminKey = normalizeText(row.adminCode) ?? normalizeText(row.adminName);
  if (!countryCode || !adminKey) return null;
  return `adm1:${countryCode}:${adminKey.toLowerCase()}`;
};

const buildCountryGroupKey = (countryCode?: string): string | null => {
  const normalized = normalizeCountryCodeValue(countryCode);
  if (!normalized) return null;
  return `country:${normalized}`;
};

const mergeBounds = (
  current: [number, number, number, number] | undefined,
  next: [number, number, number, number] | undefined,
): [number, number, number, number] | undefined => {
  if (!next || next.length !== 4) return current;
  const [minX, minY, maxX, maxY] = next;
  if ([minX, minY, maxX, maxY].some((value) => typeof value !== 'number' || !Number.isFinite(value))) {
    return current;
  }
  if (!current) return [minX, minY, maxX, maxY];
  return [
    Math.min(current[0], minX),
    Math.min(current[1], minY),
    Math.max(current[2], maxX),
    Math.max(current[3], maxY),
  ];
};

const isNumericId = (value?: string): boolean => {
  if (!value) return false;
  return /^[0-9]+$/.test(value);
};

const fetchTileSummary = async (nodeId: string) => {
  const summary = await shapeQueryAPIImpl.getVectorTileSummary(toNodeId(nodeId));
  return { tiles: summary.tiles, totalBytes: summary.totalBytes };
};

const resolveTilesAvailable = async (nodeId: string): Promise<boolean> => {
  const summary = await fetchTileSummary(nodeId);
  return summary.tiles > 0;
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

export const useShapePreviewStep = (data: Partial<ShapeEntity>, nodeId?: string) => {
  const { t } = useTranslation();
  const theme = useTheme();
  const metadataEnabled = isShapePreviewMetadataEnabled();
  const [searchKeyword, setSearchKeyword] = useAtom(shapePreviewSearchAtom);
  const [matchedIds, setMatchedIds] = useAtom(shapePreviewMatchedIdsAtom);
  const [selectedIds, setSelectedIds] = useAtom(shapePreviewSelectedIdsAtom);
  const [hoveredId, setHoveredId] = useAtom(shapePreviewHoveredIdAtom);
  const [selectionContext, setSelectionContext] = useAtom(shapePreviewSelectionContextAtom);
  const [mapInstance, setMapInstance] = useState<MapLibreMapInstance | null>(null);
  const [featureSearchKeyword, setFeatureSearchKeyword] = useState('');
  const [matchedFeatureIds, setMatchedFeatureIds] = useState<string[]>([]);
  const [selectedFeatureIds, setSelectedFeatureIds] = useState<string[]>([]);
  const setMapSearchMatches = useSetAtom(mapSearchMatchesAtom);
  const setMapSelectedMatches = useSetAtom(mapSelectedMatchesAtom);
  const setMapHoverMatches = useSetAtom(mapHoverMatchesAtom);

  const previewDraft = data as ShapePreviewDraft;
  const tilesUrl = previewDraft.tilesUrl ?? previewDraft.tilesEndpoint ?? '';
  const tilesLayer = previewDraft.tilesLayer ?? 'admin0';
  const activeNodeId = previewDraft.nodeId
    ? toNodeId(String(previewDraft.nodeId))
    : nodeId
      ? toNodeId(String(nodeId))
      : null;
  const nodeKey = activeNodeId;
  const processingStatus = data?.processingStatus ?? null;
  const [tilesAvailable, setTilesAvailable] = useState(false);
  const [tilesChecking, setTilesChecking] = useState(false);
  const baseLayerId = 'shape-preview';
  const baseSourceId = 'shape-preview-source';
  const tileDbName = getDBName('shape');
  const [selectionMetadata, setSelectionMetadata] = useState<FetchTaskPayload[]>([]);
  const buildMapEntry = useCallback((id: string): MapHighlightEntry => ({
    source: baseSourceId,
    id,
    layerId: baseLayerId,
    nodeId: nodeKey ? String(nodeKey) : undefined,
    nodeType: 'shape',
  }), [baseLayerId, baseSourceId, nodeKey]);
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

  useEffect(() => {
    let cancelled = false;
    const key = nodeKey ? String(nodeKey) : null;
    if (!key) {
      setTilesAvailable(false);
      setTilesChecking(false);
      return () => {
        cancelled = true;
      };
    }
    setTilesChecking(true);
    resolveTilesAvailable(key).then((available) => {
      if (cancelled) return;
      setTilesAvailable(available);
      setTilesChecking(false);
    }).catch(() => {
      if (cancelled) return;
      setTilesAvailable(false);
      setTilesChecking(false);
    });
    return () => {
      cancelled = true;
    };
  }, [nodeKey]);

  useEffect(() => {
    if (!nodeKey || tilesAvailable) return;
    if (!processingStatus || processingStatus === 'processing') return;
    let cancelled = false;
    setTilesChecking(true);
    resolveTilesAvailable(String(nodeKey)).then((available) => {
      if (cancelled) return;
      setTilesAvailable(available);
      setTilesChecking(false);
    }).catch(() => {
      if (cancelled) return;
      setTilesChecking(false);
    });
    return () => {
      cancelled = true;
    };
  }, [nodeKey, processingStatus, tilesAvailable]);

  const statusForPolling = processingStatus ?? 'processing';
  const shouldPollTiles = Boolean(activeNodeId)
    && !tilesAvailable
    && statusForPolling === 'processing';
  const shouldPollMetadata = Boolean(activeNodeId)
    && metadataEnabled
    && statusForPolling === 'processing';
  const metadataPollIntervalMs = shouldPollMetadata ? 2000 : undefined;

  useEffect(() => {
    if (!shouldPollTiles) {
      setTilesChecking(false);
      return;
    }
    let cancelled = false;
    let timeoutId: ReturnType<typeof setTimeout> | null = null;
    const pollSummary = async () => {
      setTilesChecking(true);
      try {
        const available = await resolveTilesAvailable(String(activeNodeId));
        if (cancelled) return;
        if (available) {
          setTilesAvailable(true);
          setTilesChecking(false);
          return;
        }
      } catch (error) {
        console.debug('[ShapePreviewStep] tile summary load failed', error);
      }
      if (!cancelled) {
        timeoutId = setTimeout(pollSummary, 2000);
      }
    };
    void pollSummary();
    return () => {
      cancelled = true;
      if (timeoutId) {
        clearTimeout(timeoutId);
      }
    };
  }, [activeNodeId, shouldPollTiles]);

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

  const loadSourceMetadataRows = useCallback(
    (targetNodeId: NodeId) =>
      shapeQueryAPIImpl.listSourceMetadata(targetNodeId) as Promise<ShapeSourceMetadata[]>,
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
    metadataRows: rawSourceMetadataRows,
    metadataLoading: sourceMetadataLoading,
    metadataError: sourceMetadataError,
    metadataLoaded: sourceMetadataLoaded,
  } = useVectorTilePreviewMetadata(
    metadataEnabled,
    activeNodeId,
    loadSourceMetadataRows,
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
    if (!selectionFilters) return rawSourceMetadataRows;
    return rawSourceMetadataRows.filter((row) => {
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
  }, [rawSourceMetadataRows, selectionFilters]);

  const sourceMetadataRows = filteredMetadataRows;
  const featureMetadataRows = rawFeatureMetadataRows;
  const transformErrorRows = rawTransformErrorRows;

  const sourceMetadataLookup = useMemo(() => {
    const bySourceKey = new Map<string, ShapeSourceMetadata>();
    const byCountryName = new Map<string, ShapeSourceMetadata>();
    const byCountryCode = new Map<string, ShapeSourceMetadata>();
    sourceMetadataRows.forEach((row) => {
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
  }, [sourceMetadataRows]);

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
    const sourceByKey = lookupKey ? sourceMetadataLookup.bySourceKey.get(lookupKey) : undefined;
    const sourceByName = candidateName && candidateAdminLevel != null
      ? sourceMetadataLookup.byCountryName.get(`${candidateName.toLowerCase()}:${candidateAdminLevel}`)
      : undefined;
    const sourceByCode = candidateCode ? sourceMetadataLookup.byCountryCode.get(candidateCode) : undefined;
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
  }, [selectionDataSource, selectionLookup.byCode, selectionLookup.byName, sourceMetadataLookup]);

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
  }, [selectionBounds]);

  useEffect(() => {
    if (!mapInstance || !selectionBounds) return;
    const bounds: [[number, number], [number, number]] = [
      [selectionBounds.minLng, selectionBounds.minLat],
      [selectionBounds.maxLng, selectionBounds.maxLat],
    ];
    mapInstance.fitBounds(bounds, {
      padding: 24,
    });
  }, [mapInstance, selectionBounds]);

  const getRowId = useCallback((row: ShapeSourceMetadata) => row.originKey, []);
  const buildSearchText = useCallback((row: ShapeSourceMetadata) => {
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
    sourceMetadataRows,
    searchKeyword,
    getRowId,
    buildSearchText,
    setMatchedIds,
  );

  const deriveSelectionContext = useCallback((
    rows: ShapeSourceMetadata[],
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
    row: ShapeSourceMetadata,
    current: typeof selectionContext,
    rows: ShapeSourceMetadata[],
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
    if (nextLevel == null) {
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

  const getHoverLabel = useCallback((row: ShapeSourceMetadata) => {
    const parts = [
      row.originLabel,
      row.countryName,
      row.countryCode,
      row.adminLevel != null ? String(row.adminLevel) : undefined,
    ].filter((part) => part && String(part).trim().length > 0);
    return parts.join(' / ');
  }, []);

  const {
    selectedIdSet,
    hoveredIdSet,
    hoverMessage,
    handleMapIdentify,
  } = useVectorTilePreviewSelection({
    rows: sourceMetadataRows,
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

  const toFeatureListRow = useCallback(
    (row: ShapeFeatureMetadata): ShapePreviewFeatureRow => {
      const context = resolveSourceContext({
        countryCode: row.countryCode,
        countryName: row.countryName,
        adminLevel: row.adminLevel,
        dataSource: row.dataSource,
      });
      const adminLevel = context.adminLevel ?? row.adminLevel;
      const adminName = normalizeText(row.adminName)
        ?? (adminLevel === 0 ? context.countryName : undefined);
      const adminCode = normalizeText(row.adminCode)
        ?? (adminLevel === 0 ? context.countryCode : undefined);
      return {
        id: row.id,
        featureId: row.featureId,
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
      };
    },
    [resolveSourceContext],
  );

  const {
    featureListRows,
    rowIdToMembers,
    featureToAdminKey,
    featureToCountryKey,
    adminGroupMembers,
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
    const adminGroups = new Map<string, ShapePreviewFeatureRow[]>();
    const listRows: ShapePreviewFeatureRow[] = [];
    const rowIdToMembers = new Map<string, string[]>();
    const featureToAdminKey = new Map<string, string>();
    const featureToCountryKey = new Map<string, string>();
    const adminGroupMembers = new Map<string, string[]>();
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
      const adminKey = buildAdminGroupKey(row);
      if (adminKey) {
        featureToAdminKey.set(memberId, adminKey);
        const group = adminGroups.get(adminKey) ?? [];
        group.push(row);
        adminGroups.set(adminKey, group);
        return;
      }
      listRows.push({ ...row, aggregationLevel: 'feature' });
      rowIdToMembers.set(rowKey, [memberId]);
    });

    const aggregatedRows: ShapePreviewFeatureRow[] = [];
    adminGroups.forEach((groupRows, adminKey) => {
      const memberIds = groupRows
        .map((row) => String(row.featureId ?? row.id ?? ''))
        .filter(Boolean);
      if (memberIds.length === 0) return;
      adminGroupMembers.set(adminKey, memberIds);
      const countryCode = normalizeCountryCodeValue(groupRows[0]?.countryCode);
      const adminName = groupRows.find((row) => normalizeText(row.adminName))?.adminName;
      const adminCode = groupRows.find((row) => normalizeText(row.adminCode))?.adminCode;
      const adminLabel = normalizeText(adminCode) ?? normalizeText(adminName) ?? 'unknown';
      const groupId = `ADM1:${countryCode ?? 'UNKNOWN'}:${adminLabel}`;
      const aggregated: ShapePreviewFeatureRow = {
        id: groupId,
        featureId: groupId,
        memberFeatureIds: memberIds,
        aggregationLevel: 'admin',
        countryName: groupRows.find((row) => normalizeText(row.countryName))?.countryName,
        countryCode,
        adminName,
        adminCode,
        adminLevel: 1,
        dataSource: groupRows.find((row) => row.dataSource)?.dataSource,
        createdAt: Math.min(...groupRows.map((row) => row.createdAt ?? Date.now())),
        vertexCount: groupRows.reduce((sum, row) => sum + (row.vertexCount ?? 0), 0),
        polygonCount: groupRows.reduce((sum, row) => sum + (row.polygonCount ?? 0), 0),
        area: groupRows.reduce((sum, row) => sum + (row.area ?? 0), 0),
        bbox: groupRows.reduce((current, row) => mergeBounds(current, row.bbox), undefined as [number, number, number, number] | undefined),
      };
      aggregatedRows.push(aggregated);
      rowIdToMembers.set(groupId, memberIds);
    });

    const featureListRows = [...aggregatedRows, ...listRows];
    return {
      featureListRows,
      rowIdToMembers,
      featureToAdminKey,
      featureToCountryKey,
      adminGroupMembers,
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

  const baseErrorSummaryById = useMemo<MapPreviewErrorSummaryById>(() => (
    buildErrorSummaryById(normalizedTransformErrorRows, {
      getId: (row) => row.featureId ?? undefined,
      getMessage: (row) => row.message ?? undefined,
    })
  ), [normalizedTransformErrorRows]);

  const errorSummaryById = useMemo<MapPreviewErrorSummaryById>(() => {
    if (featureListRows.length === 0) return baseErrorSummaryById;
    const aggregated = new Map(baseErrorSummaryById);
    featureListRows.forEach((row) => {
      if (!row.memberFeatureIds || row.memberFeatureIds.length === 0) return;
      const groupId = String(row.featureId ?? row.id ?? '');
      if (!groupId) return;
      let count = 0;
      const messages: string[] = [];
      row.memberFeatureIds.forEach((memberId) => {
        const summary = baseErrorSummaryById.get(String(memberId));
        if (!summary) return;
        count += summary.count;
        if (summary.messages.length > 0) {
          messages.push(...summary.messages);
        }
      });
      if (count > 0) {
        aggregated.set(groupId, { count, messages });
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
        const adminKey = featureToAdminKey.get(memberId);
        if (adminKey) addMembers(adminGroupMembers.get(adminKey));
        const countryKey = featureToCountryKey.get(memberId);
        if (countryKey) addMembers(countryGroupMembers.get(countryKey));
      });
    });
    return Array.from(result);
  }, [adminGroupMembers, countryGroupMembers, featureToAdminKey, featureToCountryKey, rowIdToMembers]);

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

  useEffect(() => {
    const entries = expandedMatchedIds.map((id) => buildMapEntry(String(id)));
    setMapSearchMatches(entries);
  }, [buildMapEntry, expandedMatchedIds, setMapSearchMatches]);

  useEffect(() => {
    const entries = expandedSelectedIds.map((id) => buildMapEntry(String(id)));
    setMapSelectedMatches(entries);
  }, [buildMapEntry, expandedSelectedIds, setMapSelectedMatches]);

  useEffect(() => {
    if (expandedHoverIds.length === 0) {
      setMapHoverMatches([]);
      return;
    }
    setMapHoverMatches(expandedHoverIds.map((id) => buildMapEntry(String(id))));
  }, [buildMapEntry, expandedHoverIds, setMapHoverMatches]);

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

  const tileDataProvider = useCallback<NonNullable<MapWithVectorTilesProps['tileDataProvider']>>(
    async (z: number, x: number, y: number, nodeId?: string) => {
      const resolvedNodeId = nodeId ?? (activeNodeId ? String(activeNodeId) : undefined);
      if (!resolvedNodeId) return null;
      const data = await fetchTile(resolvedNodeId, z, x, y);
      if (!data) return null;
      return data;
    },
    [activeNodeId],
  );

  return {
    t,
    theme,
    metadataEnabled,
    sourceMetadataRows,
    sourceMetadataLoading,
    sourceMetadataError,
    sourceMetadataLoaded,
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
    hoveredId,
    setHoveredId,
    selectionContext,
    setSelectionContext,
    errorSummaryById,
    matchedFeatureIdSet,
    selectedIdSet,
    hoveredIdSet,
    hoverMessage,
    tilesUrl,
    tilesLayer,
    nodeId: activeNodeId,
    tilesAvailable,
    tilesChecking,
    processingStatus,
    tileDbName,
    tileDataProvider,
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
