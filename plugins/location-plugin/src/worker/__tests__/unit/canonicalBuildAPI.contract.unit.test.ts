import { canonicalPluginBuildAPIMethodNames } from '@hierarchidb/build-api';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const startRequest = (nodeId: string, payload: unknown) => ({
  nodeId,
  input: { source: 'working-copy' as const, payload },
});

const mocks = vi.hoisted(() => ({
  startLocationBuildSession: vi.fn(),
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

vi.mock('~/services/LocationBuildManager.js', () => ({
  LocationBuildManager: class {
    startLocationBuildSession = mocks.startLocationBuildSession;
    getBuildSessionStatus = mocks.getBuildSessionStatus;
    pauseBuildSession = mocks.pauseBuildSession;
    cancelQueuedBuildSession = mocks.cancelQueuedBuildSession;
    getBuildTasks = mocks.getBuildTasks;
  },
}));

vi.mock('@hierarchidb/build-runtime-services', () => ({
  createCanonicalBuildRuntimeAdapter: vi.fn(() => ({
    nodeType: 'location',
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

import { canonicalBuildAPI } from '../../canonicalBuildAPI.js';

describe('location canonicalBuildAPI contract', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('exports exactly the canonical plugin build API methods', () => {
    expect(Object.keys(canonicalBuildAPI)).toEqual([...canonicalPluginBuildAPIMethodNames]);
  });

  it('rejects a start request without an actual entity data source', async () => {
    await expect(
      canonicalBuildAPI.startBuildSession({
        nodeId: 'location-contract-node',
        input: { source: 'working-copy', payload: {} },
      })
    ).rejects.toThrow('payload.dataSource must be a string');
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
    const draftData = {
      dataSource: 'openstreetmap',
      concurrentDownloads: 3,
      selectedArrayByCountries: {
        US: [false, true, false, false, true],
        JP: [true, false, true, false, false],
      },
    };

    await expect(
      canonicalBuildAPI.startBuildSession(startRequest(nodeId, draftData))
    ).resolves.toBe(status);
    expect(mocks.startLocationBuildSession).toHaveBeenCalledWith(
      nodeId,
      {
        searchConfigs: [
          {
            dataSource: 'openstreetmap',
            countryCode: 'JP',
            types: ['area_centroid', 'port'],
          },
          {
            dataSource: 'openstreetmap',
            countryCode: 'US',
            types: ['airport', 'interchange'],
          },
        ],
        concurrentDownloads: 3,
        processingOptions: { concurrent: 3 },
      },
      expect.objectContaining({
        sourceKind: 'network',
        dataSource: 'openstreetmap',
        identity: expect.objectContaining({
          authScope: 'location',
          parserVersion: 'nominatim-json-v1',
          selectionSignature: 'JP:area_centroid,port|US:airport,interchange',
        }),
      })
    );
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

  it('rejects a selection matrix without selected location types', async () => {
    await expect(
      canonicalBuildAPI.startBuildSession(
        startRequest('location-contract-node', {
          dataSource: 'openstreetmap',
          concurrentDownloads: 2,
          selectedArrayByCountries: {
            JP: [false, false, false, false, false],
          },
        })
      )
    ).rejects.toThrow('must select at least one location type');
  });

  it('rejects a non-canonical country key instead of normalizing it', async () => {
    await expect(
      canonicalBuildAPI.startBuildSession(
        startRequest('location-contract-node', {
          dataSource: 'openstreetmap',
          concurrentDownloads: 2,
          selectedArrayByCountries: {
            jp: [true, false, false, false, false],
          },
        })
      )
    ).rejects.toThrow('must be an uppercase ISO 3166-1 alpha-2 code: jp');
  });

  it.each(['geonames', 'wikidata', 'custom'])(
    'rejects the unimplemented %s worker data source',
    async (dataSource) => {
      await expect(
        canonicalBuildAPI.startBuildSession(
          startRequest('location-contract-node', {
            dataSource,
            concurrentDownloads: 2,
            selectedArrayByCountries: {
              JP: [true, false, false, false, false],
            },
          })
        )
      ).rejects.toThrow('does not have a canonical Worker source strategy');
    }
  );
});
