import type React from 'react';
import {
  Accordion,
  AccordionDetails,
  AccordionSummary,
  Button,
  Stack,
  Tooltip,
  Typography,
} from '@mui/material';
import {
  ExpandMore as ExpandMoreIcon,
  InfoOutlined as InfoOutlinedIcon,
  Settings as SettingsIcon,
} from '@mui/icons-material';
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
import { ZoomBandRangeCard } from './ZoomBandRangeCard.js';

export type ZoomBandConfigSectionProps = {
  boundaries: number[];
  onBoundariesChange: (boundaries: number[]) => void;
  disabled?: boolean;
  t: (key: string, fallback?: string, options?: Record<string, unknown>) => string;
};

export const ZoomBandConfigSection: React.FC<ZoomBandConfigSectionProps> = ({
  boundaries,
  onBoundariesChange,
  disabled,
  t,
}) => {
  const settings = loadTreeConsoleSettings();
  const { boundaries: commonZoomBandBoundaries } = resolveZoomBandSettings({
    commonBoundaries: settings.zoomBandBoundaries,
    fallbackBoundaries: TREE_CONSOLE_DEFAULT_ZOOM_BAND_BOUNDARIES,
    preferCommon: true,
  });
  const showApplyCommon = !areZoomBandBoundariesEqual(
    commonZoomBandBoundaries,
    boundaries,
  );

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
              boundaries={boundaries}
              onChange={onBoundariesChange}
              sliderLayout="horizontal"
              disabled={disabled}
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
