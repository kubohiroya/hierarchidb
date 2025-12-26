import {
  Accordion,
  AccordionDetails,
  AccordionSummary,
  Grid,
  Stack,
  Typography,
  Paper,
} from '@mui/material';
import { Tune as TuneIcon, ExpandMore as ExpandMoreIcon, FilterAlt } from '@mui/icons-material';
import type { BatchConfig, ShapeEntity } from '../../../common/types/index.js';
import { WorkerNumberConfigCard } from './WorkerNumberConfigCard.js';
import { useTranslation } from '../../i18n.js';
import { useSimplify2ConfigSection } from '../../hooks/useSimplificationConfigSection.js';
import { SimplificationPanel } from '../processing/SimplificationPanel.js';
import { PrecisionPanel } from '../processing/PrecisionPanel.js';
import { useBuildCrashInsight } from '../../hooks/useBuildCrashInsight.js';
import { getStageConcurrencyWarning } from '../../utils/buildMonitor.js';

type Props = {
  config: BatchConfig;
  draft?: Partial<ShapeEntity> | null;
  disabled?: boolean;
  onChange: (next: BatchConfig) => void;
};

export const Simplify2ConfigSection: React.FC<Props> = ({ config, draft, disabled, onChange }) => {
  const { t } = useTranslation();
  const crashInsight = useBuildCrashInsight({
    draft,
    nodeId: draft?.nodeId ? String(draft.nodeId) : undefined,
  });
  const {
    baseSimplify2Config,
    quantizeOptions,
    quantizeRank,
    quantizeLabel,
    update,
  } = useSimplify2ConfigSection({ config, disabled, onChange });
  const simplify2Warning = getStageConcurrencyWarning(
    crashInsight,
    'simplify2',
    baseSimplify2Config.workers,
  );
  const simplify2WarningText = simplify2Warning
    ? t(
      'processing.simplify2.memoryWarning',
      'Possible memory pressure: {{message}}',
      { message: simplify2Warning.message },
    )
    : undefined;

  return (
    <Accordion defaultExpanded>
      <AccordionSummary expandIcon={<ExpandMoreIcon />}>
        <Stack direction="row" spacing={2} alignItems="center">
          <TuneIcon color="primary" />
          <Typography variant="subtitle1">
            {t('processing.simplify2.title', 'Tile Preprocessing')}
          </Typography>
        </Stack>
      </AccordionSummary>
      <AccordionDetails sx={{ p: 3 }}>
        <Stack spacing={3}>
          <Typography variant="body2" color="text.secondary">
            {t('processing.simplify2.description', 'Preprocess geometry for stable tile generation.')}
          </Typography>
          <Grid container spacing={3}>
            <Grid size={{ xs: 12, sm: 4 }}>
              <WorkerNumberConfigCard
                icon={<FilterAlt fontSize="small" color="primary" />}
                title={t('processing.filter.workersStage2', 'Number of Workers for Tile Generation (Stage 2)')}
                value={baseSimplify2Config.workers ?? 2}
                helperText={t('processing.filter.workersStage2Help', 'Parallel workers for tile preparation in stage 2.')}
                warningText={simplify2WarningText}
                onChange={(workers) =>
                  update({
                    simplify2Config: {
                      ...baseSimplify2Config,
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
            <Grid size={{ xs: 12, md: 4 }}>
              <Paper variant="outlined" sx={{ p: 2, pl: 1, pr: 2 }}>
                <SimplificationPanel
                  tolerance={baseSimplify2Config.tolerance ?? 0.01}
                  enablePerFeatureSimplification={baseSimplify2Config.enablePerFeatureSimplification ?? true}
                  toleranceHelpKey="processing.filter.toleranceHelpStage2"
                  onToleranceChange={(tolerance) =>
                    update({
                      simplify2Config: {
                        ...baseSimplify2Config,
                        tolerance,
                      },
                    })
                  }
                  onPerFeatureChange={(enablePerFeatureSimplification) =>
                    update({
                      simplify2Config: {
                        ...baseSimplify2Config,
                        enablePerFeatureSimplification,
                      },
                    })
                  }
                  disabled={disabled}
                />
              </Paper>
            </Grid>
            <Grid size={{ xs: 12, md: 4 }}>
              <Paper variant="outlined" sx={{ p: 2, pl: 1, pr: 2 }}>
                <PrecisionPanel
                  quantize={baseSimplify2Config.quantize ?? 10000}
                  quantizeOptions={quantizeOptions}
                  quantizeRank={quantizeRank}
                  quantizeLabel={quantizeLabel}
                  disabled={disabled}
                  onQuantizeChange={(quantize) =>
                    update({
                      simplify2Config: {
                        ...baseSimplify2Config,
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
