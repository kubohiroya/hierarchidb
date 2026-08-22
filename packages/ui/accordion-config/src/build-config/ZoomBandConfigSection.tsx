import {
  areZoomBandBoundariesEqual,
  loadTreeConsoleSettings,
  resolveZoomBandSettings,
  TREE_CONSOLE_DEFAULT_ZOOM_BAND_BOUNDARIES,
  ZOOM_BAND_MAX_RANGES,
  ZOOM_BAND_MAX_ZOOM,
  ZOOM_BAND_MIN_RANGES,
  ZOOM_BAND_MIN_ZOOM,
} from '@hierarchidb/util';
import { ExpandMore as ExpandMoreIcon, Search as SearchIcon } from '@mui/icons-material';
import { Accordion, AccordionDetails, AccordionSummary, Button, Stack } from '@mui/material';
import type React from 'react';
import { BuildConfigAccordionSummary } from './BuildConfigAccordionSummary.js';
import { ZoomBandRangeCard } from './ZoomBandRangeCard.js';

export type ZoomBandConfigSectionProps = {
  boundaries: number[];
  onBoundariesChange: (boundaries: number[]) => void;
  disabled?: boolean;
  t: (key: string, fallback?: string, options?: Record<string, unknown>) => string;
  disableHoverLift?: boolean;
};

export const ZoomBandConfigSection: React.FC<ZoomBandConfigSectionProps> = ({
  boundaries,
  onBoundariesChange,
  disabled,
  t,
  disableHoverLift = false,
}) => {
  const settings = loadTreeConsoleSettings();
  const { boundaries: commonZoomBandBoundaries } = resolveZoomBandSettings({
    commonBoundaries: settings.zoomBandBoundaries,
    fallbackBoundaries: TREE_CONSOLE_DEFAULT_ZOOM_BAND_BOUNDARIES,
    preferCommon: true,
  });
  const showApplyCommon = !areZoomBandBoundariesEqual(commonZoomBandBoundaries, boundaries);

  return (
    <Accordion defaultExpanded>
      <AccordionSummary expandIcon={<ExpandMoreIcon />}>
        <BuildConfigAccordionSummary
          icon={<SearchIcon color="primary" />}
          title={t('processing.zoomBandSettings.title', 'Zoom band settings')}
          info={t(
            'processing.tile.zoomBandsSummary',
            'Zoom bands follow the Geometry range boundaries. The representative zoom is the smallest in each band.'
          )}
        />
      </AccordionSummary>
      <AccordionDetails sx={{ p: 1 }}>
        <Stack spacing={2}>
          <Stack spacing={2} sx={{ flex: 1, minWidth: 0 }}>
            <ZoomBandRangeCard
              title={t('processing.filter.zoomBandRangesTitle', 'Zoom band settings')}
              icon={<SearchIcon fontSize="small" color="primary" />}
              helperText={t(
                'processing.filter.zoomBandRangesHelp',
                'Configure the number of zoom ranges and their boundaries.'
              )}
              rangeCountLabel={t('processing.filter.zoomBandRangeCount', 'Range count')}
              rangeCountHelperText={t(
                'processing.filter.zoomBandRangeCountHelp',
                'Controls how many zoom ranges are grouped into bands.'
              )}
              boundariesLabel={t('processing.filter.zoomBandBoundaries', 'Range boundaries')}
              boundariesHelperText={t(
                'processing.filter.zoomBandBoundariesHelp',
                'Adjust the zoom boundaries between ranges.'
              )}
              minZoom={ZOOM_BAND_MIN_ZOOM}
              maxZoomLimit={ZOOM_BAND_MAX_ZOOM}
              minRanges={ZOOM_BAND_MIN_RANGES}
              maxRanges={ZOOM_BAND_MAX_RANGES}
              boundaries={boundaries}
              onChange={onBoundariesChange}
              sliderLayout="horizontal"
              disabled={disabled}
              disableLift={disableHoverLift}
            />
            {showApplyCommon ? (
              <Button
                variant="outlined"
                size="small"
                color="secondary"
                onClick={() => onBoundariesChange(commonZoomBandBoundaries)}
                disabled={disabled}
                sx={{ alignSelf: { xs: 'stretch', md: 'flex-start' }, whiteSpace: 'nowrap' }}
              >
                {t(
                  'processing.filter.applyCommonZoomBandBoundaries',
                  'Apply common zoom band settings'
                )}
              </Button>
            ) : null}
          </Stack>
        </Stack>
      </AccordionDetails>
    </Accordion>
  );
};
