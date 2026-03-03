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
import { useTranslation } from '~/ui/useTranslation';
import { type ShapeBuildConfig } from '~/common/types/index';
import { useGeometryConfigSection } from '~/ui/hooks/useGeometryConfigSection';
import { SimplifyToleranceByAdminLevelCard } from './SimplifyToleranceByAdminLevelCard.tsx';
import { useGeometryConfigSectionView } from './useGeometryConfigSectionView.js';

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
  const {
    summaryHelp,
    handleSimplifyAlgorithmChange,
    handlePreserveTopologyChange,
  } = useGeometryConfigSectionView({
    simplifyAlgorithm,
    preserveTopology,
    update: (partial) => update({ geometryConfig: partial }),
  });

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
                      onChange={handleSimplifyAlgorithmChange}
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
                          onChange={handlePreserveTopologyChange}
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
            onChange={(partial) => update({ geometryConfig: partial })}
          />
        </Stack>
      </AccordionDetails>
    </Accordion>
  );
};
