/**
 * RouteProcessingStep - Settings step for route creation dialog.
 * Configures shared build settings reused by the Shape pipeline.
 */

import type { NodeId } from '@hierarchidb/core-types';
import type { RouteBuildConfig, RouteEntity } from '@hierarchidb/route-api';
import {
  BuildConfigShell,
  SourceConfigSection,
  TileEmitConfigSection,
  ZoomBandConfigSection,
} from '@hierarchidb/ui-accordion-config';
import { useTranslation } from '@hierarchidb/ui-i18n';
import { Stack, TextField, Typography } from '@mui/material';
import type React from 'react';
import { useCallback, useMemo } from 'react';
import { mergeRouteBuildConfig } from '~/common/config/buildConfig';
import {
  filteringHighUrl,
  filteringLowUrl,
  filteringMediumUrl,
} from '~/ui/assets/filtering-samples/filteringSampleConstants';
import { useRouteBuildConfigStep } from './useRouteBuildConfigStep.js';

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
  const boundaries = config.geometryConfig.zoomBandBoundaries ?? [];
  const bandCount = Math.max(0, boundaries.length - 1);
  const minDistanceValue = useMemo(
    () =>
      (config.routeGeometryConfig?.minDistanceMetersByBand ?? []).slice(0, bandCount).join(', '),
    [bandCount, config.routeGeometryConfig?.minDistanceMetersByBand]
  );
  const simplifyToleranceValue = useMemo(
    () =>
      (config.routeGeometryConfig?.simplifyToleranceByBand ?? []).slice(0, bandCount).join(', '),
    [bandCount, config.routeGeometryConfig?.simplifyToleranceByBand]
  );
  const parseBandNumbers = useCallback(
    (raw: string): number[] =>
      raw
        .split(',')
        .map((entry) => Number(entry.trim()))
        .filter((entry) => Number.isFinite(entry))
        .slice(0, bandCount),
    [bandCount]
  );

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
      <Stack spacing={1.5}>
        <Typography variant="subtitle2">
          {t('route.processing.routeTransform.title', 'Route geometry by zoom band')}
        </Typography>
        <Typography variant="body2" color="text.secondary">
          {t(
            'route.processing.routeTransform.description',
            'Provide comma-separated values per band (same order as zoom bands).'
          )}
        </Typography>
        <TextField
          label={t('route.processing.routeTransform.minDistance', 'Min distance per band (meters)')}
          value={minDistanceValue}
          onChange={(event) => {
            updateBuildConfig({
              routeGeometryConfig: {
                ...config.routeGeometryConfig,
                minDistanceMetersByBand: parseBandNumbers(event.target.value),
              },
            });
          }}
          disabled={disabled}
          fullWidth
        />
        <TextField
          label={t(
            'route.processing.routeTransform.tolerance',
            'Geometry simplify tolerance per band'
          )}
          value={simplifyToleranceValue}
          onChange={(event) => {
            updateBuildConfig({
              routeGeometryConfig: {
                ...config.routeGeometryConfig,
                simplifyToleranceByBand: parseBandNumbers(event.target.value),
              },
            });
          }}
          disabled={disabled}
          fullWidth
        />
      </Stack>
    </BuildConfigShell>
  );
};
