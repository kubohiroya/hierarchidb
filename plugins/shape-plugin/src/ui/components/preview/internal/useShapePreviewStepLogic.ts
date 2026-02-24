import { useCallback, useEffect, useMemo, useRef, useState, type MutableRefObject } from 'react';
import { useTheme } from '@mui/material/styles';
import type {
  DataSourceName,
  FetchTaskPayload,
  ShapeEntity,
} from '~/common/types/index';
import { isShapePreviewMetadataEnabled } from '~/common/config/previewFlags';
import { toNodeId, type NodeId } from '@hierarchidb/core-types';
import { useTranslation } from '~/ui/i18n';
import type { ShapeFeatureMetadata, ShapeDataSourceMetadata, ShapeTransformErrorRecord } from '@hierarchidb/shape-api';
import { useAtom, useAtomValue, useSetAtom } from 'jotai';
import {
  shapePreviewSearchAtom,
  shapePreviewMatchedIdsAtom,
  shapePreviewSelectedIdsAtom,
  shapePreviewHoveredIdAtom,
  shapePreviewSelectionContextAtom,
} from '~/ui/atoms/shapePreviewAtoms';
import type {
  MapHighlightEntry,
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
//import { getShapeDbAPIClient } from '../../../services/build/ShapeBuildAPIClient.ts';
import { getWorkerClientHook, type WorkerClientRef } from '@hierarchidb/ui-worker-provider';
import { shapeQueryAPIImpl } from '~/services/build/ShapeBuildAPIClient';
import type { ShapePreviewDraft as PreviewDraftType } from './useShapePreviewStepUtils';
import {
  DEFAULT_BOUNDS_MARGIN,
  DEFAULT_VIEW,
  MIN_BOUNDS_MARGIN,
  buildHoverLabel,
  buildLookupKey,
  isNumericId,
  normalizeCountryCodeValue,
  normalizeText,
  parseSourceKey,
  parseVectorTileLayerNames,
  fetchTile,
  resolveAdminLevelFromProps,
  resolvePersistedViewState,
} from './useShapePreviewStepUtils';
import { useShapePreviewFeatureSection } from './useShapePreviewStepFeatureSection';

type ShapePreviewDraft = PreviewDraftType;

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

  const {
    featureListRows,
    rowIdToMembers,
    featureToCountryKey,
    countryGroupMembers,
    errorSummaryById,
    toggleRecyclingForSelection,
  } = useShapePreviewFeatureSection({
    featureMetadataRows,
    normalizedTransformErrorRows,
    resolveSourceContext,
    setFeatureMetadataOverride,
  });

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

  const wrappedToggleRecyclingForSelection = useCallback(async () => {
    await toggleRecyclingForSelection(selectedFeatureIds);
  }, [toggleRecyclingForSelection, selectedFeatureIds]);

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
      const names = parseVectorTileLayerNames(data);
      if (names.length === 0) {
        return data;
      }
      const current = tileLayerNamesRef.current;
      if (!current) {
        tileLayerNamesRef.current = new Set(names);
        setTileLayerNames(names);
        return data;
      }
      let changed = false;
      const next = new Set(current);
      names.forEach((name) => {
        if (!next.has(name)) {
          next.add(name);
          changed = true;
        }
      });
      if (changed) {
        tileLayerNamesRef.current = next;
        setTileLayerNames(Array.from(next));
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
    toggleRecyclingForSelection: wrappedToggleRecyclingForSelection,
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
