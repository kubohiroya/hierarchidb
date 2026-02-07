import { useCallback, useEffect, useMemo, useState } from 'react';
import { Box, Typography, useTheme } from '@mui/material';
import type { NodeId } from '@hierarchidb/core-types';
import type { MapAttributionItem, MapToggleSelection, MapViewState } from '@hierarchidb/ui-map';
import { DEFAULT_MAP_CONFIG } from '@hierarchidb/ui-map';
import type { LocationEntity, LocationType } from '../../../common/types/index.js';
import { useTranslation } from '../../../common/i18n/index.js';
import { useFloatingWindow } from '@hierarchidb/ui-floating-window';
import { LOCATION_TYPE_STYLES } from './locationTypes.js';
import { resolveLocationAttribution } from '../../../common/datasources/attribution.js';
import { useWorkerAPI } from '@hierarchidb/ui-worker-provider';
import { useIdeGsmImportOnEntry } from '../../hooks/useIdeGsmImportOnEntry.js';
import { subscribeIdeGsmProgress } from '../../state/ideGsmProgress.js';
import type { IdeGsmImportProgress } from '@hierarchidb/location-api';
import {
  DEFAULT_ICON_IDS,
  DEFAULT_TYPE_COLORS,
  LOCATION_ICON_COMPONENTS,
} from './locationMapPreviewConstants.js';
import { resolveCountryFlag, resolveLocationType } from './locationMapPreviewUtils.js';
import { useLocationPreviewConfig } from './useLocationPreviewConfig.js';
import { buildMetadataColumns, useLocationMapPreviewMetadata } from './useLocationMapPreviewMetadata.js';
import { useLocationMapPreviewMap } from './useLocationMapPreviewMap.js';

const LOCATION_TYPE_OPTIONS = (Object.entries(LOCATION_TYPE_STYLES) as Array<
  [LocationType, (typeof LOCATION_TYPE_STYLES)[LocationType]]
>).map(([key, value]) => {
  const Icon = value.icon;
  return {
    id: key,
    label: key,
    icon: <Icon fontSize="small" />,
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
    initialize: initializeWorker,
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
    initializeWorker,
    refreshKey: metadataRefreshKey,
  });

  const {
    previewPoints,
    locationGeoJsonLayers,
    locationPreviewSnackbar,
    hoverMatches,
    handleMapLoad,
    handleMapMoveEnd,
  } = useLocationMapPreviewMap({
    nodeId,
    workerApi,
    workerLoading,
    workerError,
    initializeWorker,
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

  const admin0ColumnFormatter = useCallback((value: unknown, row: Record<string, unknown>) => {
    const name = typeof value === 'string' ? value : '';
    const code = typeof row.admin0Code === 'string' ? row.admin0Code : undefined;
    const flag = resolveCountryFlag(code);
    if (!name && !flag) return '';
    return (
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
        {flag ? <Typography variant="body2">{flag}</Typography> : null}
        <Typography variant="body2">{name}</Typography>
      </Box>
    );
  }, []);

  const typeColumnFormatter = useCallback((value: unknown) => {
    const rawType = typeof value === 'string' ? value : undefined;
    const type = rawType ? resolveLocationType(rawType) : 'area_centroid';
    const iconEntry = iconConfig[type];
    const iconId = iconEntry?.iconId ?? DEFAULT_ICON_IDS[type];
    const Icon = LOCATION_ICON_COMPONENTS[iconId] ?? LOCATION_TYPE_STYLES[type].icon;
    const color = iconEntry?.color ?? DEFAULT_TYPE_COLORS[type];
    const label = t(`locationTypes.${type}`, type);
    return (
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75 }}>
        <Icon fontSize="small" htmlColor={color} />
        <Typography variant="body2">{label}</Typography>
      </Box>
    );
  }, [iconConfig, t]);

  const terrainToggleOptions = useMemo(() => (
    LOCATION_TYPE_OPTIONS.map((option) => {
      const type = option.id as LocationType;
      const Icon = LOCATION_TYPE_STYLES[type].icon;
      const iconColor = iconConfig[type]?.color ?? DEFAULT_TYPE_COLORS[type];
      const labelColor = labelConfig[type]?.color ?? DEFAULT_TYPE_COLORS[type];
      return {
        id: option.id,
        label: translations.locationTypes?.[type] ?? option.label,
        icon: <Icon fontSize="small" htmlColor={iconColor} />,
        labelColor,
      };
    })
  ), [iconConfig, labelConfig, translations.locationTypes]);

  const terrainWindow = useFloatingWindow({
    persistKey: 'hierarchidb:ui:floating-window:location:terrain',
    initialPosition: { x: 80, y: 40 },
    initialSize: { width: 280, height: 280 },
  });

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
    locationPreviewSnackbar,
    hoverMatches,
    handleMapLoad,
    handleMapMoveEnd,
    showIdeGsmProgress,
    ideGsmProgressValue,
    metadataWindowOpen,
    setMetadataWindowOpen,
    displayedMetadataRows,
    displayedMetadataColumns,
    typeColumnFormatter,
    admin0ColumnFormatter,
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
