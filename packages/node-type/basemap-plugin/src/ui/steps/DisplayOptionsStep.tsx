import React from 'react';
import { Box, Checkbox, FormControlLabel, Stack, TextField, Typography } from '@mui/material';
import type { DisplayOptions } from '../../types/BaseMapEntity';

export interface DisplayOptionsStepProps {
  value: DisplayOptions | undefined;
  onChange: (next: DisplayOptions) => void;
}

export const DisplayOptionsStep: React.FC<DisplayOptionsStepProps> = ({ value, onChange }) => {
  const opts: DisplayOptions = value || {
    show3dBuildings: false,
    showTraffic: false,
    showTransit: false,
    showTerrain: false,
    showLabels: true,
    attribution: '',
  };
  const set = (k: keyof DisplayOptions, v: any) => onChange({ ...opts, [k]: v } as DisplayOptions);

  return (
    <Box sx={{ p: 2 }}>
      <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
        Tweak display options. These are optional and can be adjusted later.
      </Typography>
      <Stack spacing={1}>
        <FormControlLabel control={<Checkbox checked={opts.show3dBuildings} onChange={(e)=>set('show3dBuildings', e.target.checked)} />} label="Show 3D Buildings" />
        <FormControlLabel control={<Checkbox checked={opts.showTraffic} onChange={(e)=>set('showTraffic', e.target.checked)} />} label="Show Traffic" />
        <FormControlLabel control={<Checkbox checked={opts.showTransit} onChange={(e)=>set('showTransit', e.target.checked)} />} label="Show Transit" />
        <FormControlLabel control={<Checkbox checked={opts.showTerrain} onChange={(e)=>set('showTerrain', e.target.checked)} />} label="Show Terrain" />
        <FormControlLabel control={<Checkbox checked={opts.showLabels} onChange={(e)=>set('showLabels', e.target.checked)} />} label="Show Labels" />
        <TextField label="Attribution" value={opts.attribution || ''} onChange={(e)=>set('attribution', e.target.value)} fullWidth />
      </Stack>
    </Box>
  );
};

