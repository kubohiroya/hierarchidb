import { Card, CardContent, Stack, Typography } from '@mui/material';
import { buildZoomBandRanges } from '@hierarchidb/util';

type ZoomBandRangeSummaryProps = {
  title: string;
  minZoom: number;
  maxZoomLimit: number;
  boundaries: number[];
  formatItem: (index: number, min: number, max: number) => string;
};

export const ZoomBandRangeSummary = ({
  title,
  minZoom,
  maxZoomLimit,
  boundaries,
  formatItem,
}: ZoomBandRangeSummaryProps) => {
  const ranges = buildZoomBandRanges(boundaries, minZoom, maxZoomLimit);

  return (
    <Card variant="outlined" sx={{ height: '100%' }}>
      <CardContent>
        <Stack spacing={1}>
          <Typography variant="subtitle1">{title}</Typography>
          <Stack spacing={0.5}>
            {ranges.map((range, index) => (
              <Typography key={`${range.min}-${range.max}`} variant="body2">
                {formatItem(index + 1, range.min, range.max)}
              </Typography>
            ))}
          </Stack>
        </Stack>
      </CardContent>
    </Card>
  );
};
