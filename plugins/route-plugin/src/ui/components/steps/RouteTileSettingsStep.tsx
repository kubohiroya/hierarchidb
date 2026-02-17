import type React from 'react';
import { useEffect, useId } from 'react';
import { Box, Grid, Slider, TextField, Typography } from '@mui/material';
import type { RouteUpdaterPayload } from '@hierarchidb/route-store';
import type { RouteBuildConfig } from '@hierarchidb/route-api';
import { DEFAULT_ROUTE_BUILD_CONFIG, mergeRouteBuildConfig } from '../../../common/config/buildConfig.js';
import { useTranslation } from '../../../common/i18n/index.js';

interface RouteTileSettingsStepProps {
  draft: RouteUpdaterPayload;
  onUpdate: (updates: Partial<RouteUpdaterPayload['draftData']>) => void;
  disabled?: boolean;
}

const MIN_BUFFER = 0;
const MAX_BUFFER = 512;
const MIN_ZOOM_LEVEL = 0;
const MAX_ZOOM_LEVEL = 22;
const DEFAULT_MIN_ZOOM = 5;
const DEFAULT_MAX_ZOOM = 12;
const DEFAULT_BUFFER = 256;

const clamp = (value: number, min: number, max: number): number => {
  if (Number.isNaN(value)) return min;
  return Math.min(max, Math.max(min, value));
};

export const RouteTileSettingsStep: React.FC<RouteTileSettingsStepProps> = ({ draft, onUpdate, disabled }) => {
  const fieldId = useId();
  const { t } = useTranslation();
  const rawConfig = draft.draftData?.buildConfig as Partial<RouteBuildConfig> | undefined;
  const buildConfig = mergeRouteBuildConfig(DEFAULT_ROUTE_BUILD_CONFIG, rawConfig);
  const zoomBandBoundaries = buildConfig.transformConfig.zoomBandBoundaries;
  const minZoom = clamp(zoomBandBoundaries[0] ?? DEFAULT_MIN_ZOOM, MIN_ZOOM_LEVEL, MAX_ZOOM_LEVEL);
  const maxZoom = clamp(zoomBandBoundaries[zoomBandBoundaries.length - 1] ?? DEFAULT_MAX_ZOOM, MIN_ZOOM_LEVEL, MAX_ZOOM_LEVEL);
  const buffer = clamp(buildConfig.vtConfig.bufferSize ?? DEFAULT_BUFFER, MIN_BUFFER, MAX_BUFFER);

  useEffect(() => {
    const nextConfig = mergeRouteBuildConfig(buildConfig, {
      transformConfig: {
        ...buildConfig.transformConfig,
        zoomBandBoundaries: [minZoom, maxZoom],
      },
      vtConfig: {
        ...buildConfig.vtConfig,
        bufferSize: buffer,
      },
    });
    onUpdate({
      buildConfig: nextConfig,
      zoomRange: [minZoom, maxZoom] as [number, number],
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleBufferChange = (_: Event, value: number | number[]) => {
    const raw = Array.isArray(value) ? value[0] ?? buffer : value ?? buffer;
    const nextBuffer = clamp(Number(raw), MIN_BUFFER, MAX_BUFFER);
    const nextConfig = mergeRouteBuildConfig(buildConfig, {
      vtConfig: {
        ...buildConfig.vtConfig,
        bufferSize: nextBuffer,
      },
    });
    onUpdate({ buildConfig: nextConfig });
  };

  const handleMinZoomChange = (event: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const raw = Number(event.target.value);
    const nextMin = clamp(raw, MIN_ZOOM_LEVEL, MAX_ZOOM_LEVEL);
    const adjustedMax = Math.max(nextMin, maxZoom);
    const nextConfig = mergeRouteBuildConfig(buildConfig, {
      transformConfig: {
        ...buildConfig.transformConfig,
        zoomBandBoundaries: [nextMin, adjustedMax],
      },
    });
    onUpdate({ buildConfig: nextConfig, zoomRange: [nextMin, adjustedMax] });
  };

  const handleMaxZoomChange = (event: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const raw = Number(event.target.value);
    const nextMax = clamp(raw, MIN_ZOOM_LEVEL, MAX_ZOOM_LEVEL);
    const adjustedMin = Math.min(nextMax, minZoom);
    const nextConfig = mergeRouteBuildConfig(buildConfig, {
      transformConfig: {
        ...buildConfig.transformConfig,
        zoomBandBoundaries: [adjustedMin, nextMax],
      },
    });
    onUpdate({ buildConfig: nextConfig, zoomRange: [adjustedMin, nextMax] });
  };

  return (
    <Box display="flex" flexDirection="column" gap={3}>
      <Typography variant="body2" color="text.secondary">
        {t('tileSettings.description', 'Configure vector tile generation parameters.')}
      </Typography>

      <Grid container spacing={3} columns={{ xs: 12 }}>
        <Grid size={{ xs: 12, md: 6 }}>
          <Typography gutterBottom>
            {t('tileSettings.bufferLabel', 'Vector tile buffer size')}: {buffer}
          </Typography>
          <Slider
            min={MIN_BUFFER}
            max={MAX_BUFFER}
            value={buffer}
            valueLabelDisplay="auto"
            onChange={handleBufferChange}
            disabled={disabled}
          />
        </Grid>

        <Grid size={{ xs: 12, md: 6 }}>
          <Typography gutterBottom>
            {t('tileSettings.zoomLabel', 'Tile zoom range')}
          </Typography>
          <Grid container spacing={2} columns={{ xs: 12 }}>
            <Grid size={{ xs: 6 }}>
              <TextField
                type="number"
                label={t('tileSettings.minZoom', 'Min zoom')}
                id={`${fieldId}-min-zoom`}
                name="min-zoom"
                value={minZoom}
                inputProps={{ min: MIN_ZOOM_LEVEL, max: MAX_ZOOM_LEVEL, id: `${fieldId}-min-zoom`, name: 'min-zoom' }}
                onChange={handleMinZoomChange}
                disabled={disabled}
              />
            </Grid>
            <Grid size={{ xs: 6 }}>
              <TextField
                type="number"
                label={t('tileSettings.maxZoom', 'Max zoom')}
                id={`${fieldId}-max-zoom`}
                name="max-zoom"
                value={maxZoom}
                inputProps={{ min: MIN_ZOOM_LEVEL, max: MAX_ZOOM_LEVEL, id: `${fieldId}-max-zoom`, name: 'max-zoom' }}
                onChange={handleMaxZoomChange}
                disabled={disabled}
              />
            </Grid>
          </Grid>
        </Grid>
      </Grid>
    </Box>
  );
};
