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
  disabled?: boolean;
};

export const SimplificationPanel: React.FC<Props> = ({
  tolerance,
  enablePerFeatureSimplification,
  showPerFeatureToggle = true,
  onToleranceChange,
  onPerFeatureChange,
  toleranceHelpKey = 'processing.filter.toleranceHelp',
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
          {t('processing.filter.tolerance', 'Simplification Tolerance (degrees)')}
        </Typography>
        <Box sx={{ px: 2 }}>
          <Slider
            value={tolerance ?? 0.01}
            onChange={(_, value) => {
              onToleranceChange(value as number);
            }}
            min={0.001}
            max={0.1}
            step={0.001}
            marks={[
              { value: 0.001, label: '0.001' },
              { value: 0.1, label: '0.1' },
            ]}
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
