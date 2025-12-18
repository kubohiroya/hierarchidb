import type React from 'react';
import {
  Box,
  Chip,
  Paper,
  Slider,
  Stack,
  Typography,
} from '@mui/material';
import EngineeringIcon from '@mui/icons-material/Engineering';

type WorkerSliderCardProps = {
  title: string;
  value: number;
  min?: number;
  max?: number;
  step?: number;
  marks?: { value: number; label: string }[];
  onChange: (value: number) => void;
  helperText?: string;
  disabled?: boolean;
};

export const WorkerSliderCard: React.FC<WorkerSliderCardProps> = ({
  title,
  value,
  min = 1,
  max = 8,
  step = 1,
  marks = [
    { value: 1, label: '1' },
    { value: 4, label: '4' },
    { value: 8, label: '8' },
  ],
  onChange,
  helperText,
  disabled,
}) => {
  return (
    <Paper
      variant="outlined"
      sx={{
        p: 2,
        borderRadius: 2,
        backgroundColor: (theme) => theme.palette.action.hover,
      }}
    >
      <Stack direction="row" spacing={1} alignItems="center" sx={{ mb: 1 }}>
        <EngineeringIcon fontSize="small" color="primary" />
        <Typography variant="subtitle2">{title}</Typography>
        <Chip label={`${value}`} size="small" variant="outlined" />
      </Stack>
      <Box px={1}>
        <Slider
          value={value}
          onChange={(_, next) => onChange(next as number)}
          min={min}
          max={max}
          step={step}
          marks={marks}
          valueLabelDisplay="auto"
          disabled={disabled}
        />
      </Box>
      {helperText ? (
        <Typography variant="caption" color="text.secondary">
          {helperText}
        </Typography>
      ) : null}
    </Paper>
  );
};
