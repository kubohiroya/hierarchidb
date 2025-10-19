import type { ProgressSnapshot } from '@hierarchidb/batch-types';

export function RouteBatchProgressBar({ snapshot }: { snapshot?: ProgressSnapshot }) {
  const p = Math.round(snapshot?.progress ?? 0);
  const phase = snapshot?.phase ?? 'idle';
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8, width: '100%' }}>
      <div style={{ flex: 1, height: 8, background: '#eee', borderRadius: 4, overflow: 'hidden' }}>
        <div style={{ width: `${p}%`, height: '100%', background: '#1976d2', transition: 'width 120ms linear' }} />
      </div>
      <span style={{ fontFamily: 'monospace', fontSize: 12 }}>{p}%</span>
      <span style={{ fontSize: 12, color: '#666' }}>{phase}</span>
    </div>
  );
}
