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
            value={tolerance ?? 10}
            onChange={(_, value) => {
              onToleranceChange(value as number);
            }}
            min={1}
            max={20}
            step={0.5}
            marks={[
              { value: 1, label: '1' },
              { value: 5, label: '5' },
              { value: 10, label: '10' },
              { value: 15, label: '15' },
              { value: 20, label: '20' },
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
