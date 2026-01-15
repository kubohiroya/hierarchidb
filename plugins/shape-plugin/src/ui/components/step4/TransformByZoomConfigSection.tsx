import {
  Accordion,
  AccordionDetails,
  AccordionSummary,
  FormControl,
  FormControlLabel,
  Grid,
  Radio,
  RadioGroup,
  Stack,
  Typography,
  Paper,
  Tooltip,
} from '@mui/material';
import {
  Tune as TuneIcon,
  ExpandMore as ExpandMoreIcon,
  InfoOutlined as InfoOutlinedIcon,
} from '@mui/icons-material';
import { WorkerNumberConfigCard } from './WorkerNumberConfigCard.js';
import { useTranslation } from '../../i18n.js';
import { ExtractionPanel } from '../processing/ExtractionPanel.js';
import { PrecisionPanel } from '../processing/PrecisionPanel.js';
import { useTransformByZoomConfigSection } from './useTransformByZoomConfigSection.ts';
import type { ShapeBuildConfig } from '../../../common/types/index.js';

type Props = {
  config: ShapeBuildConfig;
  disabled?: boolean;
  onChange: (next: ShapeBuildConfig) => void;
};

export const TransformByZoomConfigSection: React.FC<Props> = ({ config, disabled, onChange }) => {
  const { t } = useTranslation();
  const {
    baseTransformByZoomConfig,
    quantizeOptions,
    quantizeRank,
    quantizeLabel,
    update,
  } = useTransformByZoomConfigSection({ config, disabled, onChange });
  const extractionMode = baseTransformByZoomConfig.extractionMode;

  return (
    <Accordion defaultExpanded>
      <AccordionSummary expandIcon={<ExpandMoreIcon />}>
        <Stack direction="row" spacing={2} alignItems="center">
          <TuneIcon color="primary" />
          <Typography variant="subtitle1">
            {t('processing.extract2.title', 'Transform (Tile Preprocessing)')}
          </Typography>
          <Tooltip
            title={t(
              'processing.extract2.omissionHelp',
              'When enabled, preprocessing/quantization can remove empty geometries.',
            )}
            placement="top"
          >
            <InfoOutlinedIcon color="action" fontSize="small" />
          </Tooltip>
        </Stack>
      </AccordionSummary>
      <AccordionDetails sx={{ p: 3 }}>
        <Stack spacing={3}>
          <Grid container spacing={3}>
            <Grid size={{ xs: 12, sm: 4 }}>
              <WorkerNumberConfigCard
                icon={<TuneIcon fontSize="small" color="primary" />}
                title={t('processing.filter.workersStage2', 'Transform Workers (Preprocessing)')}
                value={baseTransformByZoomConfig.maxConcurrent}
                helperText={t('processing.filter.workersStage2Help', 'Parallel workers for transform preprocessing.')}
                warningText={undefined}
                onChange={(maxConcurrent) =>
                  update({
                    transformByZoomConfig: {
                      ...baseTransformByZoomConfig,
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
          </Grid>
          <Grid container spacing={3}>
            <Grid size={{ xs: 12, md: 4 }}>
              <Paper variant="outlined" sx={{ p: 2 }}>
                <Stack spacing={1}>
                  <Typography variant="subtitle2">
                    {t('processing.extract2.extractionModeTitle', 'Preprocessing Mode')}
                  </Typography>
                  <Typography variant="body2" color="text.secondary">
                    {t(
                      'processing.extract2.extractionModeHelp',
                      'Choose how geometry is prepared during tile preprocessing.',
                    )}
                  </Typography>
                  <FormControl>
                    <RadioGroup
                      value={extractionMode}
                      onChange={(event) => {
                        const nextValue = event.target.value;
                        update({
                          transformByZoomConfig: {
                            ...baseTransformByZoomConfig,
                            extractionMode: nextValue as typeof extractionMode,
                          },
                        });
                      }}
                    >
                      <FormControlLabel
                        value="off"
                        control={<Radio size="small" />}
                        label={t('processing.extract2.extractionModeOff', 'Off')}
                      />
                      <FormControlLabel
                        value="topojson"
                        control={<Radio size="small" />}
                        label={t('processing.extract2.extractionModeTopo', 'TopoJSON')}
                      />
                      <FormControlLabel
                        value="geojson"
                        control={<Radio size="small" />}
                        label={t('processing.extract2.extractionModeGeo', 'GeoJSON')}
                      />
                    </RadioGroup>
                  </FormControl>
                </Stack>
              </Paper>
            </Grid>
            <Grid size={{ xs: 12, md: 4 }}>
              <Paper variant="outlined" sx={{ p: 2, pl: 1, pr: 2 }}>
                <ExtractionPanel
                  tolerance={baseTransformByZoomConfig.tolerance}
                  toleranceLabelKey="processing.filter.toleranceSecondary"
                  enablePerFeatureExtraction={baseTransformByZoomConfig.enablePerFeatureExtraction}
                  toleranceHelpKey="processing.filter.toleranceHelpStage2"
                  onToleranceChange={(tolerance) =>
                    update({
                      transformByZoomConfig: {
                        ...baseTransformByZoomConfig,
                        tolerance,
                      },
                    })
                  }
                  onPerFeatureChange={(enablePerFeatureExtraction) =>
                    update({
                      transformByZoomConfig: {
                        ...baseTransformByZoomConfig,
                        enablePerFeatureExtraction,
                      },
                    })
                  }
                  min={0}
                  max={1}
                  step={0.05}
                  marks={[
                    { value: 0, label: '0' },
                    { value: 0.25, label: '0.25' },
                    { value: 0.5, label: '0.5' },
                    { value: 0.75, label: '0.75' },
                    { value: 1, label: '1' },
                  ]}
                  disabled={disabled}
                />
              </Paper>
            </Grid>
            <Grid size={{ xs: 12, md: 4 }}>
              <Paper variant="outlined" sx={{ p: 2, pl: 1, pr: 2 }}>
                <PrecisionPanel
                  quantize={baseTransformByZoomConfig.quantize}
                  quantizeOptions={quantizeOptions}
                  quantizeRank={quantizeRank}
                  quantizeLabel={quantizeLabel}
                  disabled={disabled}
                  onQuantizeChange={(quantize) =>
                    update({
                      transformByZoomConfig: {
                        ...baseTransformByZoomConfig,
                        quantize,
                      },
                    })
                  }
                />
              </Paper>
            </Grid>
          </Grid>
        </Stack>
      </AccordionDetails>
    </Accordion>
  );
};
