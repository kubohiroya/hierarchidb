import { canonicalPluginBuildAPIMethodNames } from '@hierarchidb/build-api';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  startLocationBuildSession: vi.fn(),
  getBuildSessionStatus: vi.fn(),
  pauseBuildSession: vi.fn(),
  subscribeStageSnapshots: vi.fn(),
  subscribeTaskProgress: vi.fn(),
  subscribeSessionState: vi.fn(),
  subscribeSessionHeartbeat: vi.fn(),
  subscribeWorkerLog: vi.fn(),
}));

vi.mock('~/services/LocationBuildManager.js', () => ({
  LocationBuildManager: class {
    startLocationBuildSession = mocks.startLocationBuildSession;
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

import { canonicalBuildAPI } from '../../canonicalBuildAPI.js';

describe('location canonicalBuildAPI contract', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('exports exactly the canonical plugin build API methods', () => {
    expect(Object.keys(canonicalBuildAPI)).toEqual([...canonicalPluginBuildAPIMethodNames]);
  });

  it('rejects a start request without explicit build config', async () => {
    await expect(
      canonicalBuildAPI.startBuildSession({
        nodeId: 'location-contract-node',
        draftData: {},
      })
    ).rejects.toThrow('draftData.buildConfig is required');
  });

  it('delegates commands, queries, and subscriptions through the canonical surface', async () => {
    const nodeId = 'location-contract-node';
    const callback = vi.fn();
    const unsubscribe = vi.fn();
    const status = {
      nodeId,
      status: 'running' as const,
      progress: { total: 1, completed: 0, failed: 0, skipped: 0, percentage: 0 },
    };
    mocks.startLocationBuildSession.mockResolvedValue(nodeId);
    mocks.getBuildSessionStatus.mockResolvedValue(status);
    for (const subscribe of [
      mocks.subscribeStageSnapshots,
      mocks.subscribeTaskProgress,
      mocks.subscribeSessionState,
      mocks.subscribeSessionHeartbeat,
      mocks.subscribeWorkerLog,
    ]) {
      subscribe.mockReturnValue(unsubscribe);
    }
    const buildConfig = { searchConfigs: [], processingOptions: {} };

    await expect(
      canonicalBuildAPI.startBuildSession({ nodeId, draftData: { buildConfig } })
    ).resolves.toBe(status);
    expect(mocks.startLocationBuildSession).toHaveBeenCalledWith(nodeId, buildConfig);
    await expect(canonicalBuildAPI.getBuildSessionStatus(nodeId)).resolves.toBe(status);
    await canonicalBuildAPI.pauseBuildSession(nodeId, 'pause reason');
    expect(mocks.pauseBuildSession).toHaveBeenCalledWith(nodeId);
    await canonicalBuildAPI.cancelQueuedBuildSession(nodeId, 'cancel reason');
    expect(mocks.pauseBuildSession).toHaveBeenCalledTimes(2);
    await expect(canonicalBuildAPI.getBuildTasks(nodeId)).rejects.toThrow(
      'authoritative task query is unavailable'
    );

    expect(canonicalBuildAPI.subscribeStageSnapshots(nodeId, callback)).toBe(unsubscribe);
    expect(canonicalBuildAPI.subscribeTaskProgress(nodeId, callback)).toBe(unsubscribe);
    expect(canonicalBuildAPI.subscribeSessionState(nodeId, callback)).toBe(unsubscribe);
    expect(canonicalBuildAPI.subscribeSessionHeartbeat(nodeId, callback)).toBe(unsubscribe);
    expect(canonicalBuildAPI.subscribeWorkerLog(nodeId, callback)).toBe(unsubscribe);
  });
});
