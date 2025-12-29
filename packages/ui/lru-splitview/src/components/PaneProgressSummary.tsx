import { Chip } from '@mui/material';
import type { PaneProgress } from '../types/LRUSplitView.js';

type Props = {
  summary: NonNullable<PaneProgress['summary']>;
};

const buildLabel = (summary: NonNullable<PaneProgress['summary']>): string => {
  const { total, success, error, skip } = summary;
  if (total === 0) return '0 / 0';
  const isComplete = success + skip >= total && error === 0;
  const numerator = isComplete ? total : Math.min(success, total);
  const base = `${numerator}/${total}`;
  const skipPart = skip > 0 ? ` skip ${skip}` : '';
  const errorPart = error > 0 ? ` | ${error}` : '';
  return `${base}${skipPart}${errorPart}`;
};

const resolveColor = (summary: NonNullable<PaneProgress['summary']>): 'default' | 'success' | 'warning' | 'error' => {
  const { total, success, error, skip } = summary;
  if (total === 0) return 'default';
  if (error > 0) return 'error';
  if (success + skip >= total) return 'success';
  return 'warning';
};

export const PaneProgressSummary: React.FC<Props> = ({ summary }) => {
  const color = resolveColor(summary);
  return (
    <Chip
      label={buildLabel(summary)}
      size="small"
      color={color}
      variant={color === 'default' ? 'outlined' : 'filled'}
    />
  );
};
