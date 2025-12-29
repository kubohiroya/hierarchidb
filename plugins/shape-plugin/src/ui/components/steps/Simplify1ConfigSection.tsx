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
import type { BatchConfig, ShapeEntity } from '../../../common/types/index.js';
import { WorkerNumberConfigCard } from './WorkerNumberConfigCard.js';
import { useTranslation } from '../../i18n.js';
import { useSimplify1ConfigSection } from '../../hooks/useSimplificationConfigSection.js';
import { AreaFilterPanel } from '../processing/AreaFilterPanel.js';
import { SimplificationPanel } from '../processing/SimplificationPanel.js';
import { useBuildCrashInsight } from '../../hooks/useBuildCrashInsight.js';
import { getStageConcurrencyWarning } from '../../utils/buildWarnings.js';

type Props = {
  config: BatchConfig;
  draft?: Partial<ShapeEntity> | null;
  disabled?: boolean;
  onChange: (next: BatchConfig) => void;
};

export const Simplify1ConfigSection: React.FC<Props> = ({ config, draft, disabled, onChange }) => {
  const { t } = useTranslation();
  const crashInsight = useBuildCrashInsight({
    draft,
    nodeId: draft?.nodeId ? String(draft.nodeId) : undefined,
  });
  const {
    controlId,
    baseSimplify1Config,
    baseHybridConfig,
    quickRejectLogMin,
    quickRejectLogMax,
    quickRejectLogValue,
    update,
  } = useSimplify1ConfigSection({ config, disabled, onChange });
  const simplify1Warning = getStageConcurrencyWarning(
    crashInsight,
    'simplify1',
    baseSimplify1Config.workers,
  );
  const simplify1WarningText = simplify1Warning
    ? t(
      'processing.simplify1.memoryWarning',
      'Possible memory pressure: {{message}}',
      { message: simplify1Warning.message },
    )
    : undefined;

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
                warningText={simplify1WarningText}
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
                  tolerance={baseSimplify1Config.tolerance ?? 40}
                  onToleranceChange={(tolerance) =>
                    update({
                      simplify1Config: {
                        ...baseSimplify1Config,
                        tolerance,
                      },
                    })
                  }
                  min={1}
                  max={50}
                  step={1}
                  marks={[
                    { value: 1, label: '1' },
                    { value: 10, label: '10' },
                    { value: 20, label: '20' },
                    { value: 30, label: '30' },
                    { value: 40, label: '40' },
                    { value: 50, label: '50' },
                  ]}
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
