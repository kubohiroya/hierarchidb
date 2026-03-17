import { useMemo } from 'react';
import type { ReactElement } from 'react';
import { toNodeId } from '@hierarchidb/core-types';
import { resolveProgressPayloadCounts, resolveProgressPercentage } from '@hierarchidb/build-api';
import { useRouteBuildProgress } from '~/ui/hooks/useRouteBuildProgress';
import { useTranslation } from '@hierarchidb/ui-i18n';

export interface RouteBuildSummaryProps {
  nodeId: string;
}

export function RouteBuildSummary({ nodeId }: RouteBuildSummaryProps): ReactElement {
  const { progress, lastError } = useRouteBuildProgress(toNodeId(nodeId));
  const { t } = useTranslation('route-plugin');

  const counts = useMemo(() => {
    if (!progress) return null;
    return resolveProgressPayloadCounts(progress);
  }, [progress]);

  const completed = counts?.completed ?? 0;
  const total = counts?.total ?? 0;
  const failed = counts?.failed ?? 0;
  const resultsCount = counts ? counts.completed : null;

  const pct = useMemo(() => {
    if (!progress) return 0;
    return resolveProgressPercentage(progress);
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
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <div style={{ flex: 1, height: 8, background: '#eee', borderRadius: 4, overflow: 'hidden' }}>
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
      <div style={{ display: 'grid', gap: 4, color: '#333' }}>
        <div>
          {completedLabel}: {completed} / {totalLabel}: {total}
        </div>
        <div>
          {resultsLabel}: {resultsCount ?? 'N/A'}
        </div>
        <div>
          {failedLabel}: {failed}
        </div>
        <div style={{ color: displayError ? '#d32f2f' : '#555' }}>
          {lastErrorLabel}: {displayError ?? noneLabel}
        </div>
      </div>
    </div>
  );
}
