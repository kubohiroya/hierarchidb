import {
  Accordion,
  AccordionDetails,
  AccordionSummary,
  FormControl,
  FormHelperText,
  Grid,
  InputLabel,
  MenuItem,
  Select,
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
    handleGeometryEngineChange,
  } = useTransformConfigSectionView({ config, onChange });

  const geometryEngine = baseTransformConfig.geometryEngine ?? 'turf';
  const summaryHelp = geometryEngine === 'geos'
    ? t('processing.transform.summaryHelpGeos', 'Transform runs geos with the configured tolerance.')
    : t('processing.transform.summaryHelpTurf', 'Transform runs turf.simplify with the configured tolerance.');

  return (
    <Accordion defaultExpanded>
      <AccordionSummary expandIcon={<ExpandMoreIcon />}>
        <Stack direction="row" spacing={2} alignItems="center">
          <FilterAltIcon color="primary" />
          <Typography variant="subtitle1">
            {t('processing.transform.title', 'Transform')}
          </Typography>
          <Tooltip
            title={summaryHelp}
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
              <FormControl fullWidth size="small" disabled={disabled}>
                <InputLabel id="shape-transform-geometry-engine-label">
                  {t('processing.transform.geometryEngineTitle', 'Geometry Engine')}
                </InputLabel>
                <Select
                  labelId="shape-transform-geometry-engine-label"
                  label={t('processing.transform.geometryEngineTitle', 'Geometry Engine')}
                  value={geometryEngine}
                  onChange={(event) => handleGeometryEngineChange(event.target.value as 'turf' | 'geos')}
                >
                  <MenuItem value="turf">
                    {t('processing.transform.geometryEngineOptionTurf', 'turf')}
                  </MenuItem>
                  <MenuItem value="geos">
                    {t('processing.transform.geometryEngineOptionGeos', 'geos')}
                  </MenuItem>
                </Select>
                <FormHelperText>
                  {t(
                    'processing.transform.geometryEngineHelp',
                    'Selects the geometry engine used during transform.',
                  )}
                </FormHelperText>
              </FormControl>
            </Grid>
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
