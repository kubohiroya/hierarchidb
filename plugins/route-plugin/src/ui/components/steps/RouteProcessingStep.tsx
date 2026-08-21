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
import { Stack, Typography } from '@mui/material';
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
