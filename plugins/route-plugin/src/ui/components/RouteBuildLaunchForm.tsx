import type { JSX } from 'react';
import type { NodeId } from '@hierarchidb/core-types';
import { useRouteBuildLaunchForm, type JobKind } from './useRouteBuildLaunchForm.ts';

export interface RouteBuildLaunchFormProps {
  nodeId: NodeId;
  onLaunched?: (res: { nodeId: NodeId; count: number }) => void;
}

export function RouteBuildLaunchForm({
  nodeId,
  onLaunched,
}: RouteBuildLaunchFormProps): JSX.Element {
  const {
    kind,
    setKind,
    tabularUrl,
    setTabularUrl,
    tabularUrl2,
    setTabularUrl2,
    baseUrl,
    setBaseUrl,
    profile,
    setProfile,
    rps,
    setRps,
    concurrency,
    setConcurrency,
    status,
    launch,
  } = useRouteBuildLaunchForm(nodeId, onLaunched);

  return (
    <div style={{ display: 'grid', gap: 8, maxWidth: 680 }}>
      <div>
        <label>Job Type:</label>
        <select value={kind} onChange={(e) => setKind(e.target.value as JobKind)}>
          <option value="recompute">Recompute</option>
          <option value="matrix">Matrix</option>
          <option value="enrich">Enrich</option>
        </select>
      </div>
      <div>
        <label>Tabular URL{kind === 'matrix' ? ' (origins)' : ''}:</label>
        <input
          value={tabularUrl}
          onChange={(e) => setTabularUrl(e.target.value)}
          placeholder="https://.../od.csv"
          style={{ width: '100%' }}
        />
      </div>
      {kind === 'matrix' && (
        <div>
          <label>Tabular URL (destinations):</label>
          <input
            value={tabularUrl2}
            onChange={(e) => setTabularUrl2(e.target.value)}
            placeholder="https://.../dest.csv"
            style={{ width: '100%' }}
          />
        </div>
      )}
      <fieldset style={{ border: '1px solid #ddd', padding: 8 }}>
        <legend>OSRM</legend>
        <div style={{ display: 'flex', gap: 8 }}>
          <input
            value={baseUrl}
            onChange={(e) => setBaseUrl(e.target.value)}
            placeholder="OSRM Base URL"
            style={{ flex: 1 }}
          />
          <select value={profile} onChange={(e) => setProfile(e.target.value as typeof profile)}>
            <option value="car">car</option>
            <option value="bike">bike</option>
            <option value="foot">foot</option>
            <option value="truck">truck</option>
          </select>
        </div>
        <div style={{ display: 'flex', gap: 8, marginTop: 6 }}>
          <label>RPS:</label>
          <input
            type="number"
            min={0}
            value={rps}
            onChange={(e) => setRps(Number(e.target.value))}
            style={{ width: 80 }}
          />
          <label>Concurrency:</label>
          <input
            type="number"
            min={1}
            value={concurrency}
            onChange={(e) => setConcurrency(Number(e.target.value))}
            style={{ width: 100 }}
          />
        </div>
      </fieldset>
      <button onClick={launch}>Launch</button>
      {status && <div style={{ fontFamily: 'monospace', fontSize: 12 }}>{status}</div>}
    </div>
  );
}
