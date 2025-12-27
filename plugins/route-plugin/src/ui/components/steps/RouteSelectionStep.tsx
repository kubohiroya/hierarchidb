/**
 * RouteSelectionStep - Step 3 of route creation dialog.
 * Configures transport/method and selects start/end locations from sibling location nodes.
 */

import type React from 'react';
import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Alert,
  Autocomplete,
  Box,
  CircularProgress,
  Divider,
  Grid,
  MenuItem,
  TextField,
  Typography,
} from '@mui/material';
import { findRelatedNodesByPriority } from '@hierarchidb/common-api';
import type { NodeId, NodeType, TreeNode } from '@hierarchidb/common-types';
import { useWorkerAPI } from '@hierarchidb/ui-worker-provider';
import type {
  RouteEntity,
  RouteGenerationMethod,
  RouteGenerationOptions,
  RouteUpdaterPayload,
} from '../../../common/entities/RouteEntity.js';
import { useTranslation } from '../../../common/i18n/index.js';
import { getRouteUpdaterPayload } from '../../../common/utils/draft.js';

export interface RouteSelectionStepProps {
  draft: RouteUpdaterPayload;
  onUpdate: (updates: Partial<RouteEntity>) => void;
  onValidationChange: (isValid: boolean) => void;
  mode: 'create' | 'edit';
  nodeId?: string;
  parentId?: string;
}

const TRANSPORT_MODE_OPTIONS = [
  {
    id: 'air',
    labelKey: 'transportModes.air',
    baseMode: 'air',
    detail: { transportSelection: 'air' },
  },
  {
    id: 'sea',
    labelKey: 'transportModes.sea',
    baseMode: 'sea',
    detail: { transportSelection: 'sea' },
  },
  {
    id: 'rail',
    labelKey: 'transportModes.rail',
    baseMode: 'rail',
    detail: { transportSelection: 'rail', railType: 'conventional' },
  },
  {
    id: 'high-speed-rail',
    labelKey: 'transportModes.highSpeedRail',
    baseMode: 'rail',
    detail: { transportSelection: 'high-speed-rail', railType: 'high-speed' },
  },
  {
    id: 'highway',
    labelKey: 'transportModes.highway',
    baseMode: 'road',
    detail: { transportSelection: 'highway', roadType: 'highway' },
  },
  {
    id: 'road',
    labelKey: 'transportModes.road',
    baseMode: 'road',
    detail: { transportSelection: 'road', roadType: 'general' },
  },
] as const;

type TransportOption = typeof TRANSPORT_MODE_OPTIONS[number];

const ROUTE_METHOD_OPTIONS: Array<{ id: RouteGenerationMethod; labelKey: string }> = [
  { id: 'direct', labelKey: 'routeGeneration.direct' },
  { id: 'great_circle', labelKey: 'routeGeneration.greatCircle' },
  { id: 'searoute', labelKey: 'routeGeneration.searoute' },
  { id: 'osm_route', labelKey: 'routeGeneration.osm' },
];

const getTransportOption = (draft: Partial<RouteEntity>): TransportOption | undefined => {
  const selection = draft.transportSelection;
  if (typeof selection === 'string') {
    return TRANSPORT_MODE_OPTIONS.find((option) => option.id === selection);
  }
  const baseMode = draft.transportMode;
  return TRANSPORT_MODE_OPTIONS.find((option) => option.baseMode === baseMode);
};

export const RouteSelectionStep: React.FC<RouteSelectionStepProps> = ({
  draft: draftProp,
  onUpdate,
  onValidationChange,
  mode,
  nodeId,
  parentId,
}) => {
  const { t } = useTranslation();
  const { api, loading: apiLoading, error: apiError } = useWorkerAPI();
  const draft = useMemo(() => getRouteUpdaterPayload(draftProp), [draftProp]);
  const [locations, setLocations] = useState<TreeNode[]>([]);
  const [loadingLocations, setLoadingLocations] = useState(false);
  const [locationError, setLocationError] = useState<string | null>(null);

  const transportOption = useMemo(() => getTransportOption(draft), [draft]);
  const generationMethod = (draft.generationMethod as RouteGenerationMethod | undefined) ?? 'direct';
  const generationOptions = useMemo<RouteGenerationOptions>(
    () => draft.generationOptions ?? {},
    [draft.generationOptions],
  );

  const locationOptions = useMemo(() => {
    return [...locations].sort((a, b) => {
      const nameA = a.metadata?.name ?? '';
      const nameB = b.metadata?.name ?? '';
      return nameA.localeCompare(nameB);
    });
  }, [locations]);

  const selectedStart = locationOptions.find((loc) => loc.id === draft.startLocationId) ?? null;
  const selectedEnd = locationOptions.find((loc) => loc.id === draft.endLocationId) ?? null;

  const emitUpdate = useCallback(
    (updates: Partial<RouteEntity>) => {
      onUpdate({
        ...updates,
      });
    },
    [onUpdate],
  );

  useEffect(() => {
    const isValid = Boolean(
      draft.transportMode &&
      draft.generationMethod &&
      draft.startLocationId &&
      draft.endLocationId,
    );
    onValidationChange(isValid);
  }, [draft.endLocationId, draft.generationMethod, draft.startLocationId, draft.transportMode, onValidationChange]);

  useEffect(() => {
    let active = true;
    const loadLocations = async () => {
      if (!api) return;
      setLoadingLocations(true);
      setLocationError(null);
      try {
        const query = await api.getQueryAPI();
        let resolvedParentId: NodeId | null = null;

        if (mode === 'create' && parentId) {
          resolvedParentId = parentId as NodeId;
        } else if (nodeId) {
          const node = await query.getNode(nodeId as NodeId);
          resolvedParentId = node?.parentId ?? null;
        }

        if (!resolvedParentId) {
          setLocations([]);
          return;
        }

        const nextLocations = await findRelatedNodesByPriority(query, {
          parentId: resolvedParentId,
          nodeTypes: ['location' as NodeType],
        });

        if (active) {
          setLocations(nextLocations);
        }
      } catch (error) {
        if (active) {
          setLocationError(error instanceof Error ? error.message : t('routeConfig.locationLoadError', 'Failed to load locations.'));
        }
      } finally {
        if (active) {
          setLoadingLocations(false);
        }
      }
    };

    void loadLocations();

    return () => {
      active = false;
    };
  }, [api, mode, nodeId, parentId, t]);

  const handleTransportChange = useCallback(
    (value: string) => {
      const option = TRANSPORT_MODE_OPTIONS.find((item) => item.id === value) ?? TRANSPORT_MODE_OPTIONS[0];
      const detail = option.detail;
      emitUpdate({
        transportMode: option.baseMode as RouteEntity['transportMode'],
        transportModes: [option.baseMode] as RouteEntity['transportModes'],
        transportSelection: detail.transportSelection,
        railType: 'railType' in detail ? detail.railType : undefined,
        roadType: 'roadType' in detail ? detail.roadType : undefined,
      });
    },
    [emitUpdate],
  );

  const handleMethodChange = useCallback(
    (value: RouteGenerationMethod) => {
      emitUpdate({
        generationMethod: value,
      });
    },
    [emitUpdate],
  );

  const handleGenerationOptionChange = useCallback(
    (updates: Partial<RouteGenerationOptions>) => {
      const nextOptions: RouteGenerationOptions = {
        ...generationOptions,
        ...updates,
      };
      emitUpdate({ generationOptions: nextOptions });
    },
    [emitUpdate, generationOptions],
  );

  useEffect(() => {
    if (!draft.transportMode) {
      handleTransportChange(transportOption?.id ?? TRANSPORT_MODE_OPTIONS[0].id);
    }
  }, [draft.transportMode, handleTransportChange, transportOption]);

  useEffect(() => {
    if (!draft.generationMethod) {
      handleMethodChange('direct');
    }
  }, [draft.generationMethod, handleMethodChange]);

  return (
    <Box sx={{ width: '100%' }}>
      <Typography variant="h6" gutterBottom>
        {t('routeConfig.title', 'Transport & Endpoints')}
      </Typography>

      <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
        {t('routeConfig.description', 'Define how the route is generated and select the start/end locations.')}
      </Typography>

      <Grid container spacing={3} columns={{ xs: 12 }}>
        <Grid size={{ xs: 12, md: 6 }}>
          <TextField
            select
            fullWidth
            label={t('routeConfig.transportModeLabel', 'Transport mode')}
            value={transportOption?.id ?? TRANSPORT_MODE_OPTIONS[0].id}
            onChange={(event) => handleTransportChange(event.target.value)}
            helperText={t('routeConfig.transportModeHelperText', 'Choose the primary transport mode for this route.')}
          >
            {TRANSPORT_MODE_OPTIONS.map((option) => (
              <MenuItem key={option.id} value={option.id}>
                {t(option.labelKey, option.id)}
              </MenuItem>
            ))}
          </TextField>
        </Grid>

        <Grid size={{ xs: 12, md: 6 }}>
          <TextField
            select
            fullWidth
            label={t('routeConfig.routeTypeLabel', 'Route type')}
            value={generationMethod}
            onChange={(event) => handleMethodChange(event.target.value as RouteGenerationMethod)}
            helperText={t('routeConfig.routeTypeHelperText', 'Choose the method used to generate the route geometry.')}
          >
            {ROUTE_METHOD_OPTIONS.map((option) => (
              <MenuItem key={option.id} value={option.id}>
                {t(option.labelKey, option.id)}
              </MenuItem>
            ))}
          </TextField>
        </Grid>
      </Grid>

      {(generationMethod === 'searoute' || generationMethod === 'osm_route') && (
        <Box sx={{ mt: 3 }}>
          <Typography variant="subtitle1" gutterBottom>
            {generationMethod === 'searoute'
              ? t('routeConfig.searouteSettings', 'Searoute settings')
              : t('routeConfig.osmSettings', 'OpenStreetMap settings')}
          </Typography>
          <Grid container spacing={2} columns={{ xs: 12 }}>
            {generationMethod === 'searoute' && (
              <>
                <Grid size={{ xs: 12, md: 6 }}>
                  <TextField
                    fullWidth
                    label={t('routeConfig.searoutePreferredChannels', 'Preferred channels')}
                    value={(generationOptions.preferredChannels ?? []).join(', ')}
                    onChange={(event) =>
                      handleGenerationOptionChange({
                        preferredChannels: event.target.value
                          .split(',')
                          .map((value) => value.trim())
                          .filter(Boolean),
                      })
                    }
                    helperText={t('routeConfig.searoutePreferredChannelsHelp', 'Comma-separated channel names (optional).')}
                  />
                </Grid>
                <Grid size={{ xs: 12, md: 6 }}>
                  <TextField
                    select
                    fullWidth
                    label={t('routeConfig.searouteAvoidCanals', 'Avoid canals')}
                    value={generationOptions.avoidCanals ? 'yes' : 'no'}
                    onChange={(event) =>
                      handleGenerationOptionChange({ avoidCanals: event.target.value === 'yes' })
                    }
                  >
                    <MenuItem value="no">{t('routeConfig.no', 'No')}</MenuItem>
                    <MenuItem value="yes">{t('routeConfig.yes', 'Yes')}</MenuItem>
                  </TextField>
                </Grid>
              </>
            )}

            {generationMethod === 'osm_route' && (
              <>
                <Grid size={{ xs: 12, md: 6 }}>
                  <TextField
                    select
                    fullWidth
                    label={t('routeConfig.osmProfile', 'Routing profile')}
                    value={generationOptions.osmProfile ?? 'car'}
                    onChange={(event) =>
                      handleGenerationOptionChange({ osmProfile: event.target.value as RouteGenerationOptions['osmProfile'] })
                    }
                  >
                    <MenuItem value="car">{t('routeConfig.osmProfileCar', 'Car')}</MenuItem>
                    <MenuItem value="bike">{t('routeConfig.osmProfileBike', 'Bike')}</MenuItem>
                    <MenuItem value="foot">{t('routeConfig.osmProfileFoot', 'Foot')}</MenuItem>
                    <MenuItem value="truck">{t('routeConfig.osmProfileTruck', 'Truck')}</MenuItem>
                  </TextField>
                </Grid>
                <Grid size={{ xs: 12, md: 6 }}>
                  <TextField
                    fullWidth
                    label={t('routeConfig.osrmBaseUrl', 'OSRM base URL')}
                    value={generationOptions.osrmBaseUrl ?? ''}
                    onChange={(event) => handleGenerationOptionChange({ osrmBaseUrl: event.target.value })}
                    helperText={t('routeConfig.osrmBaseUrlHelp', 'Optional override for the OSRM endpoint.')}
                  />
                </Grid>
                <Grid size={{ xs: 12, md: 6 }}>
                  <TextField
                    select
                    fullWidth
                    label={t('routeConfig.osmAvoidTolls', 'Avoid tolls')}
                    value={generationOptions.avoidTolls ? 'yes' : 'no'}
                    onChange={(event) =>
                      handleGenerationOptionChange({ avoidTolls: event.target.value === 'yes' })
                    }
                  >
                    <MenuItem value="no">{t('routeConfig.no', 'No')}</MenuItem>
                    <MenuItem value="yes">{t('routeConfig.yes', 'Yes')}</MenuItem>
                  </TextField>
                </Grid>
                <Grid size={{ xs: 12, md: 6 }}>
                  <TextField
                    select
                    fullWidth
                    label={t('routeConfig.osmAvoidHighways', 'Avoid highways')}
                    value={generationOptions.avoidHighways ? 'yes' : 'no'}
                    onChange={(event) =>
                      handleGenerationOptionChange({ avoidHighways: event.target.value === 'yes' })
                    }
                  >
                    <MenuItem value="no">{t('routeConfig.no', 'No')}</MenuItem>
                    <MenuItem value="yes">{t('routeConfig.yes', 'Yes')}</MenuItem>
                  </TextField>
                </Grid>
              </>
            )}
          </Grid>
        </Box>
      )}

      <Divider sx={{ my: 3 }} />

      <Typography variant="subtitle1" gutterBottom>
        {t('routeConfig.locationSelectionTitle', 'Start and end locations')}
      </Typography>
      <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
        {t('routeConfig.locationSelectionDescription', 'Choose from sibling locations or descendant locations under sibling folders.')}
      </Typography>

      {(apiLoading || loadingLocations) && (
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 2 }}>
          <CircularProgress size={20} />
          <Typography variant="body2">{t('routeConfig.loadingLocations', 'Loading locations...')}</Typography>
        </Box>
      )}

      {apiError && (
        <Alert severity="warning" sx={{ mb: 2 }}>
          {t('routeConfig.locationApiUnavailable', 'Worker API is not ready yet. Locations may be unavailable.')}
        </Alert>
      )}

      {locationError && (
        <Alert severity="error" sx={{ mb: 2 }}>
          {locationError}
        </Alert>
      )}

      {!loadingLocations && !locationError && locationOptions.length === 0 && (
        <Alert severity="info" sx={{ mb: 2 }}>
          {t('routeConfig.locationEmpty', 'No sibling locations are available yet.')}
        </Alert>
      )}

      <Grid container spacing={2} columns={{ xs: 12 }}>
        <Grid size={{ xs: 12, md: 6 }}>
          <Autocomplete
            options={locationOptions}
            value={selectedStart}
            getOptionLabel={(option) => option.metadata?.name ?? String(option.id)}
            isOptionEqualToValue={(option, value) => option.id === value.id}
            onChange={(_, value) => emitUpdate({ startLocationId: (value?.id as NodeId | undefined) })}
            renderInput={(params) => (
              <TextField
                {...params}
                label={t('routeConfig.startLocationLabel', 'Start location')}
                placeholder={t('routeConfig.locationPlaceholder', 'Select a location')}
              />
            )}
          />
        </Grid>
        <Grid size={{ xs: 12, md: 6 }}>
          <Autocomplete
            options={locationOptions}
            value={selectedEnd}
            getOptionLabel={(option) => option.metadata?.name ?? String(option.id)}
            isOptionEqualToValue={(option, value) => option.id === value.id}
            onChange={(_, value) => emitUpdate({ endLocationId: (value?.id as NodeId | undefined) })}
            renderInput={(params) => (
              <TextField
                {...params}
                label={t('routeConfig.endLocationLabel', 'End location')}
                placeholder={t('routeConfig.locationPlaceholder', 'Select a location')}
              />
            )}
          />
        </Grid>
      </Grid>
    </Box>
  );
};
