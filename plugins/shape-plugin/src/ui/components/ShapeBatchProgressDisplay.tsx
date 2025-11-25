import { LinearProgress, Paper, Stack, Typography } from '@mui/material';
import type { NodeId } from '../../common/shared/index.js';
import { useShapeProgress } from '../hooks/useShapeProgress.js';

export interface ShapeBatchProgressDisplayProps {
  sessionId: string | null;
  draftId?: NodeId;
}

export function ShapeBatchProgressDisplay({
  sessionId,
  draftId,
}: ShapeBatchProgressDisplayProps): JSX.Element | null {
  const { progress, status } = useShapeProgress(sessionId, { autoSubscribe: Boolean(sessionId) });

  if (!sessionId) return null;

  const percentage = progress?.percentage ?? 0;
  const stage = progress?.currentStage ?? status?.stage ?? 'processing';
  const task = progress?.currentTask ?? status?.error ?? 'Working...';
  const total = progress?.total ?? 0;
  const completed = progress?.completed ?? 0;
  const failed = progress?.failed ?? 0;
  const skipped = progress?.skipped ?? 0;

  return (
    <Paper
      variant="outlined"
      sx={{ p: 2, display: 'flex', flexDirection: 'column', gap: 1 }}
      data-testid="shape-plugin-batch-progress-display"
    >
      <Typography variant="subtitle1">
        Batch Session {sessionId} {draftId ? `(draft ${draftId})` : ''}
      </Typography>
      <Typography variant="body2" color="text.secondary">
        Stage: {stage}
      </Typography>
      <Typography variant="body2" color="text.secondary">
        Task: {task}
      </Typography>
      <Stack spacing={0.5}>
        <LinearProgress
          variant="determinate"
          value={percentage}
          data-testid="shape-progress-bar"
          sx={{ height: 8, borderRadius: 1 }}
        />
        <Typography variant="caption" color="text.secondary">
          {percentage}% ・ {completed}/{total} completed ・ failed {failed} ・ skipped {skipped}
        </Typography>
      </Stack>
    </Paper>
  );
}
