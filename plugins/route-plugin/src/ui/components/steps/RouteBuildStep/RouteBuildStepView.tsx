import { BuildSessionProgressPanel } from '@hierarchidb/ui-build-progress';
import { Alert, Box, Chip, Stack, Typography } from '@mui/material';
import { memo } from 'react';
import type { RouteBuildStepViewProps } from './types.js';

const RouteBuildStepViewComponent = ({
  reviewText,
  summaryItems,
  missingInputMessage,
  visibleError,
  progressTitle,
  progressPanelProps,
}: RouteBuildStepViewProps) => (
  <Box display="flex" flexDirection="column" gap={2}>
    <Typography variant="body2" color="text.secondary">
      {reviewText}
    </Typography>

    {summaryItems.map((item) => (
      <Stack key={item.id} direction="row" spacing={1} flexWrap="wrap" alignItems="center">
        <Typography variant="subtitle2">{item.label}</Typography>
        <Chip size="small" label={item.value} />
      </Stack>
    ))}

    {missingInputMessage ? <Alert severity="info">{missingInputMessage}</Alert> : null}
    {visibleError ? <Alert severity="error">{visibleError}</Alert> : null}

    <Typography variant="subtitle1">{progressTitle}</Typography>
    <BuildSessionProgressPanel {...progressPanelProps} />
  </Box>
);

export const RouteBuildStepView = memo(RouteBuildStepViewComponent);
RouteBuildStepView.displayName = 'RouteBuildStepView';
