import type { ReactNode, SyntheticEvent } from 'react';
import { Card, CardContent, Grid, Slider, Stack, Typography } from '@mui/material';
import {
  AddCircle as AddCircleIcon,
  RemoveCircle as RemoveCircleIcon,
  ZoomIn as ZoomInIcon,
  ZoomOut as ZoomOutIcon,
} from '@mui/icons-material';
import {
  buildEvenZoomBandBoundaries,
  normalizeZoomBandBoundaries,
} from '@hierarchidb/util';
import { getStep4HoverCardSx } from './step4CardStyles.ts';

type ZoomBandRangeCardProps = {
  title: string;
  helperText: string;
  icon?: ReactNode;
  rangeCountLabel: string;
  rangeCountHelperText: string;
  boundariesLabel: string;
  boundariesHelperText: string;
  minZoom: number;
  maxZoomLimit: number;
  minRanges: number;
  maxRanges: number;
  boundaries: number[];
  onChange: (boundaries: number[]) => void;
  sliderLayout?: 'vertical' | 'horizontal';
  disabled?: boolean;
};

export const ZoomBandRangeCard = ({
  title,
  helperText,
  icon,
  rangeCountLabel,
  rangeCountHelperText,
  boundariesLabel,
  boundariesHelperText,
  minZoom,
  maxZoomLimit,
  minRanges,
  maxRanges,
  boundaries,
  onChange,
  sliderLayout = 'vertical',
  disabled = false,
}: ZoomBandRangeCardProps) => {
  const normalizedBoundaries = normalizeZoomBandBoundaries(
    boundaries,
    minZoom,
    maxZoomLimit,
    maxRanges,
  );
  const rangeCount = Math.min(
    Math.max(normalizedBoundaries.length - 1, minRanges),
    maxRanges,
  );
  const sliderValues = normalizedBoundaries;
  const isHorizontal = sliderLayout === 'horizontal';

  const handleRangeCountChange = (_event: SyntheticEvent | Event, value: number | number[]) => {
    const raw = Array.isArray(value) ? value[0] : value;
    if (typeof raw !== 'number') return;
    const currentMax = normalizedBoundaries[normalizedBoundaries.length - 1] ?? maxZoomLimit;
    const nextBoundaries = buildEvenZoomBandBoundaries(raw, minZoom, currentMax);
    onChange(nextBoundaries);
  };

  const handleBoundariesChange = (_event: SyntheticEvent | Event, value: number | number[]) => {
    if (!Array.isArray(value)) return;
    const nextValues = [...value];
    if (nextValues.length > 0) {
      nextValues[0] = minZoom;
    }
    const nextBoundaries = normalizeZoomBandBoundaries(nextValues, minZoom, maxZoomLimit, maxRanges);
    onChange(nextBoundaries);
  };

  const hoverStyles = getStep4HoverCardSx(disabled);

  return (
    <Card
      variant="outlined"
      sx={{
        height: '100%',
        ...hoverStyles,
      }}
    >
      <CardContent>
        <Stack spacing={2}>
          <Stack spacing={0.5}>
            <Stack direction="row" spacing={1} alignItems="center">
              {icon}
              <Typography variant="subtitle1">{title}</Typography>
            </Stack>
            <Typography variant="body2" color="text.secondary">
              {helperText}
            </Typography>
          </Stack>
          <Grid container rowSpacing={2}>
            <Grid
              size={{ xs: 12, md: isHorizontal ? 6 : 12 }}
              sx={{ pr: isHorizontal ? 2 : 0 }}
            >
              <Stack spacing={1}>
                <Typography variant="body2" fontWeight={600}>
                  {rangeCountLabel}
                </Typography>
                <Stack direction="row" spacing={1} alignItems="center" sx={{ mt: '24px', pt: '24px' }}>
                  <RemoveCircleIcon fontSize="small" color="action" />
                  <Slider
                    sx={{ flex: 1 }}
                    value={rangeCount}
                    min={minRanges}
                    max={maxRanges}
                    step={1}
                    marks
                    valueLabelDisplay="on"
                    onChange={handleRangeCountChange}
                    disabled={disabled}
                    aria-label={rangeCountLabel}
                  />
                  <AddCircleIcon fontSize="small" color="action" />
                </Stack>
                <Typography variant="caption" color="text.secondary">
                  {rangeCountHelperText}
                </Typography>
              </Stack>
            </Grid>
            <Grid
              size={{ xs: 12, md: isHorizontal ? 6 : 12 }}
              sx={{ pl: isHorizontal ? 2 : 0 }}
            >
              <Stack spacing={1}>
                <Typography variant="body2" fontWeight={600}>
                  {boundariesLabel}
                </Typography>
                <Stack direction="row" spacing={1} alignItems="center" sx={{ mt: '24px', pt: '24px'}}>
                  <ZoomOutIcon fontSize="small" color="action" />
                  <Slider
                    sx={{ flex: 1 }}
                    value={sliderValues}
                    min={minZoom}
                    max={maxZoomLimit}
                    step={1}
                    marks
                    disableSwap
                    valueLabelDisplay="on"
                    onChange={handleBoundariesChange}
                    disabled={disabled}
                    getAriaLabel={() => boundariesLabel}
                  />
                  <ZoomInIcon fontSize="small" color="action" />
                </Stack>
                <Typography variant="caption" color="text.secondary">
                  {boundariesHelperText}
                </Typography>
              </Stack>
            </Grid>
          </Grid>
        </Stack>
      </CardContent>
    </Card>
  );
};
