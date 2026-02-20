import { useMemo, useState } from 'react';
import type { NodeId } from '@hierarchidb/core-types';
import { RouteSourceOrchestrator } from '~/common/orchestrator/RouteSourceOrchestrator';
import { RouteBuildOrchestrationService } from '~/common/orchestrator/RouteBuildOrchestrationService';
import type { RouteBuildSpec } from '~/common/orchestrator/types';
import { getOsrmEngineDefaults, getOsrmThrottleDefaults } from '~/services/config/osrm-defaults';
import { getNetPort } from '~/services/net/getNetPort';
import { RouteBuildSessionOrchestrator } from '~/services/RouteBuildSessionOrchestrator';
import { OsrmEngine } from '~/services/engines/OsrmEngine';
import { SearouteEngine } from '@hierarchidb/route-engine';
import { ThrottledPort } from '~/services/net/ThrottledPort';
import { RouteBuildConfig, RouteGenerationOptions } from '@hierarchidb/route-api';
import { DEFAULT_ROUTE_BUILD_CONFIG } from '~/common/config/buildConfig';

export type RouteBuildJobKind = 'recompute' | 'matrix' | 'enrich';

export const useRouteBuildLaunchForm = (
  nodeId: NodeId,
  onLaunched?: (res: { nodeId: NodeId; count: number }) => void,
) => {
  const [kind, setKind] = useState<RouteBuildJobKind>('recompute');
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
        ...DEFAULT_ROUTE_BUILD_CONFIG,
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
      const defaults2 = { engine: 'osm_route' as const } satisfies RouteBuildSpec['defaults'];
      if (kind === 'recompute') {
        const spec: RouteBuildSpec = {
          sources: [{ type: 'csv', url: tabularUrl }],
          defaults: { engine: 'osm_route', mode: 'road_general' },
        };
        const res = await orchestrator.startFromSources(nodeId, spec, mgr, config);
        setStatus(`launched ${String(res.nodeId)} (${res.count})`);
        onLaunched?.(res);
      } else if (kind === 'matrix') {
        const origins: RouteBuildSpec = { sources: [{ type: 'csv', url: tabularUrl }], defaults: defaults2 };
        const dests: RouteBuildSpec = { sources: [{ type: 'csv', url: tabularUrl2 }], defaults: defaults2 };
        const res = await orchestrator.startMatrix(nodeId, origins, dests, mgr, config, methodOptions);
        setStatus(`launched ${String(res.nodeId)} (${res.count})`);
        onLaunched?.(res);
      } else {
        const spec: RouteBuildSpec = { sources: [{ type: 'csv', url: tabularUrl }], defaults: defaults2 };
        const res = await orchestrator.startEnrich(nodeId, spec, mgr, config, {
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

export type JobKind = RouteBuildJobKind;
