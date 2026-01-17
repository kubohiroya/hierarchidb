import { Accordion, AccordionDetails, AccordionSummary, Box, FormControlLabel, Grid, Stack, Switch, TextField, Typography, Slider, Tooltip } from '@mui/material';
import { Layers as LayersIcon, ExpandMore as ExpandMoreIcon, InfoOutlined as InfoOutlinedIcon } from '@mui/icons-material';
import type { ShapeEntity } from '../../../common/types/index.js';
import { WorkerNumberConfigCard } from './WorkerNumberConfigCard.js';
import { useTranslation } from '../../i18n.js';
import { useVTConfigSection } from './useVTConfigSection.ts';
import type { ShapeBuildConfig } from '../../../common/types/index.js';

type Props = {
  buildConfig: ShapeBuildConfig;
  draft?: Partial<ShapeEntity> | null;
  disabled?: boolean;
  onChange: (next: ShapeBuildConfig) => void;
};

export const VTConfigSection: React.FC<Props> = ({ buildConfig, disabled, onChange }) => {
  const { t } = useTranslation();
  const { update } = useVTConfigSection({ buildConfig, onChange });

  return (
    <Accordion defaultExpanded>
      <AccordionSummary expandIcon={<ExpandMoreIcon />}>
        <Stack direction="row" spacing={2} alignItems="center">
          <LayersIcon color="primary" />
          <Typography variant="subtitle1">
            {t('processing.tile.title', 'VT Generation')}
          </Typography>
          <Tooltip
            title={t(
              'processing.tile.descriptionTooltip',
              'Generate vector tiles for the selected zoom range.',
            )}
            placement="top"
          >
            <InfoOutlinedIcon color="action" fontSize="small" />
          </Tooltip>
        </Stack>
      </AccordionSummary>
      <AccordionDetails sx={{ p: 3 }}>
        <Stack spacing={3}>
          <Box>
            <Typography variant="subtitle2">
              {t('processing.tile.basicSettings', 'Basic settings')}
            </Typography>
            <Grid container spacing={3} sx={{ mt: 0.5 }}>
              <Grid size={{ xs: 12, sm: 4 }}>
                <WorkerNumberConfigCard
                  icon={<LayersIcon fontSize="small" color="primary" />}
                  title={t('processing.tile.workers', 'VT Worker Count')}
                  value={buildConfig.vtConfig.maxConcurrent}
                  helperText={t('processing.tile.workersHelp', 'Parallel workers for tile generation.')}
                  warningText={undefined}
                  onChange={(maxConcurrent) =>
                    update({
                      vtConfig: {
                        ...buildConfig.vtConfig,
                        maxConcurrent,
                      },
                    })
                  }
                  min={1}
                  max={8}
                  step={1}
                  disabled={disabled}
                />
              </Grid>

              <Grid size={{ xs: 12, sm: 4 }}>
                <TextField
                  fullWidth
                  type="number"
                  label={t('processing.tile.extent', 'VT Extent')}
                  value={buildConfig.vtConfig.extent}
                  onChange={(event) => {
                    const extent = Number(event.target.value);
                    update({
                      vtConfig: {
                        ...buildConfig.vtConfig,
                        extent,
                      },
                    });
                  }}
                  helperText={t(
                    'processing.tile.extentHelp',
                    'Controls the resolution of tile coordinates.',
                  )}
                  inputProps={{ min: 0 }}
                  disabled={disabled}
                />
              </Grid>

              <Grid size={{ xs: 12, sm: 4 }}>
                <TextField
                  fullWidth
                  type="number"
                  label={t('processing.tile.tolerance', 'VT Tolerance')}
                  value={buildConfig.vtConfig.tolerance}
                  onChange={(event) => {
                    const tolerance = Number(event.target.value);
                    update({
                      vtConfig: {
                        ...buildConfig.vtConfig,
                        tolerance,
                      },
                    });
                  }}
                  helperText={t(
                    'processing.tile.toleranceHelp',
                    'Simplification tolerance applied during tile generation.',
                  )}
                  inputProps={{ min: 0 }}
                  disabled={disabled}
                />
              </Grid>

              <Grid size={{ xs: 12, sm: 4 }}>
                <TextField
                  fullWidth
                  label={t('processing.tile.layerSetName', 'Layer Set Name')}
                  value={buildConfig.vtConfig.layerSetName}
                  onChange={(event) => {
                    const layerSetName = event.target.value;
                    update({
                      vtConfig: {
                        ...buildConfig.vtConfig,
                        layerSetName,
                      },
                    });
                  }}
                  helperText={t(
                    'processing.tile.layerSetNameHelp',
                    'Name of the output layer group.',
                  )}
                  disabled={disabled}
                />
              </Grid>

              <Grid size={{ xs: 12, sm: 4 }} style={{ paddingRight: '20px' }}>
                <Typography gutterBottom>
                  {t('processing.tile.bufferSize', 'Tile Margin (px)')}
                </Typography>
                <Box sx={{ px: 2 }}>
                  <Slider
                    value={buildConfig.vtConfig.bufferSize}
                    onChange={(_, value: number | number[]) => {
                      const bufferSize = value as number;
                      update({
                        vtConfig: {
                          ...buildConfig.vtConfig,
                          bufferSize,
                        },
                      });
                    }}
                    min={0}
                    max={512}
                    step={32}
                    marks={[
                      { value: 0, label: '0' },
                      { value: 256, label: '256' },
                      { value: 512, label: '512' },
                    ]}
                    valueLabelDisplay="auto"
                    disabled={disabled}
                  />
                </Box>
                <Typography variant="caption" color="text.secondary">
                  {t('processing.tile.bufferSizeHelp', 'Extra margin to reduce seams at tile edges.')}
                </Typography>
              </Grid>
            </Grid>
          </Box>

          <Box>
            <Typography variant="subtitle2">
              {t('processing.tile.advancedSettings', 'Advanced settings')}
            </Typography>
            <Grid container spacing={3} sx={{ mt: 0.5 }}>
              <Grid size={{ xs: 12, sm: 4 }}>
                <Stack spacing={0.5}>
                  <FormControlLabel
                    control={
                      <Switch
                        checked={buildConfig.vtConfig.boundaryDedupe}
                        onChange={(event) => {
                          const boundaryDedupe = event.target.checked;
                          update({
                            vtConfig: {
                              ...buildConfig.vtConfig,
                              boundaryDedupe,
                            },
                          });
                        }}
                        disabled={disabled}
                      />
                    }
                    label={t('processing.tile.boundaryDedupe', 'Boundary Dedupe')}
                  />
                  <Typography variant="caption" color="text.secondary">
                    {t(
                      'processing.tile.boundaryDedupeHelp',
                      'Remove duplicate boundary lines to reduce tile size.',
                    )}
                  </Typography>
                </Stack>
              </Grid>
              <Grid size={{ xs: 12, sm: 4 }}>
                <Stack spacing={0.5}>
                  <FormControlLabel
                    control={
                      <Switch
                        checked={buildConfig.vtConfig.enableTopojsonSimplify}
                        onChange={(event) => {
                          const enableTopojsonSimplify = event.target.checked;
                          update({
                            vtConfig: {
                              ...buildConfig.vtConfig,
                              enableTopojsonSimplify,
                            },
                          });
                        }}
                        disabled={disabled}
                      />
                    }
                    label={t('processing.tile.topojsonSimplify', 'Enable TopoJSON simplify')}
                  />
                  <Typography variant="caption" color="text.secondary">
                    {t(
                      'processing.tile.topojsonSimplifyHelp',
                      'Apply TopoJSON-based simplification before tile output.',
                    )}
                  </Typography>
                </Stack>
              </Grid>

              <Grid size={{ xs: 12, sm: 4 }} style={{ paddingRight: '20px' }}>
                <Typography gutterBottom>
                  {t('processing.tile.expandFactor', 'Tile Expansion Factor')}
                </Typography>
                <Box sx={{ px: 2 }}>
                  <Slider
                    value={buildConfig.vtConfig.tileExpandFactor}
                    onChange={(_, value: number | number[]) => {
                      const tileExpandFactor = Number(value);
                      update({
                        vtConfig: {
                          ...buildConfig.vtConfig,
                          tileExpandFactor,
                        },
                      });
                    }}
                    min={0}
                    max={3}
                    step={0.1}
                    marks={[
                      { value: 0, label: '0' },
                      { value: 1, label: '1' },
                      { value: 2, label: '2' },
                      { value: 3, label: '3' },
                    ]}
                    valueLabelDisplay="auto"
                    disabled={disabled}
                  />
                </Box>
                <Typography variant="caption" color="text.secondary">
                  {t(
                    'processing.tile.expandFactorHelp',
                    'Expand tile groups when assembling TopoJSON buffers.',
                  )}
                </Typography>
              </Grid>

              <Grid size={{ xs: 12, sm: 4 }} style={{ paddingRight: '20px' }}>
                <Typography gutterBottom>
                  {t('processing.tile.expandMargin', 'Tile Expansion Margin')}
                </Typography>
                <Box sx={{ px: 2 }}>
                  <Slider
                    value={buildConfig.vtConfig.tileExpandMargin}
                    onChange={(_, value: number | number[]) => {
                      const tileExpandMargin = Number(value);
                      update({
                        vtConfig: {
                          ...buildConfig.vtConfig,
                          tileExpandMargin,
                        },
                      });
                    }}
                    min={0}
                    max={2}
                    step={0.1}
                    marks={[
                      { value: 0, label: '0' },
                      { value: 0.5, label: '0.5' },
                      { value: 1, label: '1' },
                      { value: 2, label: '2' },
                    ]}
                    valueLabelDisplay="auto"
                    disabled={disabled}
                  />
                </Box>
                <Typography variant="caption" color="text.secondary">
                  {t(
                    'processing.tile.expandMarginHelp',
                    'Extra margin (in tiles) for neighbor selection.',
                  )}
                </Typography>
              </Grid>
            </Grid>
          </Box>
        </Stack>
      </AccordionDetails>
    </Accordion>
  );
};
