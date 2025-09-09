import { useEffect, useState } from 'react';
import { RouteDatabase } from '../../database/RouteDatabase';

export function RouteBatchSummary({ sessionId }: { sessionId: string }) {
  const [state, setState] = useState<{ completed: number; total: number; results: number } | null>(null);
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const db = new RouteDatabase();
      try {
        // @ts-ignore
        const cursor = await (db.table('routeCursors') as any)?.get(sessionId);
        // @ts-ignore
        const results = await (db.table('routeResults') as any)?.where('sessionId').equals(sessionId).count();
        if (!cancelled) setState({
          completed: cursor?.completed ?? 0,
          total: cursor?.total ?? 0,
          results: results ?? 0,
        });
      } catch {
        if (!cancelled) setState({ completed: 0, total: 0, results: 0 });
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [sessionId]);
  if (!state) return <div style={{ fontSize: 12, color: '#666' }}>Loading…</div>;
  const pct = state.total > 0 ? Math.round((state.completed / state.total) * 100) : 0;
  return (
    <div style={{ fontFamily: 'sans-serif', fontSize: 13 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <div style={{ flex: 1, height: 8, background: '#eee', borderRadius: 4, overflow: 'hidden' }}>
          <div style={{ width: `${pct}%`, height: '100%', background: '#388e3c', transition: 'width 120ms linear' }} />
        </div>
        <span>{pct}%</span>
      </div>
      <div style={{ marginTop: 8, color: '#333' }}>
        Completed {state.completed} / {state.total} • Results {state.results}
      </div>
    </div>
  );
}

