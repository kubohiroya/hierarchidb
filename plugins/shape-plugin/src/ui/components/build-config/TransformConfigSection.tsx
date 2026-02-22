import {
  Accordion,
  AccordionDetails,
  AccordionSummary,
  Switch,
  FormControl,
  FormControlLabel,
  MenuItem,
  Paper,
  Radio,
  RadioGroup,
  Select,
  Slider,
  Stack,
  Typography,
} from '@mui/material';
import {
  DensityLarge as DensityLargeIcon,
  DensitySmall as DensitySmallIcon,
  ExpandMore as ExpandMoreIcon,
  InfoOutlined as InfoOutlinedIcon,
  Tune as TuneIcon,
} from '@mui/icons-material';
import {
  BuildConfigAccordionSummary,
  BuildConfigSectionTitle,
  getBuildConfigHoverCardSx,
} from '@hierarchidb/ui-accordion-config';
import { useTranslation } from '~/ui/i18n';
import type { ShapeBuildConfig } from '~/common/types/index';
import { useTransformConfigSection } from '~/ui/hooks/useTransformConfigSection';
import type { ChangeEvent } from 'react';

type Props = {
  config: ShapeBuildConfig;
  onChange: (next: ShapeBuildConfig) => void;
  disabled?: boolean;
};

export const TransformConfigSection: React.FC<Props> = ({ config, onChange, disabled }) => {
  const { t } = useTranslation();
  const { baseTransformConfig, update } = useTransformConfigSection({ config, onChange });
  const hoverCardSx = getBuildConfigHoverCardSx(disabled);
  const clampSliderValue = (value: number) => Math.min(2, Math.max(0, value));
  const resolveSliderNumber = (value: number | number[]) => (Array.isArray(value) ? value[0] ?? 0 : value);

  const simplifyAlgorithm = baseTransformConfig.simplifyAlgorithm ?? 'topojson';
  const simplifyTolerance = typeof baseTransformConfig.tolerance === 'number'
    ? clampSliderValue(baseTransformConfig.tolerance)
    : 0.1;
  const simplifyRetryStep = typeof baseTransformConfig.retryToleranceStep === 'number'
    ? clampSliderValue(baseTransformConfig.retryToleranceStep)
    : 0.5;
  const preserveTopology = baseTransformConfig.preserveTopology ?? true;
  const executionLogLevel = baseTransformConfig.executionLogLevel ?? 'summary';

  const updateTransformConfig = (partial: Partial<ShapeBuildConfig['transformConfig']>) => (
    update({
      transformConfig: {
        ...baseTransformConfig,
        ...partial,
      },
    })
  );

  const summaryHelp = simplifyAlgorithm === 'topojson'
    ? t(
      'processing.transform.summaryHelpTopojson',
      'Transform uses topojson simplify first, then runs topology repair checks.',
    )
    : t(
      'processing.transform.summaryHelpGeojson',
      'Transform runs turf.simplify with the configured tolerance.',
    );

  return (
    <Accordion defaultExpanded>
      <AccordionSummary expandIcon={<ExpandMoreIcon />}>
        <BuildConfigAccordionSummary
          icon={<TuneIcon color="primary" />}
          title={t('processing.transform.title', 'Transform')}
          info={summaryHelp}
        />
      </AccordionSummary>
      <AccordionDetails sx={{ p: 1 }}>
        <Stack spacing={2} sx={{ opacity: disabled ? 0.6 : 1 }}>
          <Paper variant="outlined" sx={{ p: 2, ...hoverCardSx }}>
            <Stack spacing={2}>
              <BuildConfigSectionTitle
                icon={<TuneIcon fontSize="small" color="primary" />}
                title={t('processing.transform.simplifySettings.title', 'Simplify settings')}
              />
              <FormControl disabled={disabled}>
                <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
                  {t('processing.transform.algorithm.label', 'Simplify Algorithm')}
                </Typography>
                <RadioGroup
                  row
                  value={simplifyAlgorithm}
                  onChange={(_event, value) => {
                    if (value !== 'geojson' && value !== 'topojson') return;
                    updateTransformConfig({ simplifyAlgorithm: value });
                  }}
                >
                  <FormControlLabel
                    value="topojson"
                    control={<Radio size="small" />}
                    label={t('processing.transform.algorithm.topojson', 'topojson (topology-preserving)')}
                  />
                  <FormControlLabel
                    value="geojson"
                    control={<Radio size="small" />}
                    label={t('processing.transform.algorithm.geojson', 'geojson (turf simplify)')}
                  />
                </RadioGroup>
              </FormControl>

              <FormControlLabel
                control={(
                  <Switch
                    checked={preserveTopology}
                    onChange={(event: ChangeEvent<HTMLInputElement>) => {
                      updateTransformConfig({ preserveTopology: event.target.checked });
                    }}
                  />
                )}
                disabled={disabled || simplifyAlgorithm === 'topojson'}
                label={t('processing.transform.preserveTopology.label', 'Preserve topology')}
              />
              {simplifyAlgorithm === 'topojson' ? (
                <Typography variant="caption" color="text.secondary">
                  {t(
                    'processing.transform.preserveTopology.topojsonHint',
                    'topojson mode always preserves topology in decode simplify path.',
                  )}
                </Typography>
              ) : null}

              <Stack spacing={0.5}>
                <Typography variant="body2" color="text.secondary">
                  {t('processing.transform.simplifyTolerance.label', 'Simplify tolerance')}
                </Typography>
                <Stack direction="row" spacing={2} alignItems="center">
                  <DensitySmallIcon fontSize="small" color="action" />
                  <Slider
                    sx={{ flex: 1 }}
                    value={simplifyTolerance}
                    min={0}
                    max={2}
                    step={0.01}
                    disabled={disabled}
                    valueLabelDisplay="auto"
                    onChange={(_event, value) => {
                      const next = clampSliderValue(resolveSliderNumber(value));
                      updateTransformConfig({ tolerance: next });
                    }}
                  />
                  <DensityLargeIcon fontSize="small" color="action" />
                </Stack>
              </Stack>

              <Stack spacing={0.5}>
                <Typography variant="body2" color="text.secondary">
                  {t('processing.transform.retryToleranceStep.label', 'Retry tolerance step')}
                </Typography>
                <Stack direction="row" spacing={2} alignItems="center">
                  <DensitySmallIcon fontSize="small" color="action" />
                  <Slider
                    sx={{ flex: 1 }}
                    value={simplifyRetryStep}
                    min={0}
                    max={2}
                    step={0.01}
                    disabled={disabled}
                    valueLabelDisplay="auto"
                    onChange={(_event, value) => {
                      const next = clampSliderValue(resolveSliderNumber(value));
                      updateTransformConfig({ retryToleranceStep: next });
                    }}
                  />
                  <DensityLargeIcon fontSize="small" color="action" />
                </Stack>
              </Stack>
            </Stack>
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
                <Select
                  size="small"
                  value={executionLogLevel}
                  onChange={(event) => {
                    const value = event.target.value;
                    if (value !== 'off' && value !== 'summary' && value !== 'verbose') return;
                    updateTransformConfig({ executionLogLevel: value });
                  }}
                >
                  <MenuItem value="off">{t('processing.transform.executionLogLevel.off', 'off')}</MenuItem>
                  <MenuItem value="summary">{t('processing.transform.executionLogLevel.summary', 'summary')}</MenuItem>
                  <MenuItem value="verbose">{t('processing.transform.executionLogLevel.verbose', 'verbose')}</MenuItem>
                </Select>
              </FormControl>
            </Stack>
          </Paper>
        </Stack>
      </AccordionDetails>
    </Accordion>
  );
};
