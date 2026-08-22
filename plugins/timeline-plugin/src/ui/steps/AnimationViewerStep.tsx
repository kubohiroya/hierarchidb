import { useTranslation } from '@hierarchidb/ui-i18n';
import { Map as MapIcon, Pause, PlayArrow, SkipNext, SkipPrevious } from '@mui/icons-material';
import {
  Box,
  Chip,
  IconButton,
  Paper,
  Slider,
  Stack,
  Switch,
  TextField,
  Tooltip,
  Typography,
} from '@mui/material';
import { useMemo } from 'react';
import type { TimelineFrame } from '~/common/types/index';
import { useFramePlayer } from '~/ui/utils/useFramePlayer';

export interface AnimationViewerStepProps {
  frames: TimelineFrame[];
  initialIndex?: number;
  initialFps?: number;
  loop?: boolean;
}

export function AnimationViewerStep({
  frames,
  initialIndex = 0,
  initialFps = 12,
  loop = true,
}: AnimationViewerStepProps) {
  const player = useFramePlayer({ length: frames.length, initialIndex, initialFps, loop });
  const { t } = useTranslation('timeline-plugin');
  const current = frames[player.index] || null;
  const viewState = useMemo(() => {
    if (current?.viewState) {
      const { longitude, latitude, zoom = 4, bearing = 0, pitch = 0 } = current.viewState;
      return { longitude, latitude, zoom, bearing, pitch };
    }
    return { longitude: 139.7671, latitude: 35.6812, zoom: 4, bearing: 0, pitch: 0 };
  }, [current]);

  return (
    <Stack spacing={2}>
      <Typography variant="subtitle1">{t('animation.title', 'Final Animation Preview')}</Typography>

      <Paper
        variant="outlined"
        sx={{
          height: 280,
          position: 'relative',
          overflow: 'hidden',
          borderRadius: 2,
          background:
            'radial-gradient(circle at 15% 25%, rgba(33,150,243,0.35), transparent 60%),\
            radial-gradient(circle at 82% 25%, rgba(156,39,176,0.32), transparent 55%),\
            linear-gradient(145deg, rgba(33,150,243,0.25), rgba(0,0,0,0.45))',
          '&::after': {
            content: '""',
            position: 'absolute',
            inset: 0,
            background: 'linear-gradient(160deg, rgba(0,0,0,0.15), transparent 65%)',
          },
        }}
      >
        <Box
          sx={{
            position: 'absolute',
            top: 16,
            left: 16,
            display: 'flex',
            alignItems: 'center',
            gap: 1,
            px: 1.5,
            py: 0.75,
            borderRadius: 1,
            bgcolor: (theme) => theme.palette.background.paper,
            boxShadow: 1,
          }}
        >
          <MapIcon fontSize="small" color="action" />
          <Typography variant="body2" fontWeight={600}>
            {t('animation.frameLabel', '{{name}} ({{index}}/{{total}})', {
              name: current?.name ?? t('map.frame', 'Frame'),
              index: player.index + 1,
              total: Math.max(1, frames.length),
            })}
          </Typography>
          <Chip
            size="small"
            label={`${viewState.longitude.toFixed(2)}, ${viewState.latitude.toFixed(2)} / z${viewState.zoom.toFixed(1)}`}
            sx={{ fontWeight: 500 }}
          />
        </Box>

        <Box
          sx={{
            position: 'absolute',
            bottom: 16,
            left: 16,
            color: '_obsolate_common.white',
            textShadow: '0 0 10px rgba(0,0,0,0.45)',
          }}
        >
          <Typography variant="body2">
            {t('animation.playback', 'Playback {{atoms}} at {{fps}} fps', {
              state: player.playing
                ? t('animation.running', 'running')
                : t('animation.paused', 'paused'),
              fps: player.fps,
            })}
          </Typography>
          <Typography variant="caption" display="block">
            {t('map.bearingPitch', 'Bearing {{bearing}}°, Pitch {{pitch}}°', {
              bearing: viewState.bearing?.toFixed?.(1) ?? '0',
              pitch: viewState.pitch?.toFixed?.(1) ?? '0',
            })}
          </Typography>
        </Box>
      </Paper>

      <Stack direction="row" spacing={1} alignItems="center">
        <IconButton onClick={player.prev} size="small">
          <SkipPrevious fontSize="small" />
        </IconButton>
        {player.playing ? (
          <IconButton onClick={player.pause} size="small" color="primary">
            <Pause fontSize="small" />
          </IconButton>
        ) : (
          <IconButton onClick={player.play} size="small" color="primary">
            <PlayArrow fontSize="small" />
          </IconButton>
        )}
        <IconButton onClick={player.next} size="small">
          <SkipNext fontSize="small" />
        </IconButton>

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
            label={t('animation.fpsLabel', 'FPS')}
            size="small"
            type="number"
            InputProps={{ inputProps: { min: 1, max: 60 } }}
            value={player.fps}
            onChange={(e) => {
              const parsed = Number(e.target.value);
              const next = Number.isFinite(parsed) ? parsed : 1;
              player.setFps(Math.max(1, Math.min(60, next)));
            }}
            sx={{ width: 110 }}
          />
        </Tooltip>

        <Tooltip title={t('animation.loop', 'Loop animation')}>
          <Stack direction="row" alignItems="center" spacing={1}>
            <Typography variant="body2">{t('map.loop', 'Loop')}</Typography>
            <Switch checked={player.loop} onChange={(e) => player.setLoop(e.target.checked)} />
          </Stack>
        </Tooltip>
      </Stack>
    </Stack>
  );
}
