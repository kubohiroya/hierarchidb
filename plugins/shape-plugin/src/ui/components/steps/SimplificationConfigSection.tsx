import {
  Accordion,
  AccordionDetails,
  AccordionSummary,
  Grid,
  Stack,
  Typography,
  Paper,
} from '@mui/material';
import { FilterAlt as FilterAltIcon, ExpandMore as ExpandMoreIcon, FilterAlt, Filter } from '@mui/icons-material';
import type { BatchConfig } from '../../../common/types/index.js';
import { WorkerNumberConfigCard } from './WorkerNumberConfigCard.js';
import { useTranslation } from '../../i18n.js';
import { useSimplificationConfigSection } from '../../hooks/useSimplificationConfigSection.js';
import { AreaFilterPanel } from '../processing/AreaFilterPanel.js';
import { SimplificationPanel } from '../processing/SimplificationPanel.js';
import { PrecisionPanel } from '../processing/PrecisionPanel.js';

type Props = {
  config: BatchConfig;
  disabled?: boolean;
  onChange: (next: BatchConfig) => void;
};

export const SimplificationConfigSection: React.FC<Props> = ({ config, disabled, onChange }) => {
  const { t } = useTranslation();
  const {
    controlId,
    baseSimplificationConfig,
    baseHybridConfig,
    quickRejectLogMin,
    quickRejectLogMax,
    quickRejectLogValue,
    quantizeOptions,
    quantizeRank,
    quantizeLabel,
    update,
  } = useSimplificationConfigSection({ config, disabled, onChange });

  return (
    <Accordion defaultExpanded>
      <AccordionSummary expandIcon={<ExpandMoreIcon />}>
        <Stack direction="row" spacing={2} alignItems="center">
          <FilterAltIcon color="primary" />
          <Typography variant="subtitle1">
            {t('processing.filter.title', 'Extraction Setting')}
          </Typography>
        </Stack>
      </AccordionSummary>
      <AccordionDetails sx={{ p: 3 }}>
        <Stack spacing={3}>
          <Grid container spacing={3}>
            <Grid size={{ xs: 12, sm: 4 }}>
              <WorkerNumberConfigCard
                icon={<FilterAlt fontSize="small" color="primary" />}
                title={t('processing.filter.workersStage1', 'Number of Workers for Polygon-Simplification (Stage 1)')}
                value={baseSimplificationConfig.level1Workers ?? 2}
                helperText={t('processing.filter.workersStage1Help', 'Parallel workers for feature simplification in stage 1.')}
                onChange={(level1Workers) =>
                  update({
                    simplificationConfig: {
                      ...baseSimplificationConfig,
                      level1Workers,
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
              <WorkerNumberConfigCard
                icon={<Filter fontSize="small" color="primary" />}
                title={t('processing.filter.workersStage2', 'Number of Workers for Tile Generation (Stage 2)')}
                value={baseSimplificationConfig.level2Workers ?? 2}
                helperText={t('processing.filter.workersStage2Help', 'Parallel workers for tile preparation in stage 2.')}
                onChange={(level2Workers) =>
                  update({
                    simplificationConfig: {
                      ...baseSimplificationConfig,
                      level2Workers,
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
                  baseSimplificationConfig={baseSimplificationConfig}
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
              <Stack spacing={3}>
                <Paper variant="outlined" sx={{ p: 2, pl: 1, pr: 2 }}>
                  <SimplificationPanel
                    baseSimplificationConfig={baseSimplificationConfig}
                    disabled={disabled}
                    update={update}
                  />
                </Paper>
                <Paper variant="outlined" sx={{ p: 2, pl: 1, pr: 2 }}>
                  <PrecisionPanel
                    baseSimplificationConfig={baseSimplificationConfig}
                    quantizeOptions={quantizeOptions}
                    quantizeRank={quantizeRank}
                    quantizeLabel={quantizeLabel}
                    disabled={disabled}
                    update={update}
                  />
                </Paper>
              </Stack>
            </Grid>
          </Grid>
        </Stack>
      </AccordionDetails>
    </Accordion>
  );
};
