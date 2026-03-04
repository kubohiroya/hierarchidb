import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const reconcileRunningBuildSessionsMock = vi.hoisted(() => vi.fn(async () => ({
  checkedNodeIds: [],
  activeNodeIds: [],
  repairedNodeIds: [],
})));

vi.mock('../../utils/reconcileStaleBuildSessions.js', () => ({
  reconcileRunningBuildSessions: (...args: Parameters<typeof reconcileRunningBuildSessionsMock>) =>
    reconcileRunningBuildSessionsMock(...args),
}));

import { WorkerService } from '../../../WorkerService';

type WorkerServiceWithRecovery = {
  recoverBuildSessionRuntimeRecordsOnWarmStart: () => Promise<void>;
};

describe('WorkerService warm-start build session recovery', () => {
  const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
  const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    warnSpy.mockClear();
    errorSpy.mockClear();
  });

  it('calls reconcile on warm start and logs repaired session count', async () => {
    reconcileRunningBuildSessionsMock.mockResolvedValueOnce({
      checkedNodeIds: ['shape-1' as never, 'shape-2' as never],
      activeNodeIds: ['shape-1' as never],
      repairedNodeIds: ['shape-2' as never],
    });

    await (WorkerService as unknown as WorkerServiceWithRecovery)
      .recoverBuildSessionRuntimeRecordsOnWarmStart();

    expect(reconcileRunningBuildSessionsMock).toHaveBeenCalledTimes(1);
    expect(warnSpy).toHaveBeenCalledWith(
      '[WorkerService] Repaired stale running build sessions on startup',
      expect.objectContaining({
        repairedNodeIds: ['shape-2'],
        checkedCount: 2,
      }),
    );
    expect(errorSpy).not.toHaveBeenCalled();
  });

  it('swallows reconcile failures and logs error', async () => {
    const failure = new Error('reconcile failed');
    reconcileRunningBuildSessionsMock.mockRejectedValueOnce(failure);

    await (WorkerService as unknown as WorkerServiceWithRecovery)
      .recoverBuildSessionRuntimeRecordsOnWarmStart();

    expect(reconcileRunningBuildSessionsMock).toHaveBeenCalledTimes(1);
    expect(errorSpy).toHaveBeenCalledWith(
      '[WorkerService] Failed to recover persisted build sessions',
      failure,
    );
  });
});
