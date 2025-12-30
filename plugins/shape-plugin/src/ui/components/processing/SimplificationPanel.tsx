import {
  Box,
  FormControlLabel,
  FormGroup,
  FormHelperText,
  Slider,
  Stack,
  Switch,
  Typography,
} from '@mui/material';
import { useTranslation } from '../../i18n.js';

type Props = {
  tolerance: number;
  enablePerFeatureSimplification?: boolean;
  showPerFeatureToggle?: boolean;
  onToleranceChange: (next: number) => void;
  onPerFeatureChange?: (enabled: boolean) => void;
  toleranceHelpKey?: string;
  toleranceLabelKey?: string;
  min?: number;
  max?: number;
  step?: number;
  marks?: Array<{ value: number; label?: string }>;
  disabled?: boolean;
};

export const SimplificationPanel: React.FC<Props> = ({
  tolerance,
  enablePerFeatureSimplification,
  showPerFeatureToggle = true,
  onToleranceChange,
  onPerFeatureChange,
  toleranceHelpKey = 'processing.filter.toleranceHelp',
  toleranceLabelKey = 'processing.filter.tolerance',
  min = 0,
  max = 3,
  step = 0.1,
  marks = [
    { value: 0, label: '0' },
    { value: 0.5, label: '0.5' },
    { value: 1, label: '1' },
    { value: 2, label: '2' },
    { value: 3, label: '3' },
  ],
  disabled,
}) => {
  const { t } = useTranslation();

  return (
    <Stack spacing={2}>
      <Typography variant="subtitle2">
        {t('processing.filter.simplificationTitle', 'Simplification')}
      </Typography>
      <div>
        <Typography gutterBottom>
          {t(toleranceLabelKey, 'Simplification Tolerance (degrees)')}
        </Typography>
        <Box sx={{ px: 2 }}>
          <Slider
            value={tolerance ?? 0.5}
            onChange={(_, value) => {
              onToleranceChange(value as number);
            }}
            min={min}
            max={max}
            step={step}
            marks={marks}
            valueLabelDisplay="auto"
            track="inverted"
            disabled={disabled}
          />
        </Box>
        <Typography variant="caption" color="text.secondary">
          {t(toleranceHelpKey, 'Higher values simplify geometry more aggressively.')}
        </Typography>
      </div>
      {showPerFeatureToggle && (
        <FormGroup>
          <FormControlLabel
            control={
              <Switch
                checked={Boolean(enablePerFeatureSimplification)}
                onChange={(event) => onPerFeatureChange?.(event.target.checked)}
                disabled={disabled}
              />
            }
            label={t('processing.filter.enablePerFeatureSimplification', 'Enable per-feature simplification')}
          />
          <FormHelperText>
            {t('processing.filter.enablePerFeatureSimplificationHelp', 'Apply tolerance per feature instead of globally.')}
          </FormHelperText>
        </FormGroup>
      )}
    </Stack>
  );
};
