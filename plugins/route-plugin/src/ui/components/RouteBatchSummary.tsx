import { useEffect, useMemo, useState } from 'react';
import { RouteDatabase } from '../../services/database/RouteDatabase.js';
import { useRouteBatchProgress } from '../hooks/useRouteBatchProgress.js';
import { useTranslation } from '../../i18n/index.ts';

export function RouteBatchSummary({ sessionId }: { sessionId: string }) {
  const { progress, lastError } = useRouteBatchProgress(sessionId);
  const { translations } = useTranslation();
  const [cursorStats, setCursorStats] = useState<{ completed: number; total: number } | null>(null);
  const [resultsCount, setResultsCount] = useState<number | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const db = new RouteDatabase();
        const [cursor, results] = await Promise.all([
          db.routeCursors.get(sessionId),
          db.routeResults.where('sessionId').equals(sessionId).count(),
        ]);
        if (cancelled) return;
        setCursorStats({
          completed: cursor?.completed ?? 0,
          total: cursor?.total ?? 0,
        });
        setResultsCount(results ?? 0);
      } catch {
        if (cancelled) return;
        setCursorStats(null);
        setResultsCount(null);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [sessionId]);

  const completed = useMemo(() => {
    const value = progress?.completed ?? cursorStats?.completed ?? 0;
    return Number.isFinite(value) ? Math.max(0, Math.round(value)) : 0;
  }, [cursorStats?.completed, progress?.completed]);

  const total = useMemo(() => {
    const value = progress?.total ?? cursorStats?.total ?? 0;
    return Number.isFinite(value) ? Math.max(0, Math.round(value)) : 0;
  }, [cursorStats?.total, progress?.total]);

  const failed = useMemo(() => {
    const value = progress?.failed ?? 0;
    return Number.isFinite(value) ? Math.max(0, Math.round(value)) : 0;
  }, [progress?.failed]);

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
