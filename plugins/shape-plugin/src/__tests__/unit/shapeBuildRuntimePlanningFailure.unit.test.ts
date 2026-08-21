import type { NodeId } from '@hierarchidb/core-types';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { SourceTaskPayload } from '../../common/types/index.js';
import { DEFAULT_BUILD_CONFIG, DEFAULT_PROCESSING_CONFIG } from '../../common/types/index.js';

const getEntityMock = vi.hoisted(() => vi.fn());
const getBuildSessionRecordMock = vi.hoisted(() => vi.fn());
const upsertBuildSessionMock = vi.hoisted(() => vi.fn(async () => undefined));
const updateBuildSessionMock = vi.hoisted(() => vi.fn(async () => undefined));
const buildSourceTasksMock = vi.hoisted(() => vi.fn(async () => ({ tasks: [] })));
const emitSessionStatusUpdatedMock = vi.hoisted(() => vi.fn());
const setPausedMock = vi.hoisted(() => vi.fn(async () => undefined));
const getActivePipelineMock = vi.hoisted(() =>
  vi.fn(
    (): {
      readonly promise: Promise<void>;
      readonly abortController: AbortController;
      readonly runId: string;
    } | null => null
  )
);
const isActivePipelineRunCurrentMock = vi.hoisted(() => vi.fn(() => false));
const cleanupInvalidEntriesMock = vi.hoisted(() =>
  vi.fn(async () => ({ geometryDeleted: 0, sourceDeleted: 0 }))
);

vi.mock('@hierarchidb/auth', () => {
  class MockAuthRequiredError extends Error {}
  return {
    AuthRequiredError: MockAuthRequiredError,
    AuthService: {
      getSingleton: vi.fn(async () => ({
        clearBuildSessionContext: vi.fn(),
        setBuildSessionContext: vi.fn(),
      })),
    },
  };
});

vi.mock('../../worker/api/shapeBuildRuntimeCore.js', () => ({
  countTaskQueueStatuses: vi.fn(async () => ({
    total: 0,
    running: 0,
    completed: 0,
    failed: 0,
    recycled: 0,
  })),
  setPaused: (...args: Parameters<typeof setPausedMock>) => setPausedMock(...args),
  waitIfPaused: vi.fn(async () => undefined),
  getShapeEntityHandler: () => ({ getEntity: getEntityMock }),
  registerActivePipeline: vi.fn(),
  clearActivePipeline: vi.fn(() => true),
  getActivePipeline: (...args: Parameters<typeof getActivePipelineMock>) =>
    getActivePipelineMock(...args),
  invalidateActivePipeline: vi.fn(() => false),
  isActivePipelineRunCurrent: (...args: Parameters<typeof isActivePipelineRunCurrentMock>) =>
    isActivePipelineRunCurrentMock(...args),
}));

vi.mock('../../services/build/ShapeBuildAPIClient.js', () => ({
  ephemeralShapeAPIImpl: {},
  shapeMutationAPIImpl: {
    upsertBuildSession: upsertBuildSessionMock,
    updateBuildSession: updateBuildSessionMock,
  },
  shapeQueryAPIImpl: {
    getBuildSessionRecord: getBuildSessionRecordMock,
  },
}));

vi.mock('../../services/build/strategies/resolveSourceStageStrategy.js', () => ({
  resolveSourceStageStrategy: () => ({
    buildSourceTasks: buildSourceTasksMock,
  }),
}));

vi.mock('../../services/CacheValidator.js', () => ({
  cacheValidator: {
    cleanupInvalidEntries: cleanupInvalidEntriesMock,
  },
}));

vi.mock('../../worker/api/eventEmissionConstants.js', () => ({
  emitSessionLifecyclePhaseUpdated: vi.fn(),
  emitSessionStatusUpdated: emitSessionStatusUpdatedMock,
  emitStageSnapshotUpdated: vi.fn(),
  readStartedStageTiming: vi.fn(() => null),
}));

import { shapeBuildRuntimeExecutionControl } from '../../worker/api/shapeBuildRuntimeExecutionControl.js';

const nodeId = 'planning-zero-node' as NodeId;
const selectedArrayByCountries = { US: [true] };
const sourcePayload = {} as SourceTaskPayload;
const expectedErrorMessage =
  '[shapeBuildAPI] Build has selected inputs but generated 0 source tasks.' +
  ' Please reload country metadata and retry.';

const startBuildSession = (): Promise<NodeId> =>
  shapeBuildRuntimeExecutionControl.startBuildSessionInternal(
    'startBuildSession',
    nodeId,
    DEFAULT_BUILD_CONFIG,
    DEFAULT_PROCESSING_CONFIG,
    [sourcePayload]
  );

describe('shape build runtime zero-task planning failure', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers();
    vi.setSystemTime(1_000);
    getEntityMock.mockResolvedValue({ selectedArrayByCountries });
    buildSourceTasksMock.mockResolvedValue({ tasks: [] });
    cleanupInvalidEntriesMock.mockResolvedValue({ geometryDeleted: 0, sourceDeleted: 0 });
    getActivePipelineMock.mockReturnValue(null);
    isActivePipelineRunCurrentMock.mockReturnValue(false);
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('persists a terminal failed session before rethrowing the planning error', async () => {
    getBuildSessionRecordMock.mockResolvedValueOnce(null).mockResolvedValue({
      nodeId,
      status: 'failed',
      startedAt: 1_000,
      updatedAt: 1_000,
      completedAt: 1_000,
      progress: {
        total: 0,
        completed: 0,
        failed: 0,
        skipped: 0,
        percentage: 0,
      },
      stages: {},
      stopReason: 'failed',
      canResume: false,
    });

    await expect(startBuildSession()).rejects.toThrow(expectedErrorMessage);

    expect(upsertBuildSessionMock).toHaveBeenCalledOnce();
    const persistedSession = upsertBuildSessionMock.mock.calls[0]?.[0];
    expect(persistedSession).toMatchObject({
      nodeId,
      status: 'failed',
      selectedArrayByCountries,
      stopReason: 'failed',
      canResume: false,
      startedAt: 1_000,
      completedAt: 1_000,
    });
    expect(Number.isFinite(persistedSession?.startedAt)).toBe(true);
    expect(Number.isFinite(persistedSession?.completedAt)).toBe(true);
    expect(persistedSession?.completedAt).toBeGreaterThanOrEqual(persistedSession?.startedAt);
    expect(emitSessionStatusUpdatedMock).toHaveBeenCalledOnce();
  });

  it('preserves the planning error when terminal persistence also fails', async () => {
    const persistenceError = new Error('session persistence failed');
    getBuildSessionRecordMock.mockResolvedValueOnce(null);
    upsertBuildSessionMock.mockRejectedValueOnce(persistenceError);

    let receivedError: unknown;
    try {
      await startBuildSession();
    } catch (error) {
      receivedError = error;
    }

    expect(receivedError).toBeInstanceOf(Error);
    expect((receivedError as Error).message).toBe(expectedErrorMessage);
    expect(receivedError).not.toBe(persistenceError);
    expect(upsertBuildSessionMock).toHaveBeenCalledOnce();
    expect(emitSessionStatusUpdatedMock).not.toHaveBeenCalled();
  });

  it('persists a cleanup startup failure and rethrows the original error', async () => {
    const cleanupError = new Error('artifact cleanup failed');
    cleanupError.name = 'ShapeArtifactCascadeCleanupError';
    buildSourceTasksMock.mockResolvedValue({ tasks: [{} as never] });
    cleanupInvalidEntriesMock.mockRejectedValueOnce(cleanupError);
    getBuildSessionRecordMock.mockResolvedValueOnce(null).mockResolvedValue({
      nodeId,
      status: 'failed',
      startedAt: 1_000,
      updatedAt: 1_000,
      completedAt: 1_000,
      progress: {
        total: 0,
        completed: 0,
        failed: 0,
        skipped: 0,
        percentage: 0,
      },
      stages: {},
      stopReason: 'failed',
      canResume: false,
    });

    await expect(startBuildSession()).rejects.toBe(cleanupError);

    expect(upsertBuildSessionMock).toHaveBeenCalledOnce();
    expect(upsertBuildSessionMock.mock.calls[0]?.[0]).toMatchObject({
      nodeId,
      status: 'failed',
      selectedArrayByCountries,
      stopReason: 'failed',
      canResume: false,
      startedAt: 1_000,
      completedAt: 1_000,
    });
    expect(emitSessionStatusUpdatedMock).toHaveBeenCalledOnce();
  });

  it('rejects an invalidated active run before planning or cleanup mutates state', async () => {
    getBuildSessionRecordMock.mockResolvedValue({
      nodeId,
      status: 'failed',
      startedAt: 1_000,
      updatedAt: 1_000,
      completedAt: 1_000,
      progress: {
        total: 0,
        completed: 0,
        failed: 0,
        skipped: 0,
        percentage: 0,
      },
      stages: {},
      stopReason: 'failed',
      canResume: false,
    });
    getActivePipelineMock.mockReturnValue({
      promise: new Promise<void>(() => {}),
      abortController: new AbortController(),
      runId: 'run-timeout',
    });
    isActivePipelineRunCurrentMock.mockReturnValue(false);

    await expect(startBuildSession()).rejects.toMatchObject({
      name: 'ShapeBuildActivePipelineAlreadyExistsError',
      message: expect.stringContaining('run-timeout'),
    });

    expect(buildSourceTasksMock).not.toHaveBeenCalled();
    expect(cleanupInvalidEntriesMock).not.toHaveBeenCalled();
    expect(setPausedMock).not.toHaveBeenCalled();
    expect(upsertBuildSessionMock).not.toHaveBeenCalled();
    expect(updateBuildSessionMock).not.toHaveBeenCalled();
  });
});
