import { Info } from '@mui/icons-material';
import {
  Box,
  FormControlLabel,
  IconButton,
  Slider,
  Switch,
  Tooltip,
  Typography,
} from '@mui/material';
import type { ChangeEvent } from 'react';
import { useConcurrencySection } from './useConcurrencySection.js';
import { useConcurrencySectionView } from './useConcurrencySectionView.js';

export interface ConcurrencyConfig {
  /** Label for the concurrency control */
  label?: string;
  /** Tooltip text explaining the concurrency setting */
  tooltipText?: string;
  /** Label for the default option */
  defaultLabel?: string;
  /** Icon to display */
  icon?: React.ReactNode;
  /** Minimum concurrency value */
  min?: number;
  /** Maximum concurrency value */
  max?: number;
  /** Default hardware concurrency to use */
  defaultConcurrency?: number;
}

export interface ConcurrencySectionProps {
  /** Current concurrency value */
  value: number;
  /** Whether to use default concurrency */
  useDefault: boolean;
  /** Configuration options */
  config?: ConcurrencyConfig;
  /** Callback when value changes */
  onValueChange: (event: Event, value: number | number[]) => void;
  /** Callback when default setting changes */
  onUseDefaultChange: (event: ChangeEvent<HTMLInputElement>) => void;
  /** Custom styling */
  sx?: object;
}

export const ConcurrencySection = ({
  value,
  useDefault,
  config,
  onValueChange,
  onUseDefaultChange,
  sx = {},
}: ConcurrencySectionProps) => {
  const { resolvedConfig, sliderMarks } = useConcurrencySectionView({ config });
  const { icon, switchInputProps } = useConcurrencySection({ config });
  const { label, tooltipText, defaultLabel, min, max, defaultConcurrency } = resolvedConfig;

  return (
    <Box sx={sx}>
      <Typography sx={{ display: 'flex', alignItems: 'center', mb: 1 }}>
        {icon && <Box sx={{ mr: 0.5, display: 'flex', alignItems: 'center' }}>{icon}</Box>}
        {label}
        {tooltipText && (
          <Tooltip title={tooltipText} placement="top">
            <IconButton size="small" sx={{ ml: 0.5 }}>
              <Info fontSize="small" />
            </IconButton>
          </Tooltip>
        )}
      </Typography>

      <FormControlLabel
        sx={{ mb: 1, color: 'text.secondary' }}
        control={
          <Switch
            checked={useDefault}
            onChange={onUseDefaultChange}
            inputProps={switchInputProps}
          />
        }
        label={`${defaultLabel} (${defaultConcurrency})`}
      />

      <Box sx={{ px: 1 }}>
        <Slider
          value={value}
          min={min}
          max={max}
          disabled={useDefault}
          onChange={onValueChange}
          valueLabelDisplay="auto"
          marks={sliderMarks}
        />
      </Box>
    </Box>
  );
};
