import { useMemo } from 'react';
import { useRouteBatchProgress } from '../hooks/useRouteBatchProgress.js';
import { useTranslation } from '../../common/i18n/index.js';

export function RouteBatchSummary({ nodeId }: { nodeId: string }) {
  const { progress, lastError } = useRouteBatchProgress(nodeId);
  const { translations } = useTranslation();

  const completed = useMemo(() => {
    const value = progress?.completed ?? 0;
    return Number.isFinite(value) ? Math.max(0, Math.round(value)) : 0;
  }, [progress?.completed]);

  const total = useMemo(() => {
    const value = progress?.total ?? 0;
    return Number.isFinite(value) ? Math.max(0, Math.round(value)) : 0;
  }, [progress?.total]);

  const failed = useMemo(() => {
    const value = progress?.failed ?? 0;
    return Number.isFinite(value) ? Math.max(0, Math.round(value)) : 0;
  }, [progress?.failed]);

  const resultsCount = useMemo(() => {
    const value = progress?.completed;
    return Number.isFinite(value) ? Math.max(0, Math.round(value ?? 0)) : null;
  }, [progress?.completed]);

  const pct = total > 0 ? Math.min(100, Math.max(0, Math.round((completed / total) * 100))) : 0;
  const summary = translations.batch?.summary;
  const failedLabel = summary?.failedLabel ?? 'Failed';
  const completedLabel = summary?.completedLabel ?? 'Completed';
  const totalLabel = summary?.totalLabel ?? 'Total';
  const resultsLabel = summary?.resultsLabel ?? 'Results';
  const lastErrorLabel = summary?.lastErrorLabel ?? 'Last error';
  const noneLabel = summary?.noneLabel ?? 'None';
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
