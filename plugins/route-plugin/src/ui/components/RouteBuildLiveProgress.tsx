import { toNodeId } from '@hierarchidb/core-types';
import { useTranslation } from '@hierarchidb/ui-i18n';
import ErrorOutlineIcon from '@mui/icons-material/ErrorOutline';
import PauseIcon from '@mui/icons-material/Pause';
import PlayArrowIcon from '@mui/icons-material/PlayArrow';
import { Button, CircularProgress, Tooltip } from '@mui/material';
import { useMemo } from 'react';
import { useRouteBuildProgress } from '~/ui/hooks/useRouteBuildProgress';

export function RouteBuildLiveProgress({ jobId }: { jobId: string }) {
  const { progress, status, isPaused, isMutating, mutationError, pause, resume } =
    useRouteBuildProgress(toNodeId(jobId));
  const { t } = useTranslation('route-plugin');

  const pct = useMemo(
    () => (progress ? requireProgressPercentage(progress.percentage) : null),
    [progress]
  );

  const phaseKey = progress?.status ?? status?.status ?? (isPaused ? 'paused' : undefined);
  const stageKey = progress?.stage ?? '';
  const phaseLabel = phaseKey
    ? t(`batch.phases.${phaseKey}`, phaseKey)
    : t('batch.phases.pending', 'Pending');
  const stageLabel = stageKey ? t(`batch.stages.${stageKey}`, stageKey) : phaseLabel;
  const buttonLabel = isPaused ? t('batch.resume', 'Resume') : t('batch.pause', 'Pause');
  const tooltipLabel = isPaused
    ? t('batch.resumeTooltip', buttonLabel)
    : t('batch.pauseTooltip', buttonLabel);
  const Icon = isPaused ? PlayArrowIcon : PauseIcon;
  const handleClick = isPaused ? resume : pause;
  const barColor = isPaused ? '#757575' : '#1976d2';

  return (
    <div
      data-testid="route-live-progress"
      data-progress-atoms={phaseKey ?? 'pending'}
      style={{ display: 'grid', gap: 6 }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
        {pct === null ? (
          <CircularProgress size={16} aria-label={String(phaseLabel)} />
        ) : (
          <div
            style={{ flex: 1, height: 8, background: '#eee', borderRadius: 4, overflow: 'hidden' }}
          >
            <div
              style={{
                width: `${pct}%`,
                height: '100%',
                background: barColor,
                transition: 'width 120ms linear',
              }}
            />
          </div>
        )}
        <span
          data-testid="route-live-progress-percentage"
          style={{ fontFamily: 'monospace', fontSize: 12 }}
        >
          {pct === null ? '—' : `${pct}%`}
        </span>
        <span data-testid="route-live-progress-stage" style={{ fontSize: 12, color: '#555' }}>
          {stageLabel}
        </span>
        <Tooltip title={tooltipLabel} placement="top">
          <span>
            <Button
              size="small"
              variant="outlined"
              data-testid="route-live-progress-toggle"
              aria-pressed={isPaused}
              onClick={handleClick}
              disabled={isMutating || (!progress && !status)}
              startIcon={isMutating ? <CircularProgress size={16} /> : <Icon fontSize="small" />}
            >
              {buttonLabel}
            </Button>
          </span>
        </Tooltip>
      </div>
      {mutationError && (
        <div
          data-testid="route-live-progress-error"
          style={{ display: 'flex', alignItems: 'center', gap: 4, color: '#d32f2f', fontSize: 12 }}
        >
          <ErrorOutlineIcon fontSize="small" />
          <span>{mutationError}</span>
        </div>
      )}
    </div>
  );
}

const requireProgressPercentage = (value: number): number => {
  if (!Number.isFinite(value) || value < 0 || value > 100) {
    throw new Error(`[RouteBuildLiveProgress] percentage must be within 0..100, received ${value}`);
  }
  return value;
};
