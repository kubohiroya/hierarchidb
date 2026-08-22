import { useTranslation } from '@hierarchidb/ui-i18n';
import { Map as MapIcon } from '@mui/icons-material';
import {
  Box,
  Chip,
  FormControlLabel,
  Paper,
  Slider,
  Stack,
  Switch,
  TextField,
  Typography,
} from '@mui/material';
import { useId, useMemo, useState } from 'react';
import type { TimelineFrame } from '~/common/types/index';

export interface MapPreviewStepProps {
  frames: TimelineFrame[];
  initialIndex?: number;
  onIndexChange?: (index: number) => void;
}

export function MapPreviewStep({ frames, initialIndex = 0, onIndexChange }: MapPreviewStepProps) {
  const { t } = useTranslation('timeline-plugin');
  const controlId = useId();
  const [index, setIndex] = useState(Math.min(initialIndex, Math.max(0, frames.length - 1)));
  const [fps, setFps] = useState(12);
  const [loop, setLoop] = useState(true);
  const frame = useMemo(() => frames[index] || null, [frames, index]);

  const viewState = useMemo(() => {
    if (frame?.viewState) {
      const { longitude, latitude, zoom = 4, bearing = 0, pitch = 0 } = frame.viewState;
      return { longitude, latitude, zoom, bearing, pitch };
    }
    return { longitude: 139.7671, latitude: 35.6812, zoom: 4, bearing: 0, pitch: 0 };
  }, [frame]);

  return (
    <Stack spacing={2}>
      <Typography variant="subtitle1">{t('map.title', 'Map Preview')}</Typography>
      <Paper
        variant="outlined"
        sx={{
          height: 260,
          position: 'relative',
          overflow: 'hidden',
          borderRadius: 2,
          background:
            'radial-gradient(circle at 20% 20%, rgba(123,174,255,0.35), transparent 55%),\
            radial-gradient(circle at 80% 30%, rgba(132, 215, 247, 0.45), transparent 60%),\
            linear-gradient(135deg, rgba(33,150,243,0.35), rgba(156,39,176,0.25))',
          '&::after': {
            content: '""',
            position: 'absolute',
            inset: 0,
            background:
              'radial-gradient(circle at 50% 120%, rgba(255,255,255,0.15), transparent 70%)',
            mixBlendMode: 'screen',
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
            {frame?.name ?? t('map.frame', 'Frame')}
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
            pr: 4,
            color: '_obsolate_common.white',
            textShadow: '0 0 8px rgba(0,0,0,0.35)',
          }}
        >
          <Typography variant="body2">
            {t('map.activeSelections', 'Active selections: {{count}}', {
              count: frame ? index + 1 : 0,
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

      <Box>
        <Typography variant="body2">{t('map.timeline', 'Timeline')}</Typography>
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
        <Typography variant="body2">{t('map.title', 'Map Preview')}</Typography>
        <Stack direction="row" spacing={2} alignItems="center">
          <TextField
            label={t('map.fps', 'FPS')}
            size="small"
            type="number"
            id={`${controlId}-fps`}
            name="fps"
            InputProps={{ inputProps: { min: 1, max: 60, id: `${controlId}-fps`, name: 'fps' } }}
            value={fps}
            onChange={(e) => {
              const parsed = Number(e.target.value);
              const next = Number.isFinite(parsed) ? parsed : 1;
              setFps(Math.max(1, Math.min(60, next)));
            }}
            sx={{ width: 120 }}
          />
          <FormControlLabel
            control={
              <Switch
                checked={loop}
                onChange={(e) => setLoop(e.target.checked)}
                inputProps={{ id: `${controlId}-loop`, name: 'loop' }}
              />
            }
            label={t('map.loop', 'Loop')}
          />
        </Stack>
      </Box>
    </Stack>
  );
}
