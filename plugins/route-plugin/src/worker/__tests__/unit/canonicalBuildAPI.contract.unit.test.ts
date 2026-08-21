import { canonicalPluginBuildAPIMethodNames } from '@hierarchidb/build-api';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  prepareSession: vi.fn(),
  startBuildSession: vi.fn(),
  getBuildSessionStatus: vi.fn(),
  pauseBuildSession: vi.fn(),
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
  },
}));

vi.mock('@hierarchidb/build-runtime-services', () => ({
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

import { canonicalBuildAPI } from '../../canonicalBuildAPI.js';

describe('route canonicalBuildAPI contract', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('exports exactly the canonical plugin build API methods', () => {
    expect(Object.keys(canonicalBuildAPI)).toEqual([...canonicalPluginBuildAPIMethodNames]);
  });

  it('rejects a start request without explicit build config', async () => {
    await expect(
      canonicalBuildAPI.startBuildSession({
        nodeId: 'route-contract-node',
        draftData: {},
      })
    ).rejects.toThrow('draftData.buildConfig is required');
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
    const buildConfig = {
      sourceConfig: {},
      geometryConfig: {},
      tileEmitConfig: {},
      routeGeneration: {},
    };
    const draftData = {
      buildConfig,
      startLocationId: 'location-start',
      endLocationId: 'location-end',
      lineGeometry: [
        [139, 35],
        [139.5, 35.5],
        [140, 36],
      ],
    };

    await expect(canonicalBuildAPI.startBuildSession({ nodeId, draftData })).resolves.toBe(status);
    expect(mocks.prepareSession).toHaveBeenCalledWith(nodeId, buildConfig, {
      routes: [
        {
          startLocationId: 'location-start',
          endLocationId: 'location-end',
          startCoordinates: [139, 35],
          endCoordinates: [140, 36],
        },
      ],
    });
    expect(mocks.startBuildSession).toHaveBeenCalledWith(nodeId);
    await expect(canonicalBuildAPI.getBuildSessionStatus(nodeId)).resolves.toBe(status);
    await canonicalBuildAPI.pauseBuildSession(nodeId, 'pause reason');
    expect(mocks.pauseBuildSession).toHaveBeenCalledWith(nodeId);
    await canonicalBuildAPI.cancelQueuedBuildSession(nodeId, 'cancel reason');
    expect(mocks.pauseBuildSession).toHaveBeenCalledTimes(2);
    await expect(canonicalBuildAPI.getBuildTasks(nodeId)).resolves.toEqual([]);

    expect(canonicalBuildAPI.subscribeStageSnapshots(nodeId, callback)).toBe(unsubscribe);
    expect(canonicalBuildAPI.subscribeTaskProgress(nodeId, callback)).toBe(unsubscribe);
    expect(canonicalBuildAPI.subscribeSessionState(nodeId, callback)).toBe(unsubscribe);
    expect(canonicalBuildAPI.subscribeSessionHeartbeat(nodeId, callback)).toBe(unsubscribe);
    expect(canonicalBuildAPI.subscribeWorkerLog(nodeId, callback)).toBe(unsubscribe);
  });

  it('rejects invalid persisted direct-route coordinates', async () => {
    await expect(
      canonicalBuildAPI.startBuildSession({
        nodeId: 'route-contract-node',
        draftData: {
          buildConfig: {
            sourceConfig: {},
            geometryConfig: {},
            tileEmitConfig: {},
            routeGeneration: {},
          },
          startLocationId: 'location-start',
          endLocationId: 'location-end',
          lineGeometry: [
            [181, 35],
            [140, 36],
          ],
        },
      })
    ).rejects.toThrow('draftData.lineGeometry[0] contains invalid coordinates');
  });
});
