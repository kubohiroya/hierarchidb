// Presentational component for CacheManagementSection.
// Pure rendering — no hooks, no side effects.

import {
  BuildConfigAccordionSummary,
  BuildConfigSectionTitle,
} from '@hierarchidb/ui-accordion-config';
import {
  ExpandMore as ExpandMoreIcon,
  InfoOutlined as InfoOutlinedIcon,
  Inventory2 as Inventory2Icon,
  Settings as SettingsIcon,
} from '@mui/icons-material';
import {
  Accordion,
  AccordionDetails,
  AccordionSummary,
  Button,
  FormControl,
  FormControlLabel,
  Grid,
  Paper,
  Stack,
  Switch,
  ToggleButton,
  ToggleButtonGroup,
  Typography,
} from '@mui/material';
import React from 'react';
import { UrlBuildConfigRulesSection } from './UrlBuildConfigRulesSection.tsx';
import type { CacheManagementSectionViewProps } from './useCacheManagementSectionState.js';

export const CacheManagementSectionView = React.memo<CacheManagementSectionViewProps>(
  ({
    t,
    config,
    disabled,
    hoverCardSx,
    switchId,
    executionLogLevel,
    handleResetDefaults,
    onRetainChange,
    onChangeExecutionLogLevel,
    onUrlRulesChange,
  }) => {
    return (
      <Accordion defaultExpanded>
        <AccordionSummary expandIcon={<ExpandMoreIcon />}>
          <BuildConfigAccordionSummary
            icon={<SettingsIcon color="primary" />}
            title="Misc"
            info={t(
              'processing.cache.descriptionTooltip',
              'Control how build outputs are retained or removed after each stage.'
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
                        'Retail intermediate outputs after build'
                      )}
                    />
                    <Stack
                      direction="row"
                      spacing={1.5}
                      alignItems="flex-start"
                      useFlexGap
                      flexWrap="wrap"
                    >
                      <FormControlLabel
                        control={
                          <Switch
                            checked={!config.cleanupConfig?.deleteSourceApiCache}
                            onChange={(event) =>
                              onRetainChange('deleteSourceApiCache', event.target.checked)
                            }
                            disabled={disabled}
                            inputProps={{
                              id: `${switchId}-retain-source-api-cache`,
                              name: 'retain-source-api-cache',
                            }}
                          />
                        }
                        label={t('processing.download.retainApiCache', 'API cache')}
                      />
                      <FormControlLabel
                        control={
                          <Switch
                            checked={!config.cleanupConfig?.deleteSourceFilteredCache}
                            onChange={(event) =>
                              onRetainChange('deleteSourceFilteredCache', event.target.checked)
                            }
                            disabled={disabled}
                            inputProps={{
                              id: `${switchId}-retain-source-filtered-cache`,
                              name: 'retain-source-filtered-cache',
                            }}
                          />
                        }
                        label={t('processing.download.retainFilteredCache', 'Filtered cache')}
                      />
                      <FormControlLabel
                        control={
                          <Switch
                            checked={!config.cleanupConfig?.deleteGeometryCache}
                            onChange={(event) =>
                              onRetainChange('deleteGeometryCache', event.target.checked)
                            }
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
                            checked={!config.cleanupConfig?.deleteTileEmitCache}
                            onChange={(event) =>
                              onRetainChange('deleteTileEmitCache', event.target.checked)
                            }
                            disabled={disabled}
                            inputProps={{
                              id: `${switchId}-retain-tile-emit-cache`,
                              name: 'retain-tile-emit-cache',
                            }}
                          />
                        }
                        label={t('processing.download.retainTileEmitCache', 'Tile data')}
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
              <UrlBuildConfigRulesSection
                config={config}
                onChange={onUrlRulesChange}
                disabled={disabled}
              />
            </Paper>
            <Paper variant="outlined" sx={{ p: 2, ...hoverCardSx }}>
              <Stack spacing={2}>
                <BuildConfigSectionTitle
                  icon={<InfoOutlinedIcon fontSize="small" color="primary" />}
                  title={t('processing.geometry.logging.title', 'Execution logging')}
                />
                <FormControl fullWidth disabled={disabled}>
                  <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
                    {t('processing.geometry.executionLogLevel.label', 'Execution Log Level')}
                  </Typography>
                  <ToggleButtonGroup
                    size="small"
                    fullWidth
                    exclusive
                    value={executionLogLevel}
                    onChange={(_event, value) => {
                      if (value === null) return;
                      if (value !== 'off' && value !== 'summary' && value !== 'verbose') return;
                      onChangeExecutionLogLevel(value);
                    }}
                  >
                    <ToggleButton value="off">
                      {t('processing.geometry.executionLogLevel.off', 'off')}
                    </ToggleButton>
                    <ToggleButton value="summary">
                      {t('processing.geometry.executionLogLevel.summary', 'summary')}
                    </ToggleButton>
                    <ToggleButton value="verbose">
                      {t('processing.geometry.executionLogLevel.verbose', 'verbose')}
                    </ToggleButton>
                  </ToggleButtonGroup>
                </FormControl>
              </Stack>
            </Paper>
          </Stack>
        </AccordionDetails>
      </Accordion>
    );
  }
);

CacheManagementSectionView.displayName = 'CacheManagementSectionView';
