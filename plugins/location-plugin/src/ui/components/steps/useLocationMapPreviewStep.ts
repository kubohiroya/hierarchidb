import { useFloatingWindow } from '@hierarchidb/components';
import type { NodeId } from '@hierarchidb/core-types';
import type { IdeGsmImportProgress } from '@hierarchidb/location-api';
import { useTranslation } from '@hierarchidb/ui-i18n';
import type { MapAttributionItem, MapToggleSelection, MapViewState } from '@hierarchidb/ui-map';
import { DEFAULT_MAP_CONFIG } from '@hierarchidb/ui-map';
import { useWorkerAPI } from '@hierarchidb/ui-worker-provider';
import { LocationCity } from '@mui/icons-material';
import { useTheme } from '@mui/material';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { resolveLocationAttribution } from '~/common/datasources/resolveLocationAttribution';
import type { LocationEntity, LocationType } from '~/common/types/index';
import { useIdeGsmImportOnEntry } from '~/ui/hooks/useIdeGsmImportOnEntry';
import { subscribeIdeGsmProgress } from '~/ui/state/ideGsmProgressUtils';
import type {
  LocationTerrainToggleOption,
  LocationTypeFormatterProps,
} from './LocationMapPreviewStepElements.js';
import { DEFAULT_TYPE_COLORS } from './locationMapPreviewConstants.js';
import { resolveCountryFlag } from './locationMapPreviewUtils.js';
import { LOCATION_TYPE_STYLES } from './locationTypes.js';
import { useLocationMapPreviewMap } from './useLocationMapPreviewMap.js';
import {
  buildMetadataColumns,
  useLocationMapPreviewMetadata,
} from './useLocationMapPreviewMetadata.js';
import { useLocationPreviewConfig } from './useLocationPreviewConfig.js';

const LOCATION_TYPE_OPTIONS = (
  Object.entries(LOCATION_TYPE_STYLES) as Array<
    [LocationType, (typeof LOCATION_TYPE_STYLES)[LocationType]]
  >
).map(([key, value]) => {
  const Icon = value.icon;
  return {
    id: key,
    label: key,
    Icon,
  };
});

const buildInitialViewState = (bbox?: [number, number, number, number]): MapViewState => {
  if (!bbox) return DEFAULT_MAP_CONFIG.viewState;
  const [minLon, minLat, maxLon, maxLat] = bbox;
  const longitude = (minLon + maxLon) / 2;
  const latitude = (minLat + maxLat) / 2;
  return {
    longitude: Number.isFinite(longitude) ? longitude : DEFAULT_MAP_CONFIG.viewState.longitude,
    latitude: Number.isFinite(latitude) ? latitude : DEFAULT_MAP_CONFIG.viewState.latitude,
    zoom: DEFAULT_MAP_CONFIG.viewState.zoom,
  };
};

const parseBooleanFlag = (value: string | null): boolean => {
  if (value === null) return false;
  const normalized = value.trim().toLowerCase();
  return normalized === '1' || normalized === 'true' || normalized === 'on' || normalized === 'yes';
};

const isLocationMvtEnabled = (): boolean => {
  if (typeof window === 'undefined') return false;
  const params = new URLSearchParams(window.location.search);
  const queryValue = params.get('hdbLocationMvt');
  if (queryValue !== null) return parseBooleanFlag(queryValue);
  return parseBooleanFlag(window.localStorage.getItem('hdbLocationMvt'));
};

export const useLocationMapPreviewStep = ({
  draft,
  nodeId,
  onUpdate,
}: {
  draft: Partial<LocationEntity>;
  nodeId?: NodeId;
  onUpdate?: (updates: Partial<LocationEntity>) => void;
}) => {
  const { t } = useTranslation('location-plugin');
  const theme = useTheme();
  const [ideGsmProgress, setIdeGsmProgress] = useState<IdeGsmImportProgress | null>(null);
  const [metadataWindowOpen, setMetadataWindowOpen] = useState(true);
  const { api: workerApi, loading: workerLoading, error: workerError } = useWorkerAPI();

  useIdeGsmImportOnEntry({ draft, nodeId, onUpdate });
  const [rowFilterMode, setRowFilterMode] = useState<'all' | 'viewport'>('all');
  const [rowSearchOnly, setRowSearchOnly] = useState(true);
  const [locationTypeSelection, setLocationTypeSelection] = useState<MapToggleSelection>(
    () =>
      Object.fromEntries(
        LOCATION_TYPE_OPTIONS.map((option) => [option.id, true])
      ) as MapToggleSelection
  );

  const { tilesMaxZoom, representationConfig, iconConfig, labelConfig } =
    useLocationPreviewConfig(draft);

  const metadataRefreshKey = useMemo(
    () =>
      `${draft.ideGsmSelectionHash ?? ''}|${draft.lastProcessedAt ?? ''}|${draft.processedAt ?? ''}|${draft.processingStatus ?? ''}`,
    [draft.ideGsmSelectionHash, draft.lastProcessedAt, draft.processedAt, draft.processingStatus]
  );

  const {
    metadataRows,
    metadataLoading,
    metadataLoadingText,
    metadataError,
    selectedMetadataIds,
    handleMetadataSelectionChange,
    recyclingState,
    handleToggleRecycling,
    metadataById,
  } = useLocationMapPreviewMetadata({
    nodeId,
    workerApi,
    workerLoading,
    workerError,
    refreshKey: metadataRefreshKey,
  });

  const {
    previewPoints,
    locationVectorLayers,
    locationGeoJsonLayers,
    locationPreviewSnackbarProps,
    hoverMatches,
    handleMapLoad,
    handleMapMoveEnd,
  } = useLocationMapPreviewMap({
    nodeId,
    workerApi,
    workerLoading,
    workerError,
    locationTypeSelection,
    iconConfig,
    labelConfig,
    representationConfig,
    tilesMaxZoom,
    metadataById,
    t,
    isDarkMode: theme.palette.mode === 'dark',
    refreshKey: metadataRefreshKey,
    mvtEnabled: isLocationMvtEnabled(),
  });

  const filteredMetadataRows = useMemo(() => {
    if (!metadataRows.length) return metadataRows;
    return metadataRows.filter((row) => {
      const type = typeof row.type === 'string' ? row.type : undefined;
      if (!type) return false;
      return Boolean(locationTypeSelection[type]);
    });
  }, [metadataRows, locationTypeSelection]);

  const viewportRowIds = useMemo(
    () => new Set(previewPoints.map((point) => String(point.id))),
    [previewPoints]
  );

  const displayedMetadataRows = useMemo(() => {
    if (rowFilterMode !== 'viewport') return filteredMetadataRows;
    if (viewportRowIds.size === 0) return [];
    return filteredMetadataRows.filter((row) => viewportRowIds.has(String(row.id)));
  }, [filteredMetadataRows, rowFilterMode, viewportRowIds]);

  const displayedMetadataColumns = useMemo(
    () => buildMetadataColumns(displayedMetadataRows),
    [displayedMetadataRows]
  );

  useEffect(() => {
    if (!nodeId) return;
    return subscribeIdeGsmProgress(nodeId, setIdeGsmProgress);
  }, [nodeId]);

  const ideGsmProgressValue = useMemo(() => {
    if (!ideGsmProgress) return null;
    const total = ideGsmProgress.total ?? 0;
    const processed = ideGsmProgress.processed ?? 0;
    if (total <= 0) return null;
    return Math.min(100, Math.max(0, (processed / total) * 100));
  }, [ideGsmProgress]);

  const showIdeGsmProgress = ideGsmProgress?.phase === 'save';

  const terrainToggleOptions = useMemo<LocationTerrainToggleOption[]>(
    () =>
      LOCATION_TYPE_OPTIONS.map((option) => {
        const type = option.id as LocationType;
        const Icon = LOCATION_TYPE_STYLES[type]?.icon ?? LocationCity;
        const iconColor = iconConfig[type]?.color ?? DEFAULT_TYPE_COLORS[type];
        const labelColor = labelConfig[type]?.color ?? DEFAULT_TYPE_COLORS[type];
        return {
          id: option.id as LocationType,
          label: t(`locationTypes.${type}`, option.label),
          Icon,
          iconColor,
          labelColor,
        };
      }),
    [iconConfig, labelConfig, t]
  );

  const terrainWindow = useFloatingWindow({
    persistKey: 'hierarchidb:ui:floating-window:location:terrain',
    initialPosition: { x: 80, y: 40 },
    initialSize: { width: 280, height: 280 },
  });

  const admin0FormatterProps = {
    resolveFlag: resolveCountryFlag,
  };

  const typeFormatterProps: Omit<LocationTypeFormatterProps, 'value'> = {
    iconConfig,
    t,
  };

  const styleConfigWindow = useFloatingWindow({
    persistKey: 'hierarchidb:ui:floating-window:location:style-config',
    initialPosition: { x: 680, y: 40 },
    initialSize: { width: 520, height: 640 },
  });

  const dataSourceAttribution = useMemo(
    () => resolveLocationAttribution(draft.dataSource ?? null),
    [draft.dataSource]
  );

  const attributionItems = useMemo<MapAttributionItem[]>(() => {
    if (!dataSourceAttribution) return [];
    return [
      {
        id: `location:${dataSourceAttribution.id}`,
        label: dataSourceAttribution.label,
        attribution: dataSourceAttribution.attribution,
        url: dataSourceAttribution.url,
        license: dataSourceAttribution.license,
        licenseUrl: dataSourceAttribution.licenseUrl,
      },
    ];
  }, [dataSourceAttribution]);

  const handleLocationToggle = useCallback((id: string) => {
    setLocationTypeSelection((prev) => ({ ...prev, [id]: !prev[id] }));
  }, []);

  const initialViewState = useMemo(() => buildInitialViewState(undefined), []);

  return {
    t,
    initialViewState,
    locationVectorLayers,
    locationGeoJsonLayers,
    attributionItems,
    locationPreviewSnackbarProps,
    hoverMatches,
    handleMapLoad,
    handleMapMoveEnd,
    showIdeGsmProgress,
    ideGsmProgressValue,
    metadataWindowOpen,
    setMetadataWindowOpen,
    displayedMetadataRows,
    displayedMetadataColumns,
    typeFormatterProps,
    admin0FormatterProps,
    metadataLoading,
    metadataLoadingText,
    metadataError,
    selectedMetadataIds,
    handleMetadataSelectionChange,
    recyclingState,
    handleToggleRecycling,
    rowFilterMode,
    setRowFilterMode,
    rowSearchOnly,
    setRowSearchOnly,
    terrainToggleOptions,
    locationTypeSelection,
    handleLocationToggle,
    styleConfigWindow,
    terrainWindow,
    tilesMaxZoom,
    representationConfig,
    iconConfig,
    labelConfig,
  };
};
