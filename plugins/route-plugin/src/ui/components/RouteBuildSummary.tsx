import { toNodeId } from '@hierarchidb/core-types';
import { useTranslation } from '@hierarchidb/ui-i18n';
import type { ReactElement } from 'react';
import { useMemo } from 'react';
import { useRouteBuildProgress } from '~/ui/hooks/useRouteBuildProgress';

export interface RouteBuildSummaryProps {
  nodeId: string;
}

export function RouteBuildSummary({ nodeId }: RouteBuildSummaryProps): ReactElement {
  const { progress, lastError } = useRouteBuildProgress(toNodeId(nodeId));
  const { t } = useTranslation('route-plugin');

  const counts = useMemo(() => {
    if (!progress) return null;
    return progress.taskCounts;
  }, [progress]);

  const completed = counts?.completed;
  const total = counts?.total;
  const failed = counts?.failed;
  const resultsCount = counts ? counts.completed : null;

  const pct = useMemo(() => {
    if (!progress) return null;
    return progress.percentage;
  }, [progress]);
  const failedLabel = t('batch.summary.failedLabel', 'Failed');
  const completedLabel = t('batch.summary.completedLabel', 'Completed');
  const totalLabel = t('batch.summary.totalLabel', 'Total');
  const resultsLabel = t('batch.summary.resultsLabel', 'Results');
  const lastErrorLabel = t('batch.summary.lastErrorLabel', 'Last error');
  const noneLabel = t('batch.summary.noneLabel', 'None');
  const displayError = lastError ?? null;

  return (
    <div style={{ fontFamily: 'sans-serif', fontSize: 13, display: 'grid', gap: 8 }}>
      {pct === null ? (
        <div>{t('batch.phases.pending', 'Pending')}</div>
      ) : (
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <div
            style={{ flex: 1, height: 8, background: '#eee', borderRadius: 4, overflow: 'hidden' }}
          >
            <div
              style={{
                width: `${pct}%`,
                height: '100%',
                background: '#388e3c',
                transition: 'width 120ms linear',
              }}
            />
          </div>
          <span>{pct}%</span>
        </div>
      )}
      <div style={{ display: 'grid', gap: 4, color: '#333' }}>
        <div data-testid="route-summary-completed">
          {completedLabel}: {completed ?? 'N/A'} / {totalLabel}: {total ?? 'N/A'}
        </div>
        <div data-testid="route-summary-results">
          {resultsLabel}: {resultsCount ?? 'N/A'}
        </div>
        <div data-testid="route-summary-failed">
          {failedLabel}: {failed ?? 'N/A'}
        </div>
        <div
          data-testid="route-summary-last-error"
          data-error-atoms={displayError ? 'error' : 'none'}
          style={{ color: displayError ? '#d32f2f' : '#555' }}
        >
          {lastErrorLabel}: {displayError ?? noneLabel}
        </div>
      </div>
    </div>
  );
}
