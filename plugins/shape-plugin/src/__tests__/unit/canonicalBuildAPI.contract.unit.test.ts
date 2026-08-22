import { canonicalPluginBuildAPIMethodNames } from '@hierarchidb/build-api';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { DEFAULT_BUILD_CONFIG, DEFAULT_PROCESSING_CONFIG } from '../../common/types/constants.js';

const shapeBuildAPIMocks = vi.hoisted(() => ({
  startBuildSession: vi.fn(),
  getBuildSession: vi.fn(),
  pauseBuildSession: vi.fn(),
  cancelQueuedBuildSession: vi.fn(),
  getBuildTasks: vi.fn(),
  subscribeStageSnapshots: vi.fn(),
  subscribeTaskProgress: vi.fn(),
  subscribeSessionState: vi.fn(),
  subscribeHeartbeat: vi.fn(),
  subscribeWorkerLog: vi.fn(),
  generateDownloadTaskPayloadsFromSelection: vi.fn(),
}));

const shapeBuildExtensionMocks = vi.hoisted(() => ({
  setShapeCorsProxyBaseURL: vi.fn(),
  setUiStorageBridge: vi.fn(),
  getSingleton: vi.fn(),
}));

vi.mock('../../worker/api.js', () => ({
  shapeBuildAPI: {
    startBuildSession: shapeBuildAPIMocks.startBuildSession,
    getBuildSession: shapeBuildAPIMocks.getBuildSession,
    pauseBuildSession: shapeBuildAPIMocks.pauseBuildSession,
    cancelQueuedBuildSession: shapeBuildAPIMocks.cancelQueuedBuildSession,
    getBuildTasks: shapeBuildAPIMocks.getBuildTasks,
    subscribeStageSnapshots: shapeBuildAPIMocks.subscribeStageSnapshots,
    subscribeTaskProgress: shapeBuildAPIMocks.subscribeTaskProgress,
    subscribeSessionState: shapeBuildAPIMocks.subscribeSessionState,
    subscribeHeartbeat: shapeBuildAPIMocks.subscribeHeartbeat,
    subscribeWorkerLog: shapeBuildAPIMocks.subscribeWorkerLog,
    generateDownloadTaskPayloadsFromSelection:
      shapeBuildAPIMocks.generateDownloadTaskPayloadsFromSelection,
  },
}));

vi.mock('../../services/utils/setShapeCorsProxyBaseURL.js', () => ({
  setShapeCorsProxyBaseURL: shapeBuildExtensionMocks.setShapeCorsProxyBaseURL,
}));

vi.mock('@hierarchidb/auth', () => ({
  AuthService: {
    getSingleton: shapeBuildExtensionMocks.getSingleton,
  },
}));

import { canonicalBuildAPI, shapeBuildExtensions } from '../../worker/canonicalBuildAPI.js';

describe('shape canonicalBuildAPI contract', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    shapeBuildExtensionMocks.getSingleton.mockResolvedValue({
      setUiStorageBridge: shapeBuildExtensionMocks.setUiStorageBridge,
    });
  });

  it('exports exactly the canonical plugin build API methods', () => {
    expect(Object.keys(canonicalBuildAPI)).toEqual([...canonicalPluginBuildAPIMethodNames]);
  });

  it('exposes preview payload generation through a separate explicit extension', async () => {
    const payloads = [{ url: 'https://example.test/source', countryCode: 'JP', adminLevel: 0 }];
    shapeBuildAPIMocks.generateDownloadTaskPayloadsFromSelection.mockResolvedValue(payloads);

    expect(Object.keys(shapeBuildExtensions)).toEqual([
      'setCorsProxyBaseURL',
      'setUiStorageBridge',
      'generateDownloadTaskPayloadsFromSelection',
    ]);
    shapeBuildExtensions.setCorsProxyBaseURL('http://127.0.0.1:3000/');
    expect(shapeBuildExtensionMocks.setShapeCorsProxyBaseURL).toHaveBeenCalledWith(
      'http://127.0.0.1:3000/'
    );
    const storageBridge = {
      getItem: vi.fn(),
      removeItem: vi.fn(),
    };
    await shapeBuildExtensions.setUiStorageBridge(storageBridge);
    expect(shapeBuildExtensionMocks.getSingleton).toHaveBeenCalledTimes(1);
    expect(shapeBuildExtensionMocks.setUiStorageBridge).toHaveBeenCalledWith(storageBridge);
    await expect(
      shapeBuildExtensions.generateDownloadTaskPayloadsFromSelection(
        'shape-contract-node',
        'geoboundaries',
        { JP: [true] }
      )
    ).resolves.toBe(payloads);
  });

  it('rejects a start request without explicit build config', async () => {
    await expect(
      canonicalBuildAPI.startBuildSession({
        nodeId: 'shape-contract-node',
        draftData: {},
      })
    ).rejects.toThrow('draftData.buildConfig is required');
  });

  it('does not synthesize a stage before the worker has started one', async () => {
    shapeBuildAPIMocks.startBuildSession.mockResolvedValue('shape-contract-node');
    shapeBuildAPIMocks.getBuildSession.mockResolvedValue({
      nodeId: 'shape-contract-node',
      status: 'running',
      config: {},
      startedAt: 1,
      updatedAt: 1,
      progress: {
        total: 1,
        completed: 0,
        failed: 0,
        skipped: 0,
        percentage: 0,
      },
    });

    const status = await canonicalBuildAPI.startBuildSession({
      nodeId: 'shape-contract-node',
      draftData: {
        buildConfig: DEFAULT_BUILD_CONFIG,
      },
    });

    expect(status.progress).not.toHaveProperty('stage');
  });

  it('delegates commands, queries, and subscriptions through the canonical surface', async () => {
    const nodeId = 'shape-contract-node';
    const callback = vi.fn();
    const unsubscribe = vi.fn();
    const status = {
      nodeId,
      status: 'running' as const,
      startedAt: 1,
      updatedAt: 1,
      progress: {
        total: 1,
        completed: 0,
        failed: 0,
        skipped: 0,
        percentage: 0,
      },
    };
    shapeBuildAPIMocks.startBuildSession.mockResolvedValue(nodeId);
    shapeBuildAPIMocks.getBuildSession.mockResolvedValue(status);
    shapeBuildAPIMocks.getBuildTasks.mockResolvedValue([]);
    for (const subscribe of [
      shapeBuildAPIMocks.subscribeStageSnapshots,
      shapeBuildAPIMocks.subscribeTaskProgress,
      shapeBuildAPIMocks.subscribeSessionState,
      shapeBuildAPIMocks.subscribeHeartbeat,
      shapeBuildAPIMocks.subscribeWorkerLog,
    ]) {
      subscribe.mockReturnValue(unsubscribe);
    }

    const request = {
      nodeId,
      draftData: {
        buildConfig: DEFAULT_BUILD_CONFIG,
      },
    };
    await expect(canonicalBuildAPI.startBuildSession(request)).resolves.toMatchObject({ nodeId });
    expect(shapeBuildAPIMocks.startBuildSession).toHaveBeenCalledWith(
      nodeId,
      request.draftData.buildConfig,
      undefined,
      []
    );

    await expect(canonicalBuildAPI.getBuildSessionStatus(nodeId)).resolves.toMatchObject({
      nodeId,
    });
    await canonicalBuildAPI.pauseBuildSession(nodeId, 'pause reason');
    await canonicalBuildAPI.cancelQueuedBuildSession(nodeId, 'cancel reason');
    await expect(canonicalBuildAPI.getBuildTasks(nodeId)).resolves.toEqual([]);
    expect(shapeBuildAPIMocks.pauseBuildSession).toHaveBeenCalledWith(nodeId, 'pause reason');
    expect(shapeBuildAPIMocks.cancelQueuedBuildSession).toHaveBeenCalledWith(
      nodeId,
      'cancel reason'
    );

    expect(canonicalBuildAPI.subscribeStageSnapshots(nodeId, callback)).toBe(unsubscribe);
    expect(canonicalBuildAPI.subscribeTaskProgress(nodeId, callback)).toBe(unsubscribe);
    expect(canonicalBuildAPI.subscribeSessionState(nodeId, callback)).toBe(unsubscribe);
    expect(canonicalBuildAPI.subscribeSessionHeartbeat(nodeId, callback)).toBe(unsubscribe);
    expect(canonicalBuildAPI.subscribeWorkerLog(nodeId, callback)).toBe(unsubscribe);
    expect(shapeBuildAPIMocks.subscribeStageSnapshots).toHaveBeenCalledWith(nodeId, callback);
    expect(shapeBuildAPIMocks.subscribeTaskProgress).toHaveBeenCalledWith(nodeId, callback);
    expect(shapeBuildAPIMocks.subscribeSessionState).toHaveBeenCalledWith(nodeId, callback);
    expect(shapeBuildAPIMocks.subscribeHeartbeat).toHaveBeenCalledWith(nodeId, callback);
    expect(shapeBuildAPIMocks.subscribeWorkerLog).toHaveBeenCalledWith(nodeId, callback);
  });

  it('rejects a build config with missing required leaf values', async () => {
    await expect(
      canonicalBuildAPI.startBuildSession({
        nodeId: 'shape-contract-node',
        draftData: {
          buildConfig: {
            dataSourceName: 'geoboundaries',
            sourceConfig: {},
            geometryConfig: {},
            tileEmitConfig: {},
          },
        },
      })
    ).rejects.toThrow('draftData.buildConfig.sourceConfig.deleteOnComplete must be boolean');
  });

  it('rejects a processing config with missing required leaf values', async () => {
    await expect(
      canonicalBuildAPI.startBuildSession({
        nodeId: 'shape-contract-node',
        draftData: {
          buildConfig: DEFAULT_BUILD_CONFIG,
          processingConfig: {
            source: {},
            geometry: {},
            tileEmit: {},
          },
        },
      })
    ).rejects.toThrow('draftData.processingConfig.source.maxConcurrent must be an integer in 1..4');
    expect(shapeBuildAPIMocks.startBuildSession).not.toHaveBeenCalled();
  });

  it('rejects dynamic concurrency sampling that the runtime would otherwise round up', async () => {
    await expect(
      canonicalBuildAPI.startBuildSession({
        nodeId: 'shape-contract-node',
        draftData: {
          buildConfig: DEFAULT_BUILD_CONFIG,
          processingConfig: {
            ...DEFAULT_PROCESSING_CONFIG,
            tileEmit: {
              ...DEFAULT_PROCESSING_CONFIG.tileEmit,
              dynamicConcurrency: {
                ...DEFAULT_PROCESSING_CONFIG.tileEmit.dynamicConcurrency,
                sampleMs: 199,
              },
            },
          },
        },
      })
    ).rejects.toThrow(
      'draftData.processingConfig.tileEmit.dynamicConcurrency.sampleMs must be an integer at least 200'
    );
    expect(shapeBuildAPIMocks.startBuildSession).not.toHaveBeenCalled();
  });
});
