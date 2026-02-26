import {
  Accordion,
  AccordionDetails,
  AccordionSummary,
  FormControl,
  FormControlLabel,
  Grid,
  Paper,
  Radio,
  RadioGroup,
  Stack,
  Switch,
  Typography,
} from '@mui/material';
import {
  ExpandMore as ExpandMoreIcon,
  Tune as TuneIcon,
} from '@mui/icons-material';
import {
  BuildConfigAccordionSummary,
  BuildConfigSectionTitle,
  getBuildConfigHoverCardSx,
} from '@hierarchidb/ui-accordion-config';
import { useTranslation } from '~/ui/i18n';
import { type ShapeBuildConfig } from '~/common/types/index';
import { useTransformConfigSection } from '~/ui/hooks/useTransformConfigSection';
import type { ChangeEvent } from 'react';
import { useCallback } from 'react';
import { SimplifyToleranceByAdminLevelCard } from './SimplifyToleranceByAdminLevelCard.tsx';

type Props = {
  config: ShapeBuildConfig;
  onChange: (next: ShapeBuildConfig | ((prev: ShapeBuildConfig) => ShapeBuildConfig)) => void;
  disabled?: boolean;
  disableHoverLift?: boolean;
};

export const TransformConfigSection: React.FC<Props> = ({
  config,
  onChange,
  disabled,
  disableHoverLift = false,
}) => {
  const { t } = useTranslation();
  const { baseTransformConfig, update } = useTransformConfigSection({ config, onChange });
  const hoverCardSx = getBuildConfigHoverCardSx(disabled, disableHoverLift);

  const simplifyAlgorithm = baseTransformConfig.simplifyAlgorithm ?? 'topojson';
  const preserveTopology = baseTransformConfig.preserveTopology ?? true;

  const updateTransformConfig = useCallback((partial: Partial<ShapeBuildConfig['transformConfig']>) => (
    update({
      transformConfig: partial,
    })
  ), [update]);

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
                title={t('processing.transform.algorithmSettings.title', 'Algorithm settings')}
              />

              <Grid container spacing={2}>
                <Grid size={{ xs: 12, md: 6 }}>
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
                </Grid>

                <Grid size={{ xs: 12, md: 6 }}>
                  <Stack spacing={0.5}>
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
                  </Stack>
                </Grid>
              </Grid>
            </Stack>
          </Paper>

          <SimplifyToleranceByAdminLevelCard
            transformConfig={baseTransformConfig}
            disabled={disabled}
            disableHoverLift={disableHoverLift}
            onChange={updateTransformConfig}
          />
        </Stack>
      </AccordionDetails>
    </Accordion>
  );
};
