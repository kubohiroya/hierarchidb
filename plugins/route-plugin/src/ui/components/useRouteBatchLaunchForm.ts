import { useMemo, useState } from 'react';
import type { NodeId } from '@hierarchidb/core-types';
import { RouteSourceOrchestrator } from '../../common/orchestrator/RouteSourceOrchestrator.js';
import { RouteBuildOrchestrationService } from '../../common/orchestrator/RouteBuildOrchestrationService.js';
import type { RouteBatchSpec } from '../../common/orchestrator/types.js';
import { getOsrmEngineDefaults, getOsrmThrottleDefaults } from '../../services/config/osrm-defaults.js';
import { getNetPort } from '../../services/net/getNetPort.js';
import { RouteBuildSessionOrchestrator } from '../../services/RouteBuildSessionOrchestrator.js';
import { OsrmEngine } from '../../services/engines/OsrmEngine.js';
import { SearouteEngine } from '@hierarchidb/route-engine';
import { ThrottledPort } from '../../services/net/ThrottledPort.js';
import { RouteBuildConfig, RouteGenerationOptions } from '@hierarchidb/route-api';

export type JobKind = 'recompute' | 'matrix' | 'enrich';

export const useRouteBatchLaunchForm = (nodeId: NodeId, onLaunched?: (res: { nodeId: NodeId; count: number }) => void) => {
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
      const orchestrator = new RouteBuildOrchestrationService(new RouteSourceOrchestrator());
      const osrmPort = new ThrottledPort(net, { rps, concurrency });
      const mgr = new RouteBuildSessionOrchestrator({
        engines: {
          osrm: new OsrmEngine(osrmPort),
          searoute: new SearouteEngine(),
        },
      });
      const methodOptions: RouteGenerationOptions & { profile: OsrmProfile } = {
        osrmBaseUrl: baseUrl,
        profile,
        osmProfile: profile,
      };
      const config: RouteBuildConfig = {
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
        setStatus(`launched ${String(res.nodeId)} (${res.count})`);
        onLaunched?.(res);
      } else if (kind === 'matrix') {
        const origins: RouteBatchSpec = { sources: [{ type: 'csv', url: tabularUrl }], defaults };
        const dests: RouteBatchSpec = { sources: [{ type: 'csv', url: tabularUrl2 }], defaults };
        const res = await orchestrator.startMatrix(targetNodeId, origins, dests, mgr, config, methodOptions);
        setStatus(`launched ${String(res.nodeId)} (${res.count})`);
        onLaunched?.(res);
      } else {
        const spec: RouteBatchSpec = { sources: [{ type: 'csv', url: tabularUrl }], defaults };
        const res = await orchestrator.startEnrich(targetNodeId, spec, mgr, config, {
          smoothing: 0.5,
          elevation: true,
          ...methodOptions,
        });
        setStatus(`launched ${String(res.nodeId)} (${res.count})`);
        onLaunched?.(res);
      }
    } catch (e: any) {
      setStatus(`error: ${e?.message || String(e)}`);
    }
  }

  return {
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
  };
};

export const useRouteBuildLaunchForm = useRouteBatchLaunchForm;
