import { FormControlLabel, Switch, Typography, IconButton, Tooltip, Slider, Box } from "@mui/material";
import { Calculate, Info } from "@mui/icons-material";
import type { ChangeEvent } from "react";

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

const defaultConfig: ConcurrencyConfig = {
  label: "Max concurrent processing sessions",
  tooltipText: "Controls how many CPU cores are used for processing. Using hardware concurrency (auto-detect) is recommended. Higher values speed up processing but may cause browser instability.",
  defaultLabel: "Use hardware concurrency default",
  icon: <Calculate />,
  min: 1,
  max: 16,
  defaultConcurrency: typeof navigator !== 'undefined' ? navigator.hardwareConcurrency || 4 : 4,
};

export const ConcurrencySection = ({
  value,
  useDefault,
  config = defaultConfig,
  onValueChange,
  onUseDefaultChange,
  sx = {},
}: ConcurrencySectionProps) => {
  const finalConfig = { ...defaultConfig, ...config };
  const { label, tooltipText, defaultLabel, icon, min, max, defaultConcurrency } = finalConfig;

  return (
    <Box sx={sx}>
      <Typography sx={{ display: "flex", alignItems: "center", mb: 1 }}>
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
        sx={{ mb: 1, color: "text.secondary" }}
        control={
          <Switch checked={useDefault} onChange={onUseDefaultChange} />
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
          marks={[
            { value: min!, label: min!.toString() },
            { value: max!, label: max!.toString() },
          ]}
        />
      </Box>
    </Box>
  );
};