import type { BuildProgressPayload, BuildUnifiedProgressInfo } from '@hierarchidb/build-api';

const resolvePercentage = (snapshot: BuildUnifiedProgressInfo): number => {
  const payload = snapshot.payload as BuildProgressPayload | undefined;
  if (!payload) return 0;
  const { total, completed } = payload;
  if (typeof total !== 'number' || !Number.isFinite(total) || total <= 0) return 0;
  if (typeof completed !== 'number' || !Number.isFinite(completed)) return 0;
  return Math.round((completed / total) * 100);
};

export function RouteBuildProgressBar({ snapshot }: { snapshot?: BuildUnifiedProgressInfo | null }) {
  const percentage = snapshot ? resolvePercentage(snapshot) : 0;
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
