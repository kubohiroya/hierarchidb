import {
  Accordion,
  AccordionDetails,
  AccordionSummary,
  Button,
  FormControlLabel,
  FormGroup,
  Paper,
  Stack,
  Switch,
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
import { DeleteBuildOutputsCard } from './DeleteBuildOutputsCard.tsx';
import type { FetchConfigSectionState } from './useFetchConfigSection.ts';

type Props = {
  config: ShapeBuildConfig;
  fetchState: FetchConfigSectionState;
  disabled?: boolean;
  onChange: (next: ShapeBuildConfig) => void;
};

export const ZoomBandConfigSection: React.FC<Props> = ({
  config,
  fetchState,
  disabled,
  onChange,
}) => {
  const { t } = useTranslation();
  const { baseTransformConfig, update } = useTransformConfigSection({ config, disabled, onChange });
  const {
    switchId,
    deleteFetchLabel,
    deleteTransformFilterLabel,
    deleteVTLabel,
    deleteMetadataLabel,
    countsLoading,
    canDeleteFetchCache,
    canDeleteTransformCache,
    canDeleteVTCache,
    canDeleteMetadata,
    handleDeleteFetchCache,
    handleDeleteTransformCache,
    handleDeleteVTCache,
    handleDeleteMetadata,
    handleResetDefaults,
  } = fetchState;

  const applyCommonZoomBandBoundaries = () => {
    const settings = loadTreeConsoleSettings();
    const zoomBandBoundaries = Array.isArray(settings.zoomBandBoundaries)
      ? settings.zoomBandBoundaries
      : TREE_CONSOLE_DEFAULT_ZOOM_BAND_BOUNDARIES;
    update({
      transformConfig: {
        ...baseTransformConfig,
        zoomBandBoundaries,
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
              {t('processing.zoomBandSettings.title', 'Zoom band settings / cache management')}
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
          <Stack direction={{ xs: 'column', lg: 'row' }} spacing={2} alignItems="stretch">
            <Stack spacing={2} sx={{ flex: 1, minWidth: 0 }}>
              <ZoomBandRangeCard
                title={t('processing.filter.zoomBandRangesTitle', 'Zoom band ranges')}
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
              <Button
                variant="outlined"
                size="small"
                onClick={applyCommonZoomBandBoundaries}
                disabled={disabled}
                sx={{ alignSelf: { xs: 'stretch', md: 'flex-start' }, whiteSpace: 'nowrap' }}
              >
                {t(
                  'processing.filter.applyCommonZoomBandBoundaries',
                  'Apply common zoom band settings',
                )}
              </Button>
            </Stack>
            <Paper variant="outlined" sx={{ p: 2, width: '100%', flex: 1, minWidth: 0 }}>
              <Stack spacing={1.5}>
                <Typography variant="subtitle2">
                  {t('processing.download.retainTitle', 'Retain intermediate outputs after build')}
                </Typography>
                <FormGroup>
                  <FormControlLabel
                    control={
                      <Switch
                        checked={!config.cleanupConfig?.deleteFetchCeche}
                        onChange={(event) => {
                          const retainFiles = event.target.checked;
                          update({
                            cleanupConfig: {
                              ...config.cleanupConfig,
                              deleteFetchCeche: !retainFiles,
                            },
                          });
                        }}
                        disabled={disabled}
                        inputProps={{
                          id: `${switchId}-retain-downloaded-files`,
                          name: 'retain-downloaded-files',
                        }}
                      />
                    }
                    label={t('processing.download.retainDownloadedFiles', 'Fetch cache')}
                  />
                  <FormControlLabel
                    control={
                      <Switch
                        checked={!config.cleanupConfig?.deleteTransformCache}
                        onChange={(event) => {
                          const retainCache = event.target.checked;
                          update({
                            cleanupConfig: {
                              ...config.cleanupConfig,
                              deleteTransformCache: !retainCache,
                            },
                          });
                        }}
                        disabled={disabled}
                        inputProps={{
                          id: `${switchId}-retain-stage1-cache`,
                          name: 'retain-stage1-cache',
                        }}
                      />
                    }
                    label={t('processing.download.retainStage1Cache', 'Transform cache')}
                  />
                  <FormControlLabel
                    control={
                      <Switch
                        checked={!config.cleanupConfig?.deleteVTCache}
                        onChange={(event) => {
                          const retainCache = event.target.checked;
                          update({
                            cleanupConfig: {
                              ...config.cleanupConfig,
                              deleteVTCache: !retainCache,
                            },
                          });
                        }}
                        disabled={disabled}
                        inputProps={{
                          id: `${switchId}-retain-vt-cache`,
                          name: 'retain-vt-cache',
                        }}
                      />
                    }
                    label={t('processing.download.retainVtCache', 'VT cache')}
                  />
                </FormGroup>
              </Stack>
            </Paper>
            <Stack sx={{ flex: 1, minWidth: 0 }}>
              <DeleteBuildOutputsCard
                title={t('processing.download.deleteNowTitle', 'Delete build outputs immediately')}
                deleteFetchLabel={deleteFetchLabel}
                deleteTransformFilterLabel={deleteTransformFilterLabel}
                deleteVTLabel={deleteVTLabel}
                deleteMetadataLabel={deleteMetadataLabel}
                countsLoading={countsLoading}
                canDeleteFetchCache={canDeleteFetchCache}
                canDeleteTransformCache={canDeleteTransformCache}
                canDeleteVTCache={canDeleteVTCache}
                canDeleteMetadata={canDeleteMetadata}
                onDeleteFetchCache={handleDeleteFetchCache}
                onDeleteTransformCache={handleDeleteTransformCache}
                onDeleteVTCache={handleDeleteVTCache}
                onDeleteMetadata={handleDeleteMetadata}
                onResetDefaults={handleResetDefaults}
                resetDisabled={disabled}
              />
            </Stack>
          </Stack>
        </Stack>
      </AccordionDetails>
    </Accordion>
  );
};
