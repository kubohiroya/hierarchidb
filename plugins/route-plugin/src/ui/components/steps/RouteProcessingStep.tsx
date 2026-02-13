/**
 * RouteProcessingStep - Settings step for route creation dialog.
 * Configures shared build settings reused by the Shape pipeline.
 */

import type React from 'react';
import { useCallback, useMemo } from 'react';
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
    </BuildConfigShell>
  );
};
