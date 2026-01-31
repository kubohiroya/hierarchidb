/**
 * RouteProcessingStep - Settings step for route creation dialog.
 * Configures shared build settings reused by the Shape pipeline.
 */

import type React from 'react';
import { useCallback, useMemo } from 'react';
import {
  Accordion,
  AccordionDetails,
  AccordionSummary,
  Box,
  Button,
  Stack,
  Tooltip,
  Typography,
} from '@mui/material';
import {
  ExpandMore as ExpandMoreIcon,
  Settings as SettingsIcon,
  InfoOutlined as InfoOutlinedIcon,
} from '@mui/icons-material';
import { FetchConfigSection, VTConfigSection, ZoomBandRangeCard } from '@hierarchidb/ui-accordion-config';
import type { NodeId } from '@hierarchidb/core-types';
import {
  areZoomBandBoundariesEqual,
  resolveZoomBandSettings,
  ZOOM_BAND_MAX_RANGES,
  ZOOM_BAND_MAX_ZOOM,
  ZOOM_BAND_MIN_RANGES,
  ZOOM_BAND_MIN_ZOOM,
  TREE_CONSOLE_DEFAULT_ZOOM_BAND_BOUNDARIES,
  loadTreeConsoleSettings,
} from '@hierarchidb/util';
import type { BaseBuildConfig } from '@hierarchidb/gis-sdk';
import type { RouteEntity, RouteUpdaterPayload } from '@hierarchidb/route-api';
import { useTranslation } from '../../../common/i18n/index.js';
import { useRouteBuildConfigStep } from './useRouteBuildConfigStep.js';
import { mergeRouteBuildConfig } from '../../../common/config/buildConfig.js';
import {
  filteringHighUrl,
  filteringLowUrl,
  filteringMediumUrl,
} from '../../assets/filtering-samples/filteringSamples.ts';

export interface RouteProcessingStepProps {
  draft: RouteUpdaterPayload;
  onUpdate: (updates: Partial<RouteEntity>) => void;
  nodeId?: NodeId;
  disabled?: boolean;
}

type BuildConfig = BaseBuildConfig<string>;

type ZoomBandSectionProps = {
  config: BuildConfig;
  disabled?: boolean;
  t: (key: string, fallback?: string, options?: Record<string, unknown>) => string;
  update: (partial: Partial<BuildConfig>) => void;
};

const RouteZoomBandConfigSection: React.FC<ZoomBandSectionProps> = ({
  config,
  disabled,
  t,
  update,
}) => {
  const settings = loadTreeConsoleSettings();
  const { boundaries: commonZoomBandBoundaries } = resolveZoomBandSettings({
    commonBoundaries: settings.zoomBandBoundaries,
    fallbackBoundaries: TREE_CONSOLE_DEFAULT_ZOOM_BAND_BOUNDARIES,
    preferCommon: true,
  });
  const showApplyCommon = !areZoomBandBoundariesEqual(
    commonZoomBandBoundaries,
    config.transformConfig.zoomBandBoundaries,
  );

  const applyCommonZoomBandBoundaries = () => {
    update({
      transformConfig: {
        ...config.transformConfig,
        zoomBandBoundaries: commonZoomBandBoundaries,
      },
    });
  };

  return (
    <Accordion defaultExpanded>
      <AccordionSummary expandIcon={<ExpandMoreIcon />}>
        <Stack direction="row" spacing={2} alignItems="center">
          <SettingsIcon color="primary" />
          <Stack direction="row" spacing={1} alignItems="center">
            <Typography variant="subtitle1">
              {t('processing.zoomBandSettings.title', 'Zoom band settings')}
            </Typography>
            <Tooltip
              title={t(
                'processing.tile.zoomBandsSummary',
                'Zoom bands follow the Transform range boundaries. The representative zoom is the smallest in each band.',
              )}
              placement="top"
            >
              <InfoOutlinedIcon color="action" fontSize="small" />
            </Tooltip>
          </Stack>
        </Stack>
      </AccordionSummary>
      <AccordionDetails sx={{ p: 3 }}>
        <Stack spacing={2}>
          <Stack spacing={2} sx={{ flex: 1, minWidth: 0 }}>
            <ZoomBandRangeCard
              title={t('processing.filter.zoomBandRangesTitle', 'Zoom band settings')}
              icon={<SettingsIcon fontSize="small" color="primary" />}
              helperText={t(
                'processing.filter.zoomBandRangesHelp',
                'Configure the number of zoom ranges and their boundaries.',
              )}
              rangeCountLabel={t('processing.filter.zoomBandRangeCount', 'Range count')}
              rangeCountHelperText={t(
                'processing.filter.zoomBandRangeCountHelp',
                'Controls how many zoom ranges are grouped into bands.',
              )}
              boundariesLabel={t('processing.filter.zoomBandBoundaries', 'Range boundaries')}
              boundariesHelperText={t(
                'processing.filter.zoomBandBoundariesHelp',
                'Adjust the zoom boundaries between ranges.',
              )}
              minZoom={ZOOM_BAND_MIN_ZOOM}
              maxZoomLimit={ZOOM_BAND_MAX_ZOOM}
              minRanges={ZOOM_BAND_MIN_RANGES}
              maxRanges={ZOOM_BAND_MAX_RANGES}
              boundaries={config.transformConfig.zoomBandBoundaries}
              onChange={(zoomBandBoundaries) =>
                update({
                  transformConfig: {
                    ...config.transformConfig,
                    zoomBandBoundaries,
                  },
                })
              }
              sliderLayout="horizontal"
              disabled={disabled}
            />
            {showApplyCommon ? (
              <Button
                variant="outlined"
                size="small"
                color="secondary"
                onClick={applyCommonZoomBandBoundaries}
                disabled={disabled}
                sx={{ alignSelf: { xs: 'stretch', md: 'flex-start' }, whiteSpace: 'nowrap' }}
              >
                {t(
                  'processing.filter.applyCommonZoomBandBoundaries',
                  'Apply common zoom band settings',
                )}
              </Button>
            ) : null}
          </Stack>
        </Stack>
      </AccordionDetails>
    </Accordion>
  );
};

export const RouteProcessingStep: React.FC<RouteProcessingStepProps> = ({
  draft,
  onUpdate,
  disabled,
}) => {
  const { t } = useTranslation();
  const { config, handleChange } = useRouteBuildConfigStep({
    data: draft.draftData ?? {},
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
    <Box display="flex" flexDirection="column" gap={3}>
      <RouteZoomBandConfigSection
        config={config}
        disabled={disabled}
        t={t}
        update={updateBuildConfig}
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
    </Box>
  );
};
