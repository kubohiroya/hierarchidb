import type { BuildUnifiedProgressInfo } from '@hierarchidb/batch-api';

export function RouteBatchProgressBar({ snapshot }: { snapshot?: BuildUnifiedProgressInfo | null }) {
  const percentage = Math.round(snapshot?.percentage ?? 0);
  const phase = snapshot?.phase ?? 'idle';
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8, width: '100%' }}>
      <div style={{ flex: 1, height: 8, background: '#eee', borderRadius: 4, overflow: 'hidden' }}>
        <div style={{ width: `${percentage}%`, height: '100%', background: '#1976d2', transition: 'width 120ms linear' }} />
      </div>
      <span style={{ fontFamily: 'monospace', fontSize: 12 }}>{percentage}%</span>
      <span style={{ fontSize: 12, color: '#666' }}>{phase}</span>
    </div>
  );
}
