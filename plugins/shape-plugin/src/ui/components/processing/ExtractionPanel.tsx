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
import type { ReactNode } from 'react';
import { useTranslation } from '../../i18n.js';

type ValueTransform = {
  toSlider: (value: number) => number;
  fromSlider: (value: number) => number;
  formatLabel?: (value: number) => string;
};

type Props = {
  tolerance: number;
  enablePerFeatureExtraction?: boolean;
  showPerFeatureToggle?: boolean;
  onToleranceChange: (next: number) => void;
  onPerFeatureChange?: (enabled: boolean) => void;
  toleranceHelpKey?: string;
  toleranceLabelKey?: string;
  showTitle?: boolean;
  valueTransform?: ValueTransform;
  startIcon?: ReactNode;
  endIcon?: ReactNode;
  min?: number;
  max?: number;
  step?: number;
  marks?: Array<{ value: number; label?: string }>;
  disabled?: boolean;
};

export const ExtractionPanel: React.FC<Props> = ({
  tolerance,
  enablePerFeatureExtraction,
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
  showTitle = true,
  valueTransform,
  startIcon,
  endIcon,
}) => {
  const { t } = useTranslation();

  const sliderValue = valueTransform ? valueTransform.toSlider(tolerance) : tolerance;
  const formatLabel = valueTransform?.formatLabel
    ? (value: number) => valueTransform.formatLabel?.(valueTransform.fromSlider(value))
    : undefined;

  return (
    <Stack spacing={2}>
      {showTitle && (
        <Typography variant="subtitle2">
          {t('processing.filter.extractionTitle', 'Extraction')}
        </Typography>
      )}
      <div>
        <Typography gutterBottom>
          {t(toleranceLabelKey, 'Extraction Tolerance (degrees)')}
        </Typography>
        <Box sx={{ px: 2, pt: 2, pb: 2  }}>
          <Stack direction="row" spacing={2} alignItems="center">
            {startIcon ? (
              <Box sx={{ color: 'text.secondary', display: 'flex' }}>{startIcon}</Box>
            ) : null}
            <Slider
              sx={{ flex: 1 }}
              value={sliderValue}
              onChange={(_, value) => {
                const nextValue = valueTransform
                  ? valueTransform.fromSlider(value as number)
                  : (value as number);
                onToleranceChange(nextValue);
              }}
              min={min}
              max={max}
              step={step}
              marks={marks}
              valueLabelDisplay="auto"
              valueLabelFormat={formatLabel}
              track="inverted"
              disabled={disabled}
            />
            {endIcon ? (
              <Box sx={{ color: 'text.secondary', display: 'flex' }}>{endIcon}</Box>
            ) : null}
          </Stack>
        </Box>
        <Typography variant="caption" color="text.secondary">
          {t(toleranceHelpKey, 'Higher values extract geometry more aggressively.')}
        </Typography>
      </div>
      {showPerFeatureToggle && (
        <FormGroup>
          <FormControlLabel
            control={
              <Switch
                checked={Boolean(enablePerFeatureExtraction)}
                onChange={(event) => onPerFeatureChange?.(event.target.checked)}
                disabled={disabled}
              />
            }
            label={t('processing.filter.enablePerFeatureExtraction', 'Enable per-feature extraction')}
          />
          <FormHelperText>
            {t('processing.filter.enablePerFeatureExtractionHelp', 'Apply tolerance per feature instead of globally.')}
          </FormHelperText>
        </FormGroup>
      )}
    </Stack>
  );
};
