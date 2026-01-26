import type React from 'react';
import { Box, Paper, Stack, ToggleButton, Typography } from '@mui/material';

export type MapToggleOption = {
  id: string;
  label: string;
  icon: React.ReactNode;
};

export type MapToggleSelection = Record<string, boolean>;

export const MapToggleCard: React.FC<{
  title: string;
  helperText?: string;
  options: MapToggleOption[];
  selection: MapToggleSelection;
  onToggle: (id: string) => void;
}> = ({ title, helperText, options, selection, onToggle }) => (
  <Paper variant="outlined" sx={{ p: 1.5 }}>
    <Stack spacing={1}>
      {(title || helperText) ? (
        <Box>
          {title ? (
            <Typography variant="subtitle2">{title}</Typography>
          ) : null}
          {helperText ? (
            <Typography variant="caption" color="text.secondary">
              {helperText}
            </Typography>
          ) : null}
        </Box>
      ) : null}
      <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(72px, 1fr))', gap: 1 }}>
        {options.map((option) => (
          <ToggleButton
            key={option.id}
            value={option.id}
            selected={Boolean(selection[option.id])}
            onChange={() => onToggle(option.id)}
            color="primary"
            sx={{
              borderRadius: 1.5,
              textTransform: 'none',
              px: 1,
              py: 0.75,
            }}
            aria-label={option.label}
          >
            <Stack spacing={0.5} alignItems="center">
              {option.icon}
              <Typography variant="caption">{option.label}</Typography>
            </Stack>
          </ToggleButton>
        ))}
      </Box>
    </Stack>
  </Paper>
);
