import {
  Accordion,
  AccordionDetails,
  AccordionSummary,
  Box,
  FormControl,
  FormControlLabel,
  Grid,
  InputLabel,
  MenuItem,
  Stack,
  Switch,
  TextField,
  Typography,
  Slider,
  Tooltip,
  Paper,
  Select,
} from '@mui/material';
import { Layers as LayersIcon, ExpandMore as ExpandMoreIcon, InfoOutlined as InfoOutlinedIcon } from '@mui/icons-material';
import type { ShapeEntity } from '../../../common/types/index.js';
import { WorkerNumberConfigCard } from './WorkerNumberConfigCard.js';
import { useTranslation } from '../../i18n.js';
import { useVTConfigSection } from './useVTConfigSection.ts';
import type { ShapeBuildConfig } from '../../../common/types/index.js';
import { DEFAULT_BUILD_CONFIG } from '../../../common/types/constants.js';

type Props = {
  buildConfig: ShapeBuildConfig;
  draft?: Partial<ShapeEntity> | null;
  disabled?: boolean;
  onChange: (next: ShapeBuildConfig) => void;
};

export const VTConfigSection: React.FC<Props> = ({ buildConfig, disabled, onChange }) => {
  const { t } = useTranslation();
  const { update } = useVTConfigSection({ buildConfig, onChange });
  const dynamicConcurrency = buildConfig.vtConfig.dynamicConcurrency
    ?? DEFAULT_BUILD_CONFIG.vtConfig.dynamicConcurrency
    ?? {
      enabled: false,
      minConcurrent: buildConfig.vtConfig.maxConcurrent,
      maxConcurrent: buildConfig.vtConfig.maxConcurrent,
      highWatermark: 0.85,
      lowWatermark: 0.6,
      adjustStep: 1,
      sampleMs: 2000,
    };

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
                  label={t('processing.tile.tileSize', 'Tile Size')}
                  value={buildConfig.vtConfig.tileSize}
                  onChange={(event) => {
                    const tileSize = Number(event.target.value);
                    update({
                      vtConfig: {
                        ...buildConfig.vtConfig,
                        tileSize,
                      },
                    });
                  }}
                  helperText={t(
                    'processing.tile.tileSizeHelp',
                    'Base tile size used for extent calculations.',
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
              <Grid size={{ xs: 12, sm: 4 }}>
                <TextField
                  fullWidth
                  label={t('processing.tile.promoteId', 'Promote ID')}
                  value={buildConfig.vtConfig.promoteId}
                  onChange={(event) => {
                    const promoteId = event.target.value;
                    update({
                      vtConfig: {
                        ...buildConfig.vtConfig,
                        promoteId,
                      },
                    });
                  }}
                  helperText={t(
                    'processing.tile.promoteIdHelp',
                    'Property name used to promote feature IDs.',
                  )}
                  disabled={disabled}
                />
              </Grid>
              <Grid size={{ xs: 12, sm: 4 }}>
                <TextField
                  fullWidth
                  type="number"
                  label={t('processing.tile.indexMaxPoints', 'Index Max Points')}
                  value={buildConfig.vtConfig.indexMaxPoints}
                  onChange={(event) => {
                    const indexMaxPoints = Number(event.target.value);
                    update({
                      vtConfig: {
                        ...buildConfig.vtConfig,
                        indexMaxPoints,
                      },
                    });
                  }}
                  helperText={t(
                    'processing.tile.indexMaxPointsHelp',
                    'Upper limit for points stored per tile index entry.',
                  )}
                  inputProps={{ min: 0 }}
                  disabled={disabled}
                />
              </Grid>
              <Grid size={{ xs: 12, sm: 4 }}>
                <FormControl fullWidth>
                  <InputLabel id="vt-input-format-label">
                    {t('processing.tile.inputFormat', 'Input format')}
                  </InputLabel>
                  <Select
                    labelId="vt-input-format-label"
                    value={buildConfig.vtConfig.inputFormat}
                    label={t('processing.tile.inputFormat', 'Input format')}
                    onChange={(event) => {
                      const inputFormat = event.target.value as typeof buildConfig.vtConfig.inputFormat;
                      update({
                        vtConfig: {
                          ...buildConfig.vtConfig,
                          inputFormat,
                        },
                      });
                    }}
                    disabled={disabled}
                  >
                    <MenuItem value="geojson">
                      {t('processing.tile.inputFormatGeojson', 'GeoJSON')}
                    </MenuItem>
                    <MenuItem value="flatgeobuf">
                      {t('processing.tile.inputFormatFlatgeobuf', 'FlatGeobuf')}
                    </MenuItem>
                  </Select>
                  <Typography variant="caption" color="text.secondary" sx={{ mt: 0.5 }}>
                    {t('processing.tile.inputFormatHelp', 'Input data format for tile generation.')}
                  </Typography>
                </FormControl>
              </Grid>
              <Grid size={{ xs: 12, sm: 4 }}>
                <FormControl fullWidth>
                  <InputLabel id="vt-input-compression-label">
                    {t('processing.tile.inputCompression', 'Input compression')}
                  </InputLabel>
                  <Select
                    labelId="vt-input-compression-label"
                    value={buildConfig.vtConfig.inputCompression}
                    label={t('processing.tile.inputCompression', 'Input compression')}
                    onChange={(event) => {
                      const inputCompression = event.target.value as typeof buildConfig.vtConfig.inputCompression;
                      update({
                        vtConfig: {
                          ...buildConfig.vtConfig,
                          inputCompression,
                        },
                      });
                    }}
                    disabled={disabled}
                  >
                    <MenuItem value="none">
                      {t('processing.tile.inputCompressionNone', 'None')}
                    </MenuItem>
                    <MenuItem value="gzip">
                      {t('processing.tile.inputCompressionGzip', 'Gzip')}
                    </MenuItem>
                  </Select>
                  <Typography variant="caption" color="text.secondary" sx={{ mt: 0.5 }}>
                    {t('processing.tile.inputCompressionHelp', 'Compression of source buffers.')}
                  </Typography>
                </FormControl>
              </Grid>
              <Grid size={{ xs: 12, sm: 4 }}>
                <FormControl fullWidth>
                  <InputLabel id="vt-output-format-label">
                    {t('processing.tile.outputFormat', 'Output format')}
                  </InputLabel>
                  <Select
                    labelId="vt-output-format-label"
                    value={buildConfig.vtConfig.format}
                    label={t('processing.tile.outputFormat', 'Output format')}
                    onChange={(event) => {
                      const format = event.target.value as typeof buildConfig.vtConfig.format;
                      update({
                        vtConfig: {
                          ...buildConfig.vtConfig,
                          format,
                        },
                      });
                    }}
                    disabled={disabled}
                  >
                    <MenuItem value="mvt">
                      {t('processing.tile.outputFormatMvt', 'MVT')}
                    </MenuItem>
                    <MenuItem value="pbf">
                      {t('processing.tile.outputFormatPbf', 'PBF')}
                    </MenuItem>
                  </Select>
                  <Typography variant="caption" color="text.secondary" sx={{ mt: 0.5 }}>
                    {t('processing.tile.outputFormatHelp', 'Vector tile output format.')}
                  </Typography>
                </FormControl>
              </Grid>
              <Grid size={{ xs: 12, sm: 4 }}>
                <FormControl fullWidth>
                  <InputLabel id="vt-output-compression-label">
                    {t('processing.tile.outputCompression', 'Output compression')}
                  </InputLabel>
                  <Select
                    labelId="vt-output-compression-label"
                    value={buildConfig.vtConfig.compression}
                    label={t('processing.tile.outputCompression', 'Output compression')}
                    onChange={(event) => {
                      const compression = event.target.value as typeof buildConfig.vtConfig.compression;
                      update({
                        vtConfig: {
                          ...buildConfig.vtConfig,
                          compression,
                        },
                      });
                    }}
                    disabled={disabled}
                  >
                    <MenuItem value="gzip">
                      {t('processing.tile.outputCompressionGzip', 'Gzip')}
                    </MenuItem>
                    <MenuItem value="bz">
                      {t('processing.tile.outputCompressionBz', 'Bzip2')}
                    </MenuItem>
                  </Select>
                  <Typography variant="caption" color="text.secondary" sx={{ mt: 0.5 }}>
                    {t('processing.tile.outputCompressionHelp', 'Compression applied to vector tile output.')}
                  </Typography>
                </FormControl>
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

          <Box>
            <Paper variant="outlined" sx={{ p: 2 }}>
              <Stack spacing={2}>
                <Typography variant="subtitle2">
                  {t('processing.tile.dynamicConcurrencyTitle', 'Dynamic concurrency')}
                </Typography>
                <FormControlLabel
                  control={
                    <Switch
                      checked={dynamicConcurrency.enabled}
                      onChange={(event) => {
                        update({
                          vtConfig: {
                            ...buildConfig.vtConfig,
                            dynamicConcurrency: {
                              ...dynamicConcurrency,
                              enabled: event.target.checked,
                            },
                          },
                        });
                      }}
                      disabled={disabled}
                    />
                  }
                  label={t('processing.tile.dynamicConcurrencyEnabled', 'Enable dynamic concurrency')}
                />
                <Grid container spacing={2}>
                  <Grid size={{ xs: 12, sm: 4 }}>
                    <TextField
                      fullWidth
                      type="number"
                      label={t('processing.tile.dynamicConcurrencyMinConcurrent', 'Min concurrent')}
                      value={dynamicConcurrency.minConcurrent}
                      onChange={(event) => {
                        const minConcurrent = Number(event.target.value);
                        update({
                          vtConfig: {
                            ...buildConfig.vtConfig,
                            dynamicConcurrency: {
                              ...dynamicConcurrency,
                              minConcurrent: Number.isFinite(minConcurrent)
                                ? minConcurrent
                                : dynamicConcurrency.minConcurrent,
                            },
                          },
                        });
                      }}
                      disabled={disabled || !dynamicConcurrency.enabled}
                    />
                  </Grid>
                  <Grid size={{ xs: 12, sm: 4 }}>
                    <TextField
                      fullWidth
                      type="number"
                      label={t('processing.tile.dynamicConcurrencyMaxConcurrent', 'Max concurrent')}
                      value={dynamicConcurrency.maxConcurrent ?? buildConfig.vtConfig.maxConcurrent}
                      onChange={(event) => {
                        const maxConcurrent = Number(event.target.value);
                        update({
                          vtConfig: {
                            ...buildConfig.vtConfig,
                            dynamicConcurrency: {
                              ...dynamicConcurrency,
                              maxConcurrent: Number.isFinite(maxConcurrent)
                                ? maxConcurrent
                                : dynamicConcurrency.maxConcurrent ?? buildConfig.vtConfig.maxConcurrent,
                            },
                          },
                        });
                      }}
                      disabled={disabled || !dynamicConcurrency.enabled}
                    />
                  </Grid>
                  <Grid size={{ xs: 12, sm: 4 }}>
                    <TextField
                      fullWidth
                      type="number"
                      label={t('processing.tile.dynamicConcurrencyHighWatermark', 'High watermark')}
                      value={dynamicConcurrency.highWatermark}
                      onChange={(event) => {
                        const highWatermark = Number(event.target.value);
                        update({
                          vtConfig: {
                            ...buildConfig.vtConfig,
                            dynamicConcurrency: {
                              ...dynamicConcurrency,
                              highWatermark: Number.isFinite(highWatermark)
                                ? highWatermark
                                : dynamicConcurrency.highWatermark,
                            },
                          },
                        });
                      }}
                      disabled={disabled || !dynamicConcurrency.enabled}
                    />
                  </Grid>
                  <Grid size={{ xs: 12, sm: 4 }}>
                    <TextField
                      fullWidth
                      type="number"
                      label={t('processing.tile.dynamicConcurrencyLowWatermark', 'Low watermark')}
                      value={dynamicConcurrency.lowWatermark}
                      onChange={(event) => {
                        const lowWatermark = Number(event.target.value);
                        update({
                          vtConfig: {
                            ...buildConfig.vtConfig,
                            dynamicConcurrency: {
                              ...dynamicConcurrency,
                              lowWatermark: Number.isFinite(lowWatermark)
                                ? lowWatermark
                                : dynamicConcurrency.lowWatermark,
                            },
                          },
                        });
                      }}
                      disabled={disabled || !dynamicConcurrency.enabled}
                    />
                  </Grid>
                  <Grid size={{ xs: 12, sm: 4 }}>
                    <TextField
                      fullWidth
                      type="number"
                      label={t('processing.tile.dynamicConcurrencyAdjustStep', 'Adjust step')}
                      value={dynamicConcurrency.adjustStep}
                      onChange={(event) => {
                        const adjustStep = Number(event.target.value);
                        update({
                          vtConfig: {
                            ...buildConfig.vtConfig,
                            dynamicConcurrency: {
                              ...dynamicConcurrency,
                              adjustStep: Number.isFinite(adjustStep)
                                ? adjustStep
                                : dynamicConcurrency.adjustStep,
                            },
                          },
                        });
                      }}
                      disabled={disabled || !dynamicConcurrency.enabled}
                    />
                  </Grid>
                  <Grid size={{ xs: 12, sm: 4 }}>
                    <TextField
                      fullWidth
                      type="number"
                      label={t('processing.tile.dynamicConcurrencySampleMs', 'Sample interval (ms)')}
                      value={dynamicConcurrency.sampleMs}
                      onChange={(event) => {
                        const sampleMs = Number(event.target.value);
                        update({
                          vtConfig: {
                            ...buildConfig.vtConfig,
                            dynamicConcurrency: {
                              ...dynamicConcurrency,
                              sampleMs: Number.isFinite(sampleMs)
                                ? sampleMs
                                : dynamicConcurrency.sampleMs,
                            },
                          },
                        });
                      }}
                      disabled={disabled || !dynamicConcurrency.enabled}
                    />
                  </Grid>
                </Grid>
                <Typography variant="caption" color="text.secondary">
                  {t(
                    'processing.tile.dynamicConcurrencyHelp',
                    'Adjusts worker counts based on runtime load.',
                  )}
                </Typography>
              </Stack>
            </Paper>
          </Box>
        </Stack>
      </AccordionDetails>
    </Accordion>
  );
};
