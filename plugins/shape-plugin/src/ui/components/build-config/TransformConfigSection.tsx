import {
  Accordion,
  AccordionDetails,
  AccordionSummary,
  Grid,
  Stack,
  Typography,
  Tooltip,
} from '@mui/material';
import {
  FilterAlt as FilterAltIcon,
  InfoOutlined as InfoOutlinedIcon,
  ExpandMore as ExpandMoreIcon,
} from '@mui/icons-material';
import type { ShapeBuildConfig } from '../../../common/types/index.js';
import { WorkerNumberConfigCard } from '@hierarchidb/ui-accordion-config';
import { useTransformConfigSectionView } from './useTransformConfigSectionView.ts';

type Props = {
  config: ShapeBuildConfig;
  disabled?: boolean;
  onChange: (next: ShapeBuildConfig) => void;
};

export const TransformConfigSection: React.FC<Props> = ({ config, disabled, onChange }) => {
  const {
    t,
    baseTransformConfig,
    handleTransformWorkersChange,
  } = useTransformConfigSectionView({ config, onChange });

  return (
    <Accordion defaultExpanded>
      <AccordionSummary expandIcon={<ExpandMoreIcon />}>
        <Stack direction="row" spacing={2} alignItems="center">
          <FilterAltIcon color="primary" />
          <Typography variant="subtitle1">
            {t('processing.transform.title', 'Transform')}
          </Typography>
          <Tooltip
            title={t(
              'processing.transform.summaryHelp',
              'Transform runs turf.simplify with the configured tolerance.',
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
            <Grid size={{ xs: 12, sm: 6, md: 4, lg: 3 }}>
              <WorkerNumberConfigCard
                title={t('processing.transform.workersStage1', 'Transform Workers (Simplification)')}
                value={baseTransformConfig.maxConcurrent}
                icon={<FilterAltIcon fontSize="small" color="primary" />}
                helperText={t(
                  'processing.transform.workersStage1Help',
                  'Higher concurrency can speed up processing but may exhaust browser memory.',
                )}
                warningText={undefined}
                onChange={handleTransformWorkersChange}
                min={1}
                max={4}
                step={1}
                formatLabel={(value) => t('processing.workers.countLabel', '{{count}} workers', { count: value })}
                disabled={disabled}
              />
            </Grid>
          </Grid>
        </Stack>
      </AccordionDetails>
    </Accordion>
  );
};
