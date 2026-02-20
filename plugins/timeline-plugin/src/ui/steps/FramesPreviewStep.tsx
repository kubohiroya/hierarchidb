import { useMemo } from 'react';
import { Box, List, ListItem, ListItemText, Typography } from '@mui/material';
import { useTranslation } from '~/common/i18n/index';
import type { TimelineFrame } from '~/common/types/index';

export function FramesPreviewStep({
  frames,
  title,
}: {
  frames: TimelineFrame[];
  title?: string;
}) {
  const { t } = useTranslation();
  const sorted = useMemo(
    () => [...frames].sort((a, b) => a.name.localeCompare(b.name)),
    [frames],
  );
  return (
    <Box>
      <Typography variant="subtitle1" sx={{ mb: 1 }}>{title ?? t('frames.title', 'Frames (flattened descendants)')}</Typography>
      <List dense sx={{ maxHeight: 300, overflow: 'auto', border: '1px solid', borderColor: 'divider' }}>
        {sorted.map((f) => (
          <ListItem key={f.id} disableGutters>
            <ListItemText primary={f.name} secondary={f.id} />
          </ListItem>
        ))}
        {sorted.length === 0 && (
          <ListItem><ListItemText primary={t('frames.empty', 'No frames found')} /></ListItem>
        )}
      </List>
    </Box>
  );
}
