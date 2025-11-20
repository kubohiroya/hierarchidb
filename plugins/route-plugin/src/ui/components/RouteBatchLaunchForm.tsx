import { useMemo, useState } from 'react';
import type { JSX } from 'react';
import type { NodeId } from '@hierarchidb/common-types';
import { RouteSourceOrchestrator } from '../../common/orchestrator/RouteSourceOrchestrator.js';
import { RouteBatchOrchestrationService } from '../../common/orchestrator/RouteBatchOrchestrationService.js';
import type { createRouteBatchManager as createMgrFn } from '../../services/createRouteBatchManager.js';
import type { RouteBatchConfig } from '../../services/RouteBatchSession.js';
import type { RouteBatchSpec } from '../../common/orchestrator/types.js';
import { getOsrmEngineDefaults, getOsrmThrottleDefaults } from '../../services/config/osrm-defaults.js';
import { getNetPort } from '../../services/net/getNetPort.js';
import type { RouteGenerationOptions } from '../../common/entities/RouteEntity.js';

type JobKind = 'recompute' | 'matrix' | 'enrich';

export interface RouteBatchLaunchFormProps {
  nodeId: NodeId;
  createRouteBatchManager: typeof createMgrFn;
  onLaunched?: (res: { jobId: string; count: number }) => void;
}

export function RouteBatchLaunchForm({
  nodeId,
  createRouteBatchManager,
  onLaunched,
}: RouteBatchLaunchFormProps): JSX.Element {
  const [kind, setKind] = useState<JobKind>('recompute');
  const [tabularUrl, setTabularUrl] = useState('');
  const [tabularUrl2, setTabularUrl2] = useState('');
  const defaults = useMemo(() => getOsrmEngineDefaults(), []);
  const throttleDefaults = useMemo(() => getOsrmThrottleDefaults(), []);
  const [baseUrl, setBaseUrl] = useState(defaults.osrmBaseUrl || 'https://router.project-osrm.org');
  type OsrmProfile = 'car' | 'truck' | 'bike' | 'foot';
  const [profile, setProfile] = useState<OsrmProfile>((defaults.osmProfile as OsrmProfile | undefined) ?? 'car');
  const [rps, setRps] = useState(throttleDefaults.rps || 1);
  const [concurrency, setConcurrency] = useState(throttleDefaults.concurrency || 1);
  const [status, setStatus] = useState<string | null>(null);

  async function launch() {
    setStatus('starting...');
    try {
      const net = getNetPort();
      const orchestrator = new RouteBatchOrchestrationService(new RouteSourceOrchestrator({ net }));
      const mgr = createRouteBatchManager({ net, osrmThrottle: { rps, concurrency } });
      const methodOptions: RouteGenerationOptions & { profile: OsrmProfile } = {
        osrmBaseUrl: baseUrl,
        profile,
        osmProfile: profile,
      };
      const config: RouteBatchConfig = {
        routeGeneration: {
          method: 'osm_route',
          parallel: true,
          maxConcurrent: 4,
          retryOnFailure: true,
          maxRetries: 2,
        },
        locationResolution: { batchSize: 0, cacheResults: false, fallbackToCoordinates: true },
        validation: { checkLocationExists: false, checkDuplicateRoutes: false, validateDistance: false },
      };
      const targetNodeId = nodeId;
      const defaults = { engine: 'osm_route' as const } satisfies RouteBatchSpec['defaults'];
      if (kind === 'recompute') {
        const spec: RouteBatchSpec = {
          sources: [{ type: 'csv', url: tabularUrl }],
          defaults: { engine: 'osm_route', mode: 'road_general' },
        };
        const res = await orchestrator.startFromSources(targetNodeId, spec, mgr, config);
        setStatus(`launched ${res.jobId} (${res.count})`);
        onLaunched?.(res);
      } else if (kind === 'matrix') {
        const origins: RouteBatchSpec = { sources: [{ type: 'csv', url: tabularUrl }], defaults };
        const dests: RouteBatchSpec = { sources: [{ type: 'csv', url: tabularUrl2 }], defaults };
        const res = await orchestrator.startMatrix(targetNodeId, origins, dests, mgr, config, methodOptions);
        setStatus(`launched ${res.jobId} (${res.count})`);
        onLaunched?.(res);
      } else {
        const spec: RouteBatchSpec = { sources: [{ type: 'csv', url: tabularUrl }], defaults };
        const res = await orchestrator.startEnrich(targetNodeId, spec, mgr, config, {
          smoothing: 0.5,
          elevation: true,
          ...methodOptions,
        });
        setStatus(`launched ${res.jobId} (${res.count})`);
        onLaunched?.(res);
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
        <label>Tabular URL{kind === 'matrix' ? ' (origins)' : ''}:</label>
        <input value={tabularUrl} onChange={(e) => setTabularUrl(e.target.value)} placeholder="https://.../od.csv"
               style={{ width: '100%' }} />
      </div>
      {kind === 'matrix' && (
        <div>
          <label>Tabular URL (destinations):</label>
          <input value={tabularUrl2} onChange={(e) => setTabularUrl2(e.target.value)} placeholder="https://.../dest.csv"
                 style={{ width: '100%' }} />
        </div>
      )}
      <fieldset style={{ border: '1px solid #ddd', padding: 8 }}>
        <legend>OSRM</legend>
        <div style={{ display: 'flex', gap: 8 }}>
          <input value={baseUrl} onChange={(e) => setBaseUrl(e.target.value)} placeholder="OSRM Base URL"
                 style={{ flex: 1 }} />
          <select value={profile} onChange={(e) => setProfile(e.target.value as OsrmProfile)}>
            <option value="car">car</option>
            <option value="bike">bike</option>
            <option value="foot">foot</option>
            <option value="truck">truck</option>
          </select>
        </div>
        <div style={{ display: 'flex', gap: 8, marginTop: 6 }}>
          <label>RPS:</label>
          <input type="number" min={0} value={rps} onChange={(e) => setRps(Number(e.target.value))}
                 style={{ width: 80 }} />
          <label>Concurrency:</label>
          <input type="number" min={1} value={concurrency} onChange={(e) => setConcurrency(Number(e.target.value))}
                 style={{ width: 100 }} />
        </div>
      </fieldset>
      <button onClick={launch}>Launch</button>
      {status && <div style={{ fontFamily: 'monospace', fontSize: 12 }}>{status}</div>}
    </div>
  );
}
