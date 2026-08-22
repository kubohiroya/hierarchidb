import { Chip, Stack } from '@mui/material';
import type { PaneProgress } from '~/types/LRUSplitView';

type Props = {
  summary: NonNullable<PaneProgress['summary']>;
};

const buildCompletedLabel = (summary: NonNullable<PaneProgress['summary']>): string => {
  const { total, success, skip } = summary;
  if (total === 0) return '0 / 0';
  const numerator = Math.min(success + skip, total);
  return `Completed ${numerator}/${total}`;
};

const resolveColor = (
  summary: NonNullable<PaneProgress['summary']>
): 'default' | 'success' | 'warning' | 'error' => {
  const { total, success, error, skip } = summary;
  if (total === 0) return 'default';
  if (error > 0) return 'error';
  if (success + skip >= total) return 'success';
  return 'warning';
};

export const PaneProgressSummary: React.FC<Props> = ({ summary }) => {
  const color = resolveColor(summary);
  const failedCount = summary.error ?? 0;
  const completedColor = failedCount > 0 ? 'default' : color;
  return (
    <Stack direction="row" spacing={0.5} alignItems="center">
      {failedCount > 0 ? (
        <Chip label={`Failed ${failedCount}`} size="small" color="error" variant="filled" />
      ) : null}
      <Chip
        label={buildCompletedLabel(summary)}
        size="small"
        color={completedColor}
        variant={completedColor === 'default' ? 'outlined' : 'filled'}
      />
    </Stack>
  );
};
