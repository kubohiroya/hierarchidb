import {
  Accordion,
  AccordionDetails,
  AccordionSummary,
  FormControl,
  FormControlLabel,
  Radio,
  RadioGroup,
  Stack,
  TextField,
  Typography,
  Tooltip,
} from '@mui/material';
import {
  FilterAlt as FilterAltIcon,
  InfoOutlined as InfoOutlinedIcon,
  ExpandMore as ExpandMoreIcon,
} from '@mui/icons-material';
import { useTranslation } from '../../i18n.js';
import type { ShapeBuildConfig } from '../../../common/types/index.js';
import { useTransformConfigSection } from './useTransformConfigSection.ts';

type Props = {
  config: ShapeBuildConfig;
  onChange: (next: ShapeBuildConfig) => void;
  disabled?: boolean;
};

export const TransformConfigSection: React.FC<Props> = ({ config, onChange, disabled }) => {
  const { t } = useTranslation();
  const { baseTransformConfig, update } = useTransformConfigSection({ config, onChange });
  const simplifyAlgorithm = baseTransformConfig.simplifyAlgorithm ?? 'topojson';
  const simplifyTolerance = Number.isFinite(baseTransformConfig.tolerance)
    ? baseTransformConfig.tolerance
    : 0.2;

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
        <Stack spacing={1} sx={{ opacity: disabled ? 0.6 : 1 }}>
          <Typography variant="body2" color="text.secondary">
            {t(
              'processing.transform.concurrencyMovedToBuildStep',
              'Transform concurrency has moved to the Build step. Click the stage spinner in progress summary to edit it.',
            )}
          </Typography>
          <FormControl disabled={disabled}>
            <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
              {t('processing.transform.algorithm', 'Simplify Algorithm')}
            </Typography>
            <RadioGroup
              row
              value={simplifyAlgorithm}
              onChange={(_event, value) => {
                if (value !== 'geojson' && value !== 'topojson') return;
                update({
                  transformConfig: {
                    ...baseTransformConfig,
                    simplifyAlgorithm: value,
                  },
                });
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
          <TextField
            fullWidth
            size="small"
            type="number"
            label={t('processing.transform.tolerance.label', 'Simplify tolerance')}
            value={simplifyTolerance}
            onChange={(event) => {
              const value = Number(event.target.value);
              if (!Number.isFinite(value)) return;
              update({
                transformConfig: {
                  ...baseTransformConfig,
                  tolerance: Math.max(0, value),
                },
              });
            }}
            helperText={t(
              'processing.transform.tolerance.help',
              'Lower values reduce shape collapse and self-intersection risk; higher values simplify more aggressively.',
            )}
            inputProps={{ min: 0, step: 0.01 }}
            disabled={disabled}
          />
        </Stack>
      </AccordionDetails>
    </Accordion>
  );
};
