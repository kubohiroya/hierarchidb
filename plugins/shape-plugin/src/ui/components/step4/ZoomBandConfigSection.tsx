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
  Settings as SettingsIcon,
  InfoOutlined as InfoOutlinedIcon,
} from '@mui/icons-material';
import { useTranslation } from '../../i18n.js';
import { useTransformConfigSection } from './useTransformConfigSection.ts';
import type { ShapeBuildConfig } from '../../../common/types/index.js';
import {
  ZOOM_BAND_MAX_RANGES,
  ZOOM_BAND_MAX_ZOOM,
  ZOOM_BAND_MIN_RANGES,
  ZOOM_BAND_MIN_ZOOM,
} from '../../../common/config/zoomBands.js';
import { TREE_CONSOLE_DEFAULT_ZOOM_BAND_BOUNDARIES, loadTreeConsoleSettings } from '@hierarchidb/util';
import { ZoomBandRangeCard } from './ZoomBandRangeCard.js';

type Props = {
  config: ShapeBuildConfig;
  disabled?: boolean;
  onChange: (next: ShapeBuildConfig) => void;
};

export const ZoomBandConfigSection: React.FC<Props> = ({
  config,
  disabled,
  onChange,
}) => {
  const { t } = useTranslation();
  const { baseTransformConfig, update } = useTransformConfigSection({ config, onChange });
  const settings = loadTreeConsoleSettings();
  const commonZoomBandBoundaries: number[] = Array.isArray(settings.zoomBandBoundaries)
    ? settings.zoomBandBoundaries
    : TREE_CONSOLE_DEFAULT_ZOOM_BAND_BOUNDARIES;
  const showApplyCommon =
    commonZoomBandBoundaries.length !== baseTransformConfig.zoomBandBoundaries.length
    || commonZoomBandBoundaries.some(
      (value, index) => value !== baseTransformConfig.zoomBandBoundaries[index],
    );

  const applyCommonZoomBandBoundaries = () => {
    update({
      transformConfig: {
        ...baseTransformConfig,
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
              boundaries={baseTransformConfig.zoomBandBoundaries}
              onChange={(zoomBandBoundaries) =>
                update({
                  transformConfig: {
                    ...baseTransformConfig,
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
