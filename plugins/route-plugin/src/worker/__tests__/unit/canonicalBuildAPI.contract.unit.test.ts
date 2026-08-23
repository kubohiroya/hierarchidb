import { canonicalPluginBuildAPIMethodNames } from '@hierarchidb/build-api';
import { ROUTE_MODES, type RouteCanonicalBuildInputResolverPorts } from '@hierarchidb/route-api';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { DEFAULT_ROUTE_BUILD_CONFIG } from '~/common/config/buildConfig.js';

const startRequest = (
  nodeId: string,
  payload: unknown,
  source: 'committed' | 'working-copy' = 'working-copy'
) => ({
  nodeId,
  input: { source, payload },
});

const mocks = vi.hoisted(() => ({
  prepareSession: vi.fn(),
  startBuildSession: vi.fn(),
  getBuildSessionStatus: vi.fn(),
  pauseBuildSession: vi.fn(),
  cancelQueuedBuildSession: vi.fn(),
  getBuildTasks: vi.fn(),
  subscribeStageSnapshots: vi.fn(),
  subscribeTaskProgress: vi.fn(),
  subscribeSessionState: vi.fn(),
  subscribeSessionHeartbeat: vi.fn(),
  subscribeWorkerLog: vi.fn(),
}));

vi.mock('~/services/RouteBuildSessionOrchestrator.js', () => ({
  RouteBuildSessionOrchestrator: class {
    prepareSession = mocks.prepareSession;
    startBuildSession = mocks.startBuildSession;
    getBuildSessionStatus = mocks.getBuildSessionStatus;
    pauseBuildSession = mocks.pauseBuildSession;
    cancelQueuedBuildSession = mocks.cancelQueuedBuildSession;
  },
}));

vi.mock('@hierarchidb/build-runtime-services', async (importOriginal) => ({
  ...(await importOriginal()),
  createCanonicalBuildRuntimeAdapter: vi.fn(() => ({
    nodeType: 'route',
    getSession: vi.fn(async () => null),
    listSessions: vi.fn(async () => []),
    subscribeSessions: vi.fn(() => () => undefined),
    deleteSession: vi.fn(async () => undefined),
  })),
  createLiveCanonicalPluginBuildSubscriptions: vi.fn(() => ({
    subscribeStageSnapshots: mocks.subscribeStageSnapshots,
    subscribeTaskProgress: mocks.subscribeTaskProgress,
    subscribeSessionState: mocks.subscribeSessionState,
    subscribeSessionHeartbeat: mocks.subscribeSessionHeartbeat,
    subscribeWorkerLog: mocks.subscribeWorkerLog,
  })),
}));

vi.mock('../../getBuildTasks.js', () => ({
  getBuildTasks: mocks.getBuildTasks,
}));

import {
  canonicalBuildAPI,
  setRouteCanonicalBuildInputResolverPortsForTests,
} from '../../canonicalBuildAPI.js';

describe('route canonicalBuildAPI contract', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    setRouteCanonicalBuildInputResolverPortsForTests(null);
  });

  it('exports exactly the canonical plugin build API methods', () => {
    expect(Object.keys(canonicalBuildAPI)).toEqual([...canonicalPluginBuildAPIMethodNames]);
  });

  it('rejects a start request without explicit build config', async () => {
    await expect(
      canonicalBuildAPI.startBuildSession({
        nodeId: 'route-contract-node',
        input: { source: 'working-copy', payload: {} },
      })
    ).rejects.toThrow('payload.buildConfig is required');
  });

  it('delegates commands, queries, and subscriptions through the canonical surface', async () => {
    const nodeId = 'route-contract-node';
    const callback = vi.fn();
    const unsubscribe = vi.fn();
    const status = {
      nodeId,
      status: 'running' as const,
      progress: { total: 1, completed: 0, failed: 0, skipped: 0, percentage: 0 },
    };
    mocks.startBuildSession.mockResolvedValue(status);
    mocks.getBuildSessionStatus.mockResolvedValue(status);
    mocks.getBuildTasks.mockResolvedValue([]);
    for (const subscribe of [
      mocks.subscribeStageSnapshots,
      mocks.subscribeTaskProgress,
      mocks.subscribeSessionState,
      mocks.subscribeSessionHeartbeat,
      mocks.subscribeWorkerLog,
    ]) {
      subscribe.mockReturnValue(unsubscribe);
    }
    const buildConfig = DEFAULT_ROUTE_BUILD_CONFIG;
    const draftData = {
      buildConfig,
      routeBuildInput: { kind: 'direct-route' },
      routeMode: ROUTE_MODES.ROAD,
      startLocationId: 'location-start',
      endLocationId: 'location-end',
      lineGeometry: [
        [139, 35],
        [139.5, 35.5],
        [140, 36],
      ],
    };

    await expect(
      canonicalBuildAPI.startBuildSession(startRequest(nodeId, draftData))
    ).resolves.toBe(status);
    expect(mocks.prepareSession).toHaveBeenCalledWith(nodeId, buildConfig, {
      routes: [
        {
          startLocationId: 'location-start',
          endLocationId: 'location-end',
          startCoordinates: [139, 35],
          endCoordinates: [140, 36],
          routeMode: ROUTE_MODES.ROAD,
        },
      ],
    });
    expect(mocks.startBuildSession).toHaveBeenCalledWith(nodeId);
    await expect(canonicalBuildAPI.getBuildSessionStatus(nodeId)).resolves.toBe(status);
    await canonicalBuildAPI.pauseBuildSession(nodeId, 'pause reason');
    expect(mocks.pauseBuildSession).toHaveBeenCalledWith(nodeId, 'pause reason');
    await canonicalBuildAPI.cancelQueuedBuildSession(nodeId, 'cancel reason');
    expect(mocks.cancelQueuedBuildSession).toHaveBeenCalledWith(nodeId, 'cancel reason');
    await expect(canonicalBuildAPI.getBuildTasks(nodeId)).resolves.toEqual([]);

    expect(canonicalBuildAPI.subscribeStageSnapshots(nodeId, callback)).toBe(unsubscribe);
    expect(canonicalBuildAPI.subscribeTaskProgress(nodeId, callback)).toBe(unsubscribe);
    expect(canonicalBuildAPI.subscribeSessionState(nodeId, callback)).toBe(unsubscribe);
    expect(canonicalBuildAPI.subscribeSessionHeartbeat(nodeId, callback)).toBe(unsubscribe);
    expect(canonicalBuildAPI.subscribeWorkerLog(nodeId, callback)).toBe(unsubscribe);
  });

  it('rejects invalid persisted direct-route coordinates', async () => {
    await expect(
      canonicalBuildAPI.startBuildSession(
        startRequest('route-contract-node', {
          buildConfig: DEFAULT_ROUTE_BUILD_CONFIG,
          routeBuildInput: { kind: 'direct-route' },
          routeMode: ROUTE_MODES.ROAD,
          startLocationId: 'location-start',
          endLocationId: 'location-end',
          lineGeometry: [
            [181, 35],
            [140, 36],
          ],
        })
      )
    ).rejects.toThrow('payload.lineGeometry[0] contains invalid coordinates');
  });

  it('rejects a build config with missing required leaf values', async () => {
    await expect(
      canonicalBuildAPI.startBuildSession(
        startRequest('route-contract-node', {
          buildConfig: {
            sourceConfig: {},
            geometryConfig: {},
            tileEmitConfig: {},
            routeGeneration: {},
          },
          routeBuildInput: { kind: 'direct-route' },
          routeMode: ROUTE_MODES.ROAD,
          startLocationId: 'location-start',
          endLocationId: 'location-end',
          lineGeometry: [
            [139, 35],
            [140, 36],
          ],
        })
      )
    ).rejects.toThrow('payload.buildConfig.sourceConfig.maxConcurrent must be a positive integer');
  });

  it('rejects a start request without an explicit canonical routeMode', async () => {
    await expect(
      canonicalBuildAPI.startBuildSession(
        startRequest('route-contract-node', {
          buildConfig: DEFAULT_ROUTE_BUILD_CONFIG,
          routeBuildInput: { kind: 'direct-route' },
          startLocationId: 'location-start',
          endLocationId: 'location-end',
          lineGeometry: [
            [139, 35],
            [140, 36],
          ],
        })
      )
    ).rejects.toThrow('payload.routeMode is unsupported');
  });

  it('accepts selection-driven route inputs through the canonical resolver', async () => {
    const nodeId = 'route-contract-node';
    const status = {
      nodeId,
      status: 'running' as const,
      progress: { total: 1, completed: 0, failed: 0, skipped: 0, percentage: 0 },
    };
    mocks.startBuildSession.mockResolvedValue(status);
    const ports: RouteCanonicalBuildInputResolverPorts = {
      loadIdeGsmRouteRows: vi.fn(async () => ({
        headers: [
          'Start',
          'End',
          'Name',
          'Distance',
          'Speed',
          'Border',
          'Overhead',
          'Loading',
          'Mode',
          'Quality',
          'Oneway',
          'Freight',
          'Country1',
          'Region1',
          'Country2',
          'Region2',
        ],
        rows: [
          {
            Start: 'A',
            End: 'B',
            Name: 'selected-road',
            Distance: '10',
            Speed: '50',
            Mode: '0',
            Country1: 'JP',
            Country2: 'JP',
            Oneway: '1',
          },
        ],
      })),
      resolveIdeGsmLocationNodeIds: vi.fn(async () => ['location-node-a', 'location-node-b']),
      buildIdeGsmLocationIndex: vi.fn(
        async () =>
          new Map([
            [
              'A',
              {
                locationFeatureId: 'feature-a',
                locationNodeId: 'location-a',
                name: 'A',
                latitude: 35,
                longitude: 139,
                pointId: 'point-a',
                admin0Code: 'JP',
              },
            ],
            [
              'B',
              {
                locationFeatureId: 'feature-b',
                locationNodeId: 'location-b',
                name: 'B',
                latitude: 36,
                longitude: 140,
                pointId: 'point-b',
                admin0Code: 'JP',
              },
            ],
          ])
      ),
    };
    setRouteCanonicalBuildInputResolverPortsForTests(ports);

    await expect(
      canonicalBuildAPI.startBuildSession(
        startRequest(
          nodeId,
          {
            buildConfig: DEFAULT_ROUTE_BUILD_CONFIG,
            routeBuildInput: { kind: 'selection-driven' },
            tabularSourceId: 'route-table',
            selectedArrayByCountries: {
              JP: [false, false, false, false, true, false, false, false, false, true],
            },
          },
          'committed'
        )
      )
    ).resolves.toBe(status);

    expect(mocks.prepareSession).toHaveBeenCalledWith(nodeId, DEFAULT_ROUTE_BUILD_CONFIG, {
      routes: [
        {
          startLocationId: 'location-a',
          endLocationId: 'location-b',
          startCoordinates: [139, 35],
          endCoordinates: [140, 36],
          routeMode: ROUTE_MODES.ROAD,
          metadata: { oneway: true },
        },
      ],
    });
  });

  it('rejects mixed direct-route and selection-driven canonical start inputs', async () => {
    await expect(
      canonicalBuildAPI.startBuildSession(
        startRequest('route-contract-node', {
          buildConfig: DEFAULT_ROUTE_BUILD_CONFIG,
          routeMode: ROUTE_MODES.ROAD,
          startLocationId: 'location-start',
          endLocationId: 'location-end',
          lineGeometry: [
            [139, 35],
            [140, 36],
          ],
          routeBuildInput: {
            kind: 'selection-driven',
            routes: [
              {
                startLocationId: 'location-a',
                endLocationId: 'location-b',
                startCoordinates: [139, 35],
                endCoordinates: [140, 36],
                routeMode: ROUTE_MODES.ROAD,
              },
            ],
          },
        })
      )
    ).rejects.toThrow('selection-driven input must not include direct-route fields');
  });
});
