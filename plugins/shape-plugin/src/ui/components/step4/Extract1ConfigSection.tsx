import {
  Accordion,
  AccordionDetails,
  AccordionSummary,
  Grid,
  Stack,
  Typography,
  Paper,
  Tooltip,
} from '@mui/material';
import {
  FilterAlt as FilterAltIcon,
  ExpandMore as ExpandMoreIcon,
  FilterAlt,
  InfoOutlined as InfoOutlinedIcon,
} from '@mui/icons-material';
import type { BatchConfig } from '../../../common/types/index.js';
import { WorkerNumberConfigCard } from './WorkerNumberConfigCard.js';
import { useTranslation } from '../../i18n.js';
import { useExtract1ConfigSection } from '../../hooks/useExtractionConfigSection.js';
import { AreaFilterPanel } from '../processing/AreaFilterPanel.js';
import { ExtractionPanel } from '../processing/ExtractionPanel.js';

type Props = {
  config: BatchConfig;
  disabled?: boolean;
  onChange: (next: BatchConfig) => void;
};

export const Extract1ConfigSection: React.FC<Props> = ({ config, disabled, onChange }) => {
  const { t } = useTranslation();
  const {
    controlId,
    baseExtract1Config,
    baseHybridConfig,
    quickRejectLogMin,
    quickRejectLogMax,
    quickRejectLogValue,
    update,
  } = useExtract1ConfigSection({ config, disabled, onChange });

  return (
    <Accordion defaultExpanded>
      <AccordionSummary expandIcon={<ExpandMoreIcon />}>
        <Stack direction="row" spacing={2} alignItems="center">
          <FilterAltIcon color="primary" />
          <Typography variant="subtitle1">
            {t('processing.extract1.title', 'Transform (Filtering)')}
          </Typography>
          <Tooltip
            title={t(
              'processing.extract1.omissionHelp',
              'When enabled, small features may be removed based on area threshold, minimum vertex count, or hybrid filtering.',
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
                icon={<FilterAlt fontSize="small" color="primary" />}
                title={t('processing.filter.workersStage1', 'Transform Workers (Filtering)')}
                value={baseExtract1Config.workers ?? 2}
                helperText={t('processing.filter.workersStage1Help', 'Parallel workers for transform filtering.')}
                warningText={undefined}
                onChange={(workers) =>
                  update({
                    extract1Config: {
                      ...baseExtract1Config,
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
                  baseExtract1Config={baseExtract1Config}
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
                <ExtractionPanel
                  tolerance={baseExtract1Config.tolerance ?? 0.05}
                  toleranceLabelKey="processing.filter.tolerancePrimary"
                  onToleranceChange={(tolerance) =>
                    update({
                      extract1Config: {
                        ...baseExtract1Config,
                        tolerance,
                      },
                    })
                  }
                  min={0}
                  max={1}
                  step={0.01}
                  marks={[
                    { value: 0, label: '0' },
                    { value: 0.05, label: '0.05' },
                    { value: 0.1, label: '0.1' },
                    { value: 0.25, label: '0.25' },
                    { value: 0.5, label: '0.5' },
                    { value: 0.75, label: '0.75' },
                    { value: 1, label: '1.0' },
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
