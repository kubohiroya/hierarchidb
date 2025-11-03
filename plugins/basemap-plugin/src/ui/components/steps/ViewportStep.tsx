import { Box, Stack, TextField, Typography } from '@mui/material';
import type React from 'react';
import type { MapViewport } from '../../../common/types/BaseMapEntity.js';

export interface ViewportStepProps {
  value: MapViewport | undefined;
  onChange: (next: MapViewport) => void;
}

export const ViewportStep: React.FC<ViewportStepProps> = ({ value, onChange }) => {
  const vp: MapViewport = value || { center: [139.767, 35.681], zoom: 10, bearing: 0, pitch: 0 };

  const set = <K extends keyof MapViewport>(key: K, value: MapViewport[K]) => {
    onChange({ ...vp, [key]: value } as MapViewport);
  };

  const setCenter = (idx: 0 | 1, v: number) => {
    const next: [number, number] = [...vp.center] as [number, number];
    next[idx] = v;
    set('center', next);
  };

  return (
    <Box sx={{ p: 2 }}>
      <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
        Configure the initial map view. Longitude [-180,180], Latitude [-90,90], Zoom [0,24].
      </Typography>
      <Stack direction="row" spacing={2} useFlexGap flexWrap="wrap">
        <Box sx={{ minWidth: 220, flex: '1 1 220px' }}>
          <TextField
            label="Longitude"
            type="number"
            inputProps={{ step: 0.0001, min: -180, max: 180 }}
            value={vp.center[0]}
            onChange={(e) => setCenter(0, Number(e.target.value))}
            fullWidth
          />
        </Box>
        <Box sx={{ minWidth: 220, flex: '1 1 220px' }}>
          <TextField
            label="Latitude"
            type="number"
            inputProps={{ step: 0.0001, min: -90, max: 90 }}
            value={vp.center[1]}
            onChange={(e) => setCenter(1, Number(e.target.value))}
            fullWidth
          />
        </Box>
        <Box sx={{ minWidth: 160, flex: '1 1 160px' }}>
          <TextField
            label="Zoom"
            type="number"
            inputProps={{ step: 0.1, min: 0, max: 24 }}
            value={vp.zoom}
            onChange={(e) => set('zoom', Number(e.target.value))}
            fullWidth
          />
        </Box>
        <Box sx={{ minWidth: 160, flex: '1 1 160px' }}>
          <TextField
            label="Bearing"
            type="number"
            inputProps={{ step: 1, min: -180, max: 180 }}
            value={vp.bearing}
            onChange={(e) => set('bearing', Number(e.target.value))}
            fullWidth
          />
        </Box>
        <Box sx={{ minWidth: 160, flex: '1 1 160px' }}>
          <TextField
            label="Pitch"
            type="number"
            inputProps={{ step: 1, min: 0, max: 60 }}
            value={vp.pitch}
            onChange={(e) => set('pitch', Number(e.target.value))}
            fullWidth
          />
        </Box>
      </Stack>
    </Box>
  );
};
