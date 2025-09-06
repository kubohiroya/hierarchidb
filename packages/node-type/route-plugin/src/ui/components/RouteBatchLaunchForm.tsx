import { useMemo, useState } from 'react';
import { RouteSourceOrchestrator } from '../../orchestrator/RouteSourceOrchestrator';
import { RouteBatchOrchestrationService } from '../../orchestrator/RouteBatchOrchestrationService';
import type { NetworkPortLike, createRouteBatchManager as createMgrFn } from '../../services/createRouteBatchManager';
import { getOsrmEngineDefaults, getOsrmThrottleDefaults } from '../../services/config/osrm-defaults';

type JobKind = 'recompute' | 'matrix' | 'enrich';

export function RouteBatchLaunchForm({
  nodeId,
  net,
  createRouteBatchManager,
  onLaunched,
}: {
  nodeId: string;
  net: NetworkPortLike;
  createRouteBatchManager: typeof createMgrFn;
  onLaunched?: (res: { jobId: string; count: number }) => void;
}) {
  const [kind, setKind] = useState<JobKind>('recompute');
  const [csvUrl, setCsvUrl] = useState('');
  const [csvUrl2, setCsvUrl2] = useState('');
  const defaults = useMemo(() => getOsrmEngineDefaults(), []);
  const throttleDefaults = useMemo(() => getOsrmThrottleDefaults(), []);
  const [baseUrl, setBaseUrl] = useState(defaults.osrmBaseUrl || 'https://router.project-osrm.org');
  const [profile, setProfile] = useState(defaults.osmProfile || 'car');
  const [rps, setRps] = useState(throttleDefaults.rps || 1);
  const [concurrency, setConcurrency] = useState(throttleDefaults.concurrency || 1);
  const [status, setStatus] = useState<string | null>(null);

  async function launch() {
    setStatus('starting...');
    try {
      const orch = new RouteBatchOrchestrationService(new RouteSourceOrchestrator({ net } as any), net);
      const mgr = createRouteBatchManager({ net, osrmThrottle: { rps, concurrency } });
      const opts = { osrmBaseUrl: baseUrl, osmProfile: profile as any };
      const config = { routeGeneration: { method: 'osm_route', parallel: true, maxConcurrent: 4, retryOnFailure: true, maxRetries: 2 }, locationResolution: { batchSize: 0, cacheResults: false, fallbackToCoordinates: true }, validation: { checkLocationExists: false, checkDuplicateRoutes: false, validateDistance: false } };
      if (kind === 'recompute') {
        const spec = { sources: [{ type: 'csv' as const, url: csvUrl }], defaults: { engine: 'osm_route', mode: 'road_general' } };
        const res = await orch.startFromSources(nodeId, spec as any, mgr as any, config);
        setStatus(`launched ${res.jobId} (${res.count})`); onLaunched?.(res);
      } else if (kind === 'matrix') {
        const origins = { sources: [{ type: 'csv' as const, url: csvUrl }], defaults: { engine: 'osm_route' } };
        const dests = { sources: [{ type: 'csv' as const, url: csvUrl2 }], defaults: { engine: 'osm_route' } };
        const res = await orch.startMatrix(nodeId, origins as any, dests as any, mgr as any, config, opts);
        setStatus(`launched ${res.jobId} (${res.count})`); onLaunched?.(res);
      } else {
        const spec = { sources: [{ type: 'csv' as const, url: csvUrl }], defaults: { engine: 'osm_route' } };
        const res = await orch.startEnrich(nodeId, spec as any, mgr as any, config, { smoothing: 0.5, elevation: true, ...opts });
        setStatus(`launched ${res.jobId} (${res.count})`); onLaunched?.(res);
      }
    } catch (e: any) {
      setStatus(`error: ${e?.message || String(e)}`);
    }
  }

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
        <label>CSV URL{kind==='matrix'?' (origins)':''}:</label>
        <input value={csvUrl} onChange={(e) => setCsvUrl(e.target.value)} placeholder="https://.../od.csv" style={{ width: '100%' }} />
      </div>
      {kind==='matrix' && (
        <div>
          <label>CSV URL (destinations):</label>
          <input value={csvUrl2} onChange={(e) => setCsvUrl2(e.target.value)} placeholder="https://.../dest.csv" style={{ width: '100%' }} />
        </div>
      )}
      <fieldset style={{ border: '1px solid #ddd', padding: 8 }}>
        <legend>OSRM</legend>
        <div style={{ display: 'flex', gap: 8 }}>
          <input value={baseUrl} onChange={(e) => setBaseUrl(e.target.value)} placeholder="OSRM Base URL" style={{ flex: 1 }} />
          <select value={profile} onChange={(e) => setProfile(e.target.value as any)}>
            <option value="car">car</option>
            <option value="bike">bike</option>
            <option value="foot">foot</option>
            <option value="truck">truck</option>
          </select>
        </div>
        <div style={{ display: 'flex', gap: 8, marginTop: 6 }}>
          <label>RPS:</label>
          <input type="number" min={0} value={rps} onChange={(e) => setRps(Number(e.target.value))} style={{ width: 80 }} />
          <label>Concurrency:</label>
          <input type="number" min={1} value={concurrency} onChange={(e) => setConcurrency(Number(e.target.value))} style={{ width: 100 }} />
        </div>
      </fieldset>
      <button onClick={launch}>Launch</button>
      {status && <div style={{ fontFamily: 'monospace', fontSize: 12 }}>{status}</div>}
    </div>
  );
}
