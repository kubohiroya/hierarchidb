import {
  Box,
  FormControl,
  InputLabel,
  MenuItem,
  Select,
  Stack,
  TextField,
  Typography,
} from '@mui/material';
import type React from 'react';
import { useId, useMemo } from 'react';
import type { MapStyle } from '../../../common/types/BaseMapEntity.js';

export interface MapStyleStepProps {
  value: MapStyle | undefined;
  onChange: (next: MapStyle) => void;
}

export const MapStyleStep: React.FC<MapStyleStepProps> = ({ value, onChange }) => {
  const style = value?.style || 'streets';
  const url = value?.customStyleUrl || '';
  const labelId = useId();

  const presets = useMemo(
    () => ['streets', 'satellite', 'terrain', 'dark', 'light', 'custom'] as const,
    []
  );

  return (
    <Box sx={{ p: 2 }}>
      <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
        Choose a base map style. If you select "custom", provide a valid style JSON URL.
      </Typography>

      <Stack spacing={2}>
        <FormControl fullWidth>
          <InputLabel id={labelId}>Style</InputLabel>
          <Select
            labelId={labelId}
            label="Style"
            value={style}
            onChange={(e) =>
              onChange({
                ...(value || { style: 'streets' }),
                style: e.target.value as MapStyle['style'],
              })
            }
          >
            {presets.map((p) => (
              <MenuItem key={p} value={p}>
                {p}
              </MenuItem>
            ))}
          </Select>
        </FormControl>

        {style === 'custom' && (
          <TextField
            label="Custom Style URL"
            placeholder="https://example.com/style.json"
            value={url}
            onChange={(e) =>
              onChange({
                ...(value || { style: 'custom' }),
                style: 'custom',
                customStyleUrl: e.target.value,
              })
            }
            fullWidth
          />
        )}
      </Stack>
    </Box>
  );
};
