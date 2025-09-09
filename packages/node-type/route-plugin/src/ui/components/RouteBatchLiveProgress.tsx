import { useEffect, useState } from 'react';
import { useRouteBatchProgress } from '../../ui/hooks/useRouteBatchProgress';

export function RouteBatchLiveProgress({ jobId }: { jobId: string }) {
  const { snapshot } = useRouteBatchProgress(jobId);
  const [pct, setPct] = useState(0);
  useEffect(() => {
    setPct(Math.round(snapshot?.progress ?? 0));
  }, [snapshot?.progress]);
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
      <div style={{ flex: 1, height: 8, background: '#eee', borderRadius: 4, overflow: 'hidden' }}>
        <div style={{ width: `${pct}%`, height: '100%', background: '#1976d2', transition: 'width 120ms linear' }} />
      </div>
      <span style={{ fontFamily: 'monospace', fontSize: 12 }}>{pct}%</span>
      <span style={{ fontSize: 12, color: '#666' }}>{snapshot?.phase ?? 'idle'}</span>
    </div>
  );
}

