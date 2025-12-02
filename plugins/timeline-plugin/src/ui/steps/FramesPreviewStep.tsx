import { useMemo } from 'react';
import { Box, List, ListItem, ListItemText, Typography } from '@mui/material';
import type { TimelineFrame } from '../../common/types/index.js';

export function FramesPreviewStep({
  frames,
  title = 'Frames (flattened descendants)',
}: {
  frames: TimelineFrame[];
  title?: string;
}) {
  const sorted = useMemo(
    () => [...frames].sort((a, b) => a.name.localeCompare(b.name)),
    [frames],
  );
  return (
    <Box>
      <Typography variant="subtitle1" sx={{ mb: 1 }}>{title}</Typography>
      <List dense sx={{ maxHeight: 300, overflow: 'auto', border: '1px solid', borderColor: 'divider' }}>
        {sorted.map((f) => (
          <ListItem key={f.id} disableGutters>
            <ListItemText primary={f.name} secondary={f.id} />
          </ListItem>
        ))}
        {sorted.length === 0 && (
          <ListItem><ListItemText primary="No frames found" /></ListItem>
        )}
      </List>
    </Box>
  );
}
