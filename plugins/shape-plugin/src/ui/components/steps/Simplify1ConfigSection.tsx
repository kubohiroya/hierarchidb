import {
  Accordion,
  AccordionDetails,
  AccordionSummary,
  Grid,
  Stack,
  Typography,
  Paper,
} from '@mui/material';
import { FilterAlt as FilterAltIcon, ExpandMore as ExpandMoreIcon, FilterAlt } from '@mui/icons-material';
import type { BatchConfig } from '../../../common/types/index.js';
import { WorkerNumberConfigCard } from './WorkerNumberConfigCard.js';
import { useTranslation } from '../../i18n.js';
import { useSimplify1ConfigSection } from '../../hooks/useSimplificationConfigSection.js';
import { AreaFilterPanel } from '../processing/AreaFilterPanel.js';
import { SimplificationPanel } from '../processing/SimplificationPanel.js';

type Props = {
  config: BatchConfig;
  disabled?: boolean;
  onChange: (next: BatchConfig) => void;
};

export const Simplify1ConfigSection: React.FC<Props> = ({ config, disabled, onChange }) => {
  const { t } = useTranslation();
  const {
    controlId,
    baseSimplify1Config,
    baseHybridConfig,
    quickRejectLogMin,
    quickRejectLogMax,
    quickRejectLogValue,
    update,
  } = useSimplify1ConfigSection({ config, disabled, onChange });

  return (
    <Accordion defaultExpanded>
      <AccordionSummary expandIcon={<ExpandMoreIcon />}>
        <Stack direction="row" spacing={2} alignItems="center">
          <FilterAltIcon color="primary" />
          <Typography variant="subtitle1">
            {t('processing.simplify1.title', 'Primary Simplification')}
          </Typography>
        </Stack>
      </AccordionSummary>
      <AccordionDetails sx={{ p: 3 }}>
        <Stack spacing={3}>
          <Typography variant="body2" color="text.secondary">
            {t('processing.simplify1.description', 'Reduce geometry while preserving detail required at maximum zoom.')}
          </Typography>
          <Grid container spacing={3}>
            <Grid size={{ xs: 12, sm: 4 }}>
              <WorkerNumberConfigCard
                icon={<FilterAlt fontSize="small" color="primary" />}
                title={t('processing.filter.workersStage1', 'Number of Workers for Polygon-Simplification (Stage 1)')}
                value={baseSimplify1Config.workers ?? 2}
                helperText={t('processing.filter.workersStage1Help', 'Parallel workers for feature simplification in stage 1.')}
                onChange={(workers) =>
                  update({
                    simplify1Config: {
                      ...baseSimplify1Config,
                      workers,
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
            <Grid size={{ xs: 12, md: 8 }}>
              <Paper variant="outlined" sx={{ p: 2, pl: 1, pr: 2 }}>
                <AreaFilterPanel
                  controlId={controlId}
                  baseSimplify1Config={baseSimplify1Config}
                  baseHybridConfig={baseHybridConfig}
                  quickRejectLogMin={quickRejectLogMin}
                  quickRejectLogMax={quickRejectLogMax}
                  quickRejectLogValue={quickRejectLogValue}
                  disabled={disabled}
                  update={update}
                />
              </Paper>
            </Grid>
            <Grid size={{ xs: 12, md: 4 }}>
              <Paper variant="outlined" sx={{ p: 2, pl: 1, pr: 2 }}>
                <SimplificationPanel
                  tolerance={baseSimplify1Config.tolerance ?? 0.01}
                  onToleranceChange={(tolerance) =>
                    update({
                      simplify1Config: {
                        ...baseSimplify1Config,
                        tolerance,
                      },
                    })
                  }
                  showPerFeatureToggle={false}
                  disabled={disabled}
                />
              </Paper>
            </Grid>
          </Grid>
        </Stack>
      </AccordionDetails>
    </Accordion>
  );
};
