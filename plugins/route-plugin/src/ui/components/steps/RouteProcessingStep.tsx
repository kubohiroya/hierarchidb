/**
 * RouteProcessingStep - Settings step for route creation dialog.
 * Configures shared build settings reused by the Shape pipeline.
 */

import type React from 'react';
import { useCallback, useMemo } from 'react';
import { Stack, TextField, Typography } from '@mui/material';
import { BuildConfigShell, FetchConfigSection, VTConfigSection, ZoomBandConfigSection } from '@hierarchidb/ui-accordion-config';
import type { NodeId } from '@hierarchidb/core-types';
import type { BaseBuildConfig } from '@hierarchidb/gis-sdk';
import type { RouteEntity } from '@hierarchidb/route-api';
import { useTranslation } from '../../../common/i18n/index.js';
import { useRouteBuildConfigStep } from './useRouteBuildConfigStep.js';
import { mergeRouteBuildConfig } from '../../../common/config/buildConfig.js';
import {
  filteringHighUrl,
  filteringLowUrl,
  filteringMediumUrl,
} from '../../assets/filtering-samples/filteringSamples.ts';

export interface RouteProcessingStepProps {
  draft: Partial<RouteEntity>;
  onUpdate: (updates: Partial<RouteEntity>) => void;
  nodeId?: NodeId;
  disabled?: boolean;
}

type BuildConfig = BaseBuildConfig<string>;

export const RouteProcessingStep: React.FC<RouteProcessingStepProps> = ({
  draft,
  onUpdate,
  disabled,
}) => {
  const { t } = useTranslation();
  const { config, handleChange } = useRouteBuildConfigStep({
    data: draft,
    onChange: onUpdate,
  });
  const updateBuildConfig = useCallback((partial: Partial<BuildConfig>) => {
    handleChange(mergeRouteBuildConfig(config, partial));
  }, [config, handleChange]);
  const filteringPreviewImages = useMemo(() => ({
    weak: filteringLowUrl,
    medium: filteringMediumUrl,
    strong: filteringHighUrl,
  }), []);
  const boundaries = config.transformConfig.zoomBandBoundaries ?? [];
  const bandCount = Math.max(0, boundaries.length - 1);
  const minDistanceValue = useMemo(
    () => (config.routeTransformConfig?.minDistanceMetersByBand ?? []).slice(0, bandCount).join(', '),
    [bandCount, config.routeTransformConfig?.minDistanceMetersByBand],
  );
  const simplifyToleranceValue = useMemo(
    () => (config.routeTransformConfig?.simplifyToleranceByBand ?? []).slice(0, bandCount).join(', '),
    [bandCount, config.routeTransformConfig?.simplifyToleranceByBand],
  );
  const parseBandNumbers = useCallback((raw: string): number[] => (
    raw
      .split(',')
      .map((entry) => Number(entry.trim()))
      .filter((entry) => Number.isFinite(entry))
      .slice(0, bandCount)
  ), [bandCount]);

  return (
    <BuildConfigShell padding={0} spacing={3}>
      <ZoomBandConfigSection
        t={t}
        boundaries={config.transformConfig.zoomBandBoundaries}
        onBoundariesChange={(zoomBandBoundaries) =>
          updateBuildConfig({
            transformConfig: {
              ...config.transformConfig,
              zoomBandBoundaries,
            },
          })
        }
        disabled={disabled}
      />
      <FetchConfigSection
        t={t}
        buildConfig={config}
        update={updateBuildConfig}
        filteringPreviewImages={filteringPreviewImages}
        disabled={disabled}
      />
      <VTConfigSection
        t={t}
        buildConfig={config}
        update={updateBuildConfig}
        disabled={disabled}
      />
      <Stack spacing={1.5}>
        <Typography variant="subtitle2">
          {t('route.processing.routeTransform.title', 'Route transform by zoom band')}
        </Typography>
        <Typography variant="body2" color="text.secondary">
          {t(
            'route.processing.routeTransform.description',
            'Provide comma-separated values per band (same order as zoom bands).',
          )}
        </Typography>
        <TextField
          label={t('route.processing.routeTransform.minDistance', 'Min distance per band (meters)')}
          value={minDistanceValue}
          onChange={(event) => {
            updateBuildConfig({
              routeTransformConfig: {
                ...config.routeTransformConfig,
                minDistanceMetersByBand: parseBandNumbers(event.target.value),
              },
            });
          }}
          disabled={disabled}
          fullWidth
        />
        <TextField
          label={t('route.processing.routeTransform.tolerance', 'Simplify tolerance per band')}
          value={simplifyToleranceValue}
          onChange={(event) => {
            updateBuildConfig({
              routeTransformConfig: {
                ...config.routeTransformConfig,
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
