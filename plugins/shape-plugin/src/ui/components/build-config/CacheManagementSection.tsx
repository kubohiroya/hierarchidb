import {
  Accordion,
  AccordionDetails,
  AccordionSummary,
  Button,
  FormControl,
  FormControlLabel,
  Grid,
  Typography,
  Paper,
  Stack,
  Switch,
  ToggleButton,
  ToggleButtonGroup,
} from '@mui/material';
import {
  ExpandMore as ExpandMoreIcon,
  InfoOutlined as InfoOutlinedIcon,
  Inventory2 as Inventory2Icon,
  Settings as SettingsIcon,
} from '@mui/icons-material';
import type { ShapeBuildConfig } from '~/common/types/index';
import { useTransformConfigSection } from '~/ui/hooks/useTransformConfigSection';
import type { FetchConfigSectionState } from '~/ui/hooks/useFetchConfigSection';
import { useTranslation } from '~/ui/i18n';
import {
  BuildConfigAccordionSummary,
  BuildConfigSectionTitle,
  getBuildConfigHoverCardSx,
} from '@hierarchidb/ui-accordion-config';
import { UrlBuildConfigRulesSection } from './UrlBuildConfigRulesSection.tsx';

type Props = {
  config: ShapeBuildConfig;
  onChange: (next: ShapeBuildConfig | ((prev: ShapeBuildConfig) => ShapeBuildConfig)) => void;
  fetchState: FetchConfigSectionState;
  disabled?: boolean;
  disableHoverLift?: boolean;
};

export const CacheManagementSection: React.FC<Props> = ({
  config,
  onChange,
  fetchState,
  disabled,
  disableHoverLift = false,
}) => {
  const { t } = useTranslation();
  const {
    switchId,
    handleResetDefaults,
    update,
  } = fetchState;
  const { update: updateTransformConfig } = useTransformConfigSection({
    config,
    onChange,
  });

  const hoverCardSx = getBuildConfigHoverCardSx(disabled, disableHoverLift);
  const executionLogLevel = config.transformConfig.executionLogLevel ?? 'summary';

  const onChangeExecutionLogLevel = (next: 'off' | 'summary' | 'verbose') => {
    updateTransformConfig({
      transformConfig: {
        executionLogLevel: next,
      },
    });
  };

  return (
    <Accordion defaultExpanded>
      <AccordionSummary expandIcon={<ExpandMoreIcon />}>
        <BuildConfigAccordionSummary
          icon={<SettingsIcon color="primary" />}
          title="Misc"
          info={t(
            'processing.cache.descriptionTooltip',
            'Control how build outputs are retained or removed after each stage.',
          )}
        />
      </AccordionSummary>
      <AccordionDetails sx={{ p: 3 }}>
        <Stack spacing={2} alignItems="stretch">
          <Grid container spacing={2}>
            <Grid size={{ xs: 12, md: 6 }}>
              <Paper
                variant="outlined"
                sx={{ p: 2, width: '100%', flex: 1, minWidth: 0, ...hoverCardSx }}
              >
                <Stack spacing={1.5}>
                  <BuildConfigSectionTitle
                    icon={<SettingsIcon fontSize="small" color="primary" />}
                    title={t('processing.download.resetDefaultsAction', 'Reset to defaults')}
                  />
                  <Button
                    fullWidth
                    variant="outlined"
                    color="warning"
                    disabled={disabled}
                    onClick={handleResetDefaults}
                  >
                    {t('processing.download.resetDefaultsAction', 'Reset to defaults')}
                  </Button>
                </Stack>
              </Paper>
            </Grid>
            <Grid size={{ xs: 12, md: 6 }}>
              <Paper
                variant="outlined"
                sx={{ p: 2, width: '100%', flex: 1, minWidth: 0, ...hoverCardSx }}
              >
                <Stack spacing={1.5}>
                  <BuildConfigSectionTitle
                    icon={<Inventory2Icon fontSize="small" color="primary" />}
                    title={t(
                      'processing.download.retainTitle',
                      'Retail intermediate outputs after build',
                    )}
                  />
                  <Stack direction="row" spacing={1.5} alignItems="flex-start" useFlexGap flexWrap="wrap">
                    <FormControlLabel
                      control={
                        <Switch
                          checked={!config.cleanupConfig?.deleteFetchApiCache}
                          onChange={(event) => {
                            const retainFiles = event.target.checked;
                            update({
                              cleanupConfig: {
                                ...config.cleanupConfig,
                                deleteFetchApiCache: !retainFiles,
                              },
                            });
                          }}
                          disabled={disabled}
                          inputProps={{
                            id: `${switchId}-retain-fetch-api-cache`,
                            name: 'retain-fetch-api-cache',
                          }}
                        />
                      }
                      label={t('processing.download.retainApiCache', 'API cache')}
                    />
                    <FormControlLabel
                      control={
                        <Switch
                          checked={!config.cleanupConfig?.deleteFetchFilteredCache}
                          onChange={(event) => {
                            const retainCache = event.target.checked;
                            update({
                              cleanupConfig: {
                                ...config.cleanupConfig,
                                deleteFetchFilteredCache: !retainCache,
                              },
                            });
                          }}
                          disabled={disabled}
                          inputProps={{
                            id: `${switchId}-retain-fetch-filtered-cache`,
                            name: 'retain-fetch-filtered-cache',
                          }}
                        />
                      }
                      label={t('processing.download.retainFilteredCache', 'Filtered cache')}
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
                      label={t('processing.download.retainStage1Cache', 'Simplified cache')}
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
                      label={t('processing.download.retainVtCache', 'Tile data')}
                    />
                  </Stack>
                </Stack>
              </Paper>
            </Grid>
          </Grid>
          <Paper
            variant="outlined"
            sx={{ p: 2, width: '100%', flex: 1, minWidth: 0, ...hoverCardSx }}
          >
            <UrlBuildConfigRulesSection config={config} onChange={onChange} disabled={disabled} />
          </Paper>
          <Paper variant="outlined" sx={{ p: 2, ...hoverCardSx }}>
            <Stack spacing={2}>
              <BuildConfigSectionTitle
                icon={<InfoOutlinedIcon fontSize="small" color="primary" />}
                title={t('processing.transform.logging.title', 'Execution logging')}
              />
              <FormControl fullWidth disabled={disabled}>
                <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
                  {t('processing.transform.executionLogLevel.label', 'Execution Log Level')}
                </Typography>
                <ToggleButtonGroup
                  size="small"
                  fullWidth
                  exclusive
                  value={executionLogLevel}
                  onChange={(_event, value) => {
                    if (value === null) {
                      return;
                    }
                    if (value !== 'off' && value !== 'summary' && value !== 'verbose') {
                      return;
                    }
                    onChangeExecutionLogLevel(value);
                  }}
                >
                  <ToggleButton value="off">{t('processing.transform.executionLogLevel.off', 'off')}</ToggleButton>
                  <ToggleButton value="summary">{t('processing.transform.executionLogLevel.summary', 'summary')}</ToggleButton>
                  <ToggleButton value="verbose">{t('processing.transform.executionLogLevel.verbose', 'verbose')}</ToggleButton>
                </ToggleButtonGroup>
              </FormControl>
            </Stack>
          </Paper>
        </Stack>
      </AccordionDetails>
    </Accordion>
  );
};
