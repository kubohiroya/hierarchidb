import { useCallback, useEffect, useMemo, useState } from 'react';
import { useTheme } from '@mui/material';
import type { NodeId } from '@hierarchidb/core-types';
import type { MapAttributionItem, MapToggleSelection, MapViewState } from '@hierarchidb/ui-map';
import { DEFAULT_MAP_CONFIG } from '@hierarchidb/ui-map';
import type { LocationEntity, LocationType } from '~/common/types/index';
import { useTranslation } from '~/common/i18n/index';
import { useFloatingWindow } from '@hierarchidb/ui-floating-window';
import { LOCATION_TYPE_STYLES } from './locationTypes.js';
import { resolveLocationAttribution } from '~/common/datasources/attribution';
import { useWorkerAPI } from '@hierarchidb/ui-worker-provider';
import { useIdeGsmImportOnEntry } from '~/ui/hooks/useIdeGsmImportOnEntry';
import { subscribeIdeGsmProgress } from '~/ui/state/ideGsmProgress';
import type { IdeGsmImportProgress } from '@hierarchidb/location-api';
import {
  DEFAULT_TYPE_COLORS,
} from './locationMapPreviewConstants.js';
import { resolveCountryFlag } from './locationMapPreviewUtils.js';
import { useLocationPreviewConfig } from './useLocationPreviewConfig.js';
import { buildMetadataColumns, useLocationMapPreviewMetadata } from './useLocationMapPreviewMetadata.js';
import type { LocationTerrainToggleOption, LocationTypeFormatterProps } from './LocationMapPreviewStepElements.js';
import { useLocationMapPreviewMap } from './useLocationMapPreviewMap.js';

const LOCATION_TYPE_OPTIONS = (Object.entries(LOCATION_TYPE_STYLES) as Array<
  [LocationType, (typeof LOCATION_TYPE_STYLES)[LocationType]]
>).map(([key, value]) => {
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

export const useLocationMapPreviewStep = ({
  draft,
  nodeId,
  onUpdate,
}: {
  draft: Partial<LocationEntity>;
  nodeId?: NodeId;
  onUpdate?: (updates: Partial<LocationEntity>) => void;
}) => {
  const { translations, t } = useTranslation();
  const theme = useTheme();
  const [ideGsmProgress, setIdeGsmProgress] = useState<IdeGsmImportProgress | null>(null);
  const [metadataWindowOpen, setMetadataWindowOpen] = useState(true);
  const {
    api: workerApi,
    loading: workerLoading,
    error: workerError,
  } = useWorkerAPI();

  useIdeGsmImportOnEntry({ draft, nodeId, onUpdate });
  const [rowFilterMode, setRowFilterMode] = useState<'all' | 'viewport'>('all');
  const [rowSearchOnly, setRowSearchOnly] = useState(true);
  const [locationTypeSelection, setLocationTypeSelection] = useState<MapToggleSelection>(() =>
    Object.fromEntries(LOCATION_TYPE_OPTIONS.map((option) => [option.id, true])) as MapToggleSelection
  );

  const {
    tilesMaxZoom,
    representationConfig,
    iconConfig,
    labelConfig,
  } = useLocationPreviewConfig(draft);

  const metadataRefreshKey = useMemo(
    () => `${draft.ideGsmSelectionHash ?? ''}|${draft.lastProcessedAt ?? ''}|${draft.processedAt ?? ''}|${draft.processingStatus ?? ''}`,
    [draft.ideGsmSelectionHash, draft.lastProcessedAt, draft.processedAt, draft.processingStatus],
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
  });

  const filteredMetadataRows = useMemo(() => {
    if (!metadataRows.length) return metadataRows;
    return metadataRows.filter((row) => {
      const type = typeof row.type === 'string' ? row.type : undefined;
      if (!type) return false;
      return Boolean(locationTypeSelection[type]);
    });
  }, [metadataRows, locationTypeSelection]);

  const viewportRowIds = useMemo(() => (
    new Set(previewPoints.map((point) => String(point.id)))
  ), [previewPoints]);

  const displayedMetadataRows = useMemo(() => {
    if (rowFilterMode !== 'viewport') return filteredMetadataRows;
    if (viewportRowIds.size === 0) return [];
    return filteredMetadataRows.filter((row) => viewportRowIds.has(String(row.id)));
  }, [filteredMetadataRows, rowFilterMode, viewportRowIds]);

  const displayedMetadataColumns = useMemo(
    () => buildMetadataColumns(displayedMetadataRows),
    [displayedMetadataRows],
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

  const terrainToggleOptions = useMemo<LocationTerrainToggleOption[]>(() => (
    LOCATION_TYPE_OPTIONS.map((option) => {
      const type = option.id as LocationType;
      const Icon = LOCATION_TYPE_STYLES[type].icon;
      const iconColor = iconConfig[type]?.color ?? DEFAULT_TYPE_COLORS[type];
      const labelColor = labelConfig[type]?.color ?? DEFAULT_TYPE_COLORS[type];
      return {
        id: option.id as LocationType,
        label: translations.locationTypes?.[type] ?? option.label,
        Icon,
        iconColor,
        labelColor,
      };
    })
  ), [iconConfig, labelConfig, translations.locationTypes]);

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
    [draft.dataSource],
  );

  const attributionItems = useMemo<MapAttributionItem[]>(() => {
    if (!dataSourceAttribution) return [];
    return [{
      id: `location:${dataSourceAttribution.id}`,
      label: dataSourceAttribution.label,
      attribution: dataSourceAttribution.attribution,
      url: dataSourceAttribution.url,
      license: dataSourceAttribution.license,
      licenseUrl: dataSourceAttribution.licenseUrl,
    }];
  }, [dataSourceAttribution]);

  const handleLocationToggle = useCallback((id: string) => {
    setLocationTypeSelection((prev) => ({ ...prev, [id]: !prev[id] }));
  }, []);

  const initialViewState = useMemo(
    () => buildInitialViewState(undefined),
    [],
  );

  return {
    t,
    translations,
    initialViewState,
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
