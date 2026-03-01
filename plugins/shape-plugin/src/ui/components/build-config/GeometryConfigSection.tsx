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
import { useGeometryConfigSection } from '~/ui/hooks/useGeometryConfigSection';
import type { ChangeEvent } from 'react';
import { useCallback } from 'react';
import { SimplifyToleranceByAdminLevelCard } from './SimplifyToleranceByAdminLevelCard.tsx';

type Props = {
  config: ShapeBuildConfig;
  onChange: (next: ShapeBuildConfig | ((prev: ShapeBuildConfig) => ShapeBuildConfig)) => void;
  disabled?: boolean;
  disableHoverLift?: boolean;
};

export const GeometryConfigSection: React.FC<Props> = ({
  config,
  onChange,
  disabled,
  disableHoverLift = false,
}) => {
  const { t } = useTranslation();
  const { baseGeometryConfig, update } = useGeometryConfigSection({ config, onChange });
  const hoverCardSx = getBuildConfigHoverCardSx(disabled, disableHoverLift);

  const simplifyAlgorithm = baseGeometryConfig.simplifyAlgorithm ?? 'topojson';
  const preserveTopology = baseGeometryConfig.preserveTopology ?? true;

  const updateGeometryConfig = useCallback((partial: Partial<ShapeBuildConfig['geometryConfig']>) => (
    update({
      geometryConfig: partial,
    })
  ), [update]);

  const summaryHelp = simplifyAlgorithm === 'topojson'
    ? t(
      'processing.geometry.summaryHelpTopojson',
      'Geometry uses topojson simplify first, then runs topology repair checks.',
    )
    : t(
      'processing.geometry.summaryHelpGeojson',
      'Geometry runs turf.simplify with the configured tolerance.',
    );

  return (
    <Accordion defaultExpanded>
      <AccordionSummary expandIcon={<ExpandMoreIcon />}>
        <BuildConfigAccordionSummary
          icon={<TuneIcon color="primary" />}
          title={t('processing.geometry.title', 'Geometry')}
          info={summaryHelp}
        />
      </AccordionSummary>
      <AccordionDetails sx={{ p: 1 }}>
        <Stack spacing={2} sx={{ opacity: disabled ? 0.6 : 1 }}>
          <Paper variant="outlined" sx={{ p: 2, ...hoverCardSx }}>
            <Stack spacing={2}>
              <BuildConfigSectionTitle
                icon={<TuneIcon fontSize="small" color="primary" />}
                title={t('processing.geometry.algorithmSettings.title', 'Algorithm settings')}
              />

              <Grid container spacing={2}>
                <Grid size={{ xs: 12, md: 6 }}>
                  <FormControl disabled={disabled}>
                    <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
                      {t('processing.geometry.algorithm.label', 'Simplify Algorithm')}
                    </Typography>
                    <RadioGroup
                      row
                      value={simplifyAlgorithm}
                      onChange={(_event, value) => {
                        if (value !== 'geojson' && value !== 'topojson') return;
                        updateGeometryConfig({ simplifyAlgorithm: value });
                      }}
                    >
                      <FormControlLabel
                        value="topojson"
                        control={<Radio size="small" />}
                        label={t('processing.geometry.algorithm.topojson', 'topojson (topology-preserving)')}
                      />
                      <FormControlLabel
                        value="geojson"
                        control={<Radio size="small" />}
                        label={t('processing.geometry.algorithm.geojson', 'geojson (turf simplify)')}
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
                            updateGeometryConfig({ preserveTopology: event.target.checked });
                          }}
                        />
                      )}
                      disabled={disabled || simplifyAlgorithm === 'topojson'}
                      label={t('processing.geometry.preserveTopology.label', 'Preserve topology')}
                    />
                    {simplifyAlgorithm === 'topojson' ? (
                      <Typography variant="caption" color="text.secondary">
                        {t(
                          'processing.geometry.preserveTopology.topojsonHint',
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
            geometryConfig={baseGeometryConfig}
            disabled={disabled}
            disableHoverLift={disableHoverLift}
            onChange={updateGeometryConfig}
          />
        </Stack>
      </AccordionDetails>
    </Accordion>
  );
};
