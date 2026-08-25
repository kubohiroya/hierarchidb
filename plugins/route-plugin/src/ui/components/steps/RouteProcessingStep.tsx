/**
 * RouteProcessingStep - Settings step for route creation dialog.
 * Configures shared build settings reused by the Shape pipeline.
 */

import type { NodeId } from '@hierarchidb/core-types';
import {
  ROUTE_MODES,
  type RouteBuildConfig,
  type RouteEntity,
  type RouteGenerationMethod,
  type RouteMethodSetting,
  type RouteMode,
} from '@hierarchidb/route-api';
import {
  BuildConfigShell,
  SourceConfigSection,
  TileEmitConfigSection,
  ZoomBandConfigSection,
} from '@hierarchidb/ui-accordion-config';
import { useTranslation } from '@hierarchidb/ui-i18n';
import {
  FormControl,
  Grid,
  InputLabel,
  MenuItem,
  Select,
  Stack,
  TextField,
  Typography,
  type SelectChangeEvent,
} from '@mui/material';
import type React from 'react';
import { useCallback, useMemo } from 'react';
import { mergeRouteBuildConfig } from '~/common/config/buildConfig';
import {
  filteringHighUrl,
  filteringLowUrl,
  filteringMediumUrl,
} from '~/ui/assets/filtering-samples/filteringSampleConstants';
import { RouteGeometryBandValuesField } from './RouteGeometryBandValuesField.js';
import { useRouteBuildConfigStep } from './useRouteBuildConfigStep.js';

const LAND_ROUTE_MODES: RouteMode[] = [
  ROUTE_MODES.RAILWAY,
  ROUTE_MODES.H_RAILWAY,
  ROUTE_MODES.ROAD,
  ROUTE_MODES.HIGHWAY,
];

const LAND_METHODS: RouteGenerationMethod[] = ['direct', 'osm_route', 'custom'];

export interface RouteProcessingStepProps {
  draft: Partial<RouteEntity>;
  onUpdate: (updates: Partial<RouteEntity>) => void;
  nodeId?: NodeId;
  disabled?: boolean;
}

export const RouteProcessingStep: React.FC<RouteProcessingStepProps> = ({
  draft,
  onUpdate,
  disabled,
}) => {
  const { t } = useTranslation('route-plugin');
  const { config, handleChange } = useRouteBuildConfigStep({
    data: draft,
    onChange: onUpdate,
  });
  const updateBuildConfig = useCallback(
    (partial: Partial<RouteBuildConfig>) => {
      handleChange(mergeRouteBuildConfig(config, partial));
    },
    [config, handleChange]
  );
  const filteringPreviewImages = useMemo(
    () => ({
      weak: filteringLowUrl,
      medium: filteringMediumUrl,
      strong: filteringHighUrl,
    }),
    []
  );
  const bandCount = config.geometryConfig.zoomBandBoundaries.length - 1;

  return (
    <BuildConfigShell padding={0} spacing={3}>
      <ZoomBandConfigSection
        t={t}
        boundaries={config.geometryConfig.zoomBandBoundaries}
        onBoundariesChange={(zoomBandBoundaries) =>
          updateBuildConfig({
            geometryConfig: {
              ...config.geometryConfig,
              zoomBandBoundaries,
            },
          })
        }
        disabled={disabled}
      />
      <SourceConfigSection
        t={t}
        buildConfig={config}
        update={updateBuildConfig}
        filteringPreviewImages={filteringPreviewImages}
        disabled={disabled}
      />
      <TileEmitConfigSection
        t={t}
        buildConfig={config}
        update={updateBuildConfig}
        disabled={disabled}
      />
      <RouteMethodSettingsSection
        config={config}
        update={updateBuildConfig}
        disabled={disabled}
      />
      <Stack spacing={1.5}>
        <Typography variant="subtitle2">
          {t('processing.routeTransform.title', 'Route geometry by zoom band')}
        </Typography>
        <Typography variant="body2" color="text.secondary">
          {t(
            'processing.routeTransform.description',
            'Provide comma-separated values per band (same order as zoom bands).'
          )}
        </Typography>
        <RouteGeometryBandValuesField
          label={t('processing.routeTransform.minDistance', 'Min distance per band (meters)')}
          values={config.routeGeometryConfig.minDistanceMetersByBand}
          bandCount={bandCount}
          onValuesChange={(minDistanceMetersByBand) => {
            updateBuildConfig({
              routeGeometryConfig: {
                ...config.routeGeometryConfig,
                minDistanceMetersByBand,
              },
            });
          }}
          disabled={disabled}
        />
        <RouteGeometryBandValuesField
          label={t('processing.routeTransform.tolerance', 'Geometry simplify tolerance per band')}
          values={config.routeGeometryConfig.simplifyToleranceByBand}
          bandCount={bandCount}
          onValuesChange={(simplifyToleranceByBand) => {
            updateBuildConfig({
              routeGeometryConfig: {
                ...config.routeGeometryConfig,
                simplifyToleranceByBand,
              },
            });
          }}
          disabled={disabled}
        />
      </Stack>
    </BuildConfigShell>
  );
};

interface RouteMethodSettingsSectionProps {
  config: RouteBuildConfig;
  update: (partial: Partial<RouteBuildConfig>) => void;
  disabled?: boolean;
}

const RouteMethodSettingsSection: React.FC<RouteMethodSettingsSectionProps> = ({
  config,
  update,
  disabled,
}) => {
  const { t } = useTranslation('route-plugin');
  const bandCount = config.geometryConfig.zoomBandBoundaries.length - 1;
  const airwaySetting = resolveEffectiveRouteMethodSetting(config, ROUTE_MODES.AIRWAY);
  const airwayDetail = airwaySetting.greatCircle;
  const airwayBandPoints =
    airwayDetail?.numPointsByZoomBand ??
    Array.from({ length: bandCount }, () => airwayDetail?.numPoints ?? 96);

  const updateRouteModeSetting = useCallback(
    (routeMode: RouteMode, setting: RouteMethodSetting) => {
      update({
        routeMethodSettings: {
          defaults: config.routeMethodSettings.defaults,
          overrides: {
            ...(config.routeMethodSettings.overrides ?? {}),
            [routeMode]: setting,
          },
        },
      });
    },
    [config.routeMethodSettings.defaults, config.routeMethodSettings.overrides, update]
  );

  const handleLandMethodChange = useCallback(
    (routeMode: RouteMode) => (event: SelectChangeEvent<RouteGenerationMethod>) => {
      updateRouteModeSetting(routeMode, {
        ...resolveEffectiveRouteMethodSetting(config, routeMode),
        method: event.target.value as RouteGenerationMethod,
      });
    },
    [config, updateRouteModeSetting]
  );

  return (
    <Stack spacing={1.5}>
      <Typography variant="subtitle2">
        {t('processing.routeMethods.title', 'Route method settings')}
      </Typography>
      <Typography variant="body2" color="text.secondary">
        {t(
          'processing.routeMethods.description',
          'Configure per-node route generation methods before source planning materializes canonical build input.'
        )}
      </Typography>
      <Grid container spacing={2} columns={{ xs: 12 }}>
        <Grid size={{ xs: 12, md: 6 }}>
          <TextField
            label={t('processing.routeMethods.airwayMethod', 'Airway method')}
            value="great_circle"
            disabled
            fullWidth
          />
        </Grid>
        <Grid size={{ xs: 12, md: 6 }}>
          <TextField
            label={t('processing.routeMethods.waterwayMethod', 'Waterway method')}
            value="searoute"
            disabled
            fullWidth
          />
        </Grid>
        {LAND_ROUTE_MODES.map((routeMode) => {
          const label = t(`processing.routeMethods.${routeMode}`, routeMode);
          const setting = resolveEffectiveRouteMethodSetting(config, routeMode);
          return (
            <Grid key={routeMode} size={{ xs: 12, md: 6 }}>
              <FormControl fullWidth disabled={disabled}>
                <InputLabel id={`route-method-${routeMode}`}>{label}</InputLabel>
                <Select
                  labelId={`route-method-${routeMode}`}
                  label={label}
                  value={setting.method}
                  onChange={handleLandMethodChange(routeMode)}
                >
                  {LAND_METHODS.map((method) => (
                    <MenuItem key={method} value={method}>
                      {method}
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>
            </Grid>
          );
        })}
      </Grid>
      <RouteGeometryBandValuesField
        label={t('processing.routeMethods.airwayPoints', 'Airway great-circle points per band')}
        values={airwayBandPoints}
        bandCount={bandCount}
        onValuesChange={(numPointsByZoomBand) => {
          updateRouteModeSetting(ROUTE_MODES.AIRWAY, {
            method: 'great_circle',
            greatCircle: {
              numPoints: Math.max(...numPointsByZoomBand),
              numPointsByZoomBand,
            },
          });
        }}
        disabled={disabled}
      />
    </Stack>
  );
};

const resolveEffectiveRouteMethodSetting = (
  config: RouteBuildConfig,
  routeMode: RouteMode
): RouteMethodSetting => {
  const setting =
    config.routeMethodSettings.overrides?.[routeMode] ??
    config.routeMethodSettings.defaults[routeMode];
  if (setting === undefined) {
    throw new Error(`[RouteProcessingStep] route method setting is missing for ${routeMode}`);
  }
  return setting;
};
