import { Box, IconButton, Paper, Slider, Stack, Switch, TextField, Tooltip, Typography } from '@mui/material';
import { PlayArrow, Pause, SkipNext, SkipPrevious } from '@mui/icons-material';
import { useFramePlayer } from '../utils/useFramePlayer';

export interface AnimationViewerStepProps {
  frames: Array<{ id: string; name: string }>;
  initialIndex?: number;
  initialFps?: number;
  loop?: boolean;
}

export function AnimationViewerStep({ frames, initialIndex = 0, initialFps = 12, loop = true }: AnimationViewerStepProps) {
  const player = useFramePlayer({ length: frames.length, initialIndex, initialFps, loop });
  const current = frames[player.index] || null;

  return (
    <Stack spacing={2}>
      <Typography variant="subtitle1">Final Animation Preview</Typography>

      <Paper variant="outlined" sx={{ height: 280, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        {/* Map or scene preview placeholder; integrate real map later */}
        <Typography variant="body2" color="text.secondary">
          Frame: {current?.name || 'N/A'} ({player.index + 1}/{Math.max(1, frames.length)})
        </Typography>
      </Paper>

      <Stack direction="row" spacing={1} alignItems="center">
        <IconButton onClick={player.prev} size="small"><SkipPrevious fontSize="small" /></IconButton>
        {player.playing ? (
          <IconButton onClick={player.pause} size="small" color="primary"><Pause fontSize="small" /></IconButton>
        ) : (
          <IconButton onClick={player.play} size="small" color="primary"><PlayArrow fontSize="small" /></IconButton>
        )}
        <IconButton onClick={player.next} size="small"><SkipNext fontSize="small" /></IconButton>

        <Box sx={{ flex: 1, px: 2 }}>
          <Slider
            size="small"
            min={0}
            max={Math.max(0, frames.length - 1)}
            value={player.index}
            onChange={(_, v) => player.setIndex(Array.isArray(v) ? v[0] : v)}
            valueLabelDisplay="auto"
          />
        </Box>

        <Tooltip title="Frames per second">
          <TextField
            label="FPS"
            size="small"
            type="number"
            InputProps={{ inputProps: { min: 1, max: 60 } }}
            value={player.fps}
            onChange={(e) => player.setFps(Math.max(1, Math.min(60, Number(e.target.value) || 1)))}
            sx={{ width: 110 }}
          />
        </Tooltip>

        <Tooltip title="Loop animation">
          <Stack direction="row" alignItems="center" spacing={1}>
            <Typography variant="body2">Loop</Typography>
            <Switch checked={player.loop} onChange={(e) => player.setLoop(e.target.checked)} />
          </Stack>
        </Tooltip>
      </Stack>
    </Stack>
  );
}

