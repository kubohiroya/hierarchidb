import { useMemo, useState } from 'react';
import { Box, Slider, Stack, Switch, TextField, Typography, FormControlLabel, Paper } from '@mui/material';

export interface MapPreviewStepProps {
  frames: Array<{ id: string; name: string }>;
  initialIndex?: number;
  onIndexChange?: (index: number) => void;
}

export function MapPreviewStep({ frames, initialIndex = 0, onIndexChange }: MapPreviewStepProps) {
  const [index, setIndex] = useState(Math.min(initialIndex, Math.max(0, frames.length - 1)));
  const [fps, setFps] = useState(12);
  const [loop, setLoop] = useState(true);
  const frame = useMemo(() => frames[index] || null, [frames, index]);

  return (
    <Stack spacing={2}>
      <Typography variant="subtitle1">Map Preview</Typography>
      <Paper variant="outlined" sx={{ height: 240, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        {/* Placeholder for map integration */}
        <Typography variant="body2" color="text.secondary">
          Map preview placeholder — showing frame: {frame?.name || 'N/A'}
        </Typography>
      </Paper>

      <Box>
        <Typography variant="body2">Timeline</Typography>
        <Slider
          size="small"
          min={0}
          max={Math.max(0, frames.length - 1)}
          value={index}
          valueLabelDisplay="auto"
          onChange={(_, v) => {
            const nv = Array.isArray(v) ? v[0] : v;
            setIndex(nv);
            onIndexChange?.(nv);
          }}
        />
      </Box>

      <Box>
        <Typography variant="body2">Auto Mode</Typography>
        <Stack direction="row" spacing={2} alignItems="center">
          <TextField
            label="FPS"
            size="small"
            type="number"
            InputProps={{ inputProps: { min: 1, max: 60 } }}
            value={fps}
            onChange={(e) => setFps(Math.max(1, Math.min(60, Number(e.target.value) || 1)))}
            sx={{ width: 120 }}
          />
          <FormControlLabel control={<Switch checked={loop} onChange={(e) => setLoop(e.target.checked)} />} label="Loop" />
        </Stack>
      </Box>
    </Stack>
  );
}
