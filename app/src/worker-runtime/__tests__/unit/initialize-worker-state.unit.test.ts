import type { Remote } from 'comlink';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { BuildWorkerAPI } from '../../../types/worker-api.ts';

const workerClientMock = vi.hoisted(() => ({
  getOrInit: vi.fn<() => Promise<Remote<BuildWorkerAPI>>>(),
  isReady: vi.fn<() => boolean>(),
  getSingleton: vi.fn<() => Remote<BuildWorkerAPI>>(),
}));

const ensureWorkerRuntimeMock = vi.hoisted(() => vi.fn<() => Promise<Remote<BuildWorkerAPI>>>());

class MockNotInitializedError extends Error {}

vi.mock('../../WorkerAPIClient.ts', () => ({
  WorkerAPIClient: workerClientMock,
  NotInitializedError: MockNotInitializedError,
}));

vi.mock('../../workerModuleLoaderUtils.js', () => ({
  ensureWorkerRuntime: ensureWorkerRuntimeMock,
}));

describe('WorkerStateStore', () => {
  const fakeClient = {} as Remote<BuildWorkerAPI>;

  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
    workerClientMock.getOrInit.mockReset();
    workerClientMock.isReady.mockReset();
    workerClientMock.getSingleton.mockReset();
    ensureWorkerRuntimeMock.mockReset();
  });

  it('transitions to ready and notifies subscribers when initialization succeeds', async () => {
    workerClientMock.isReady.mockReturnValue(false);
    workerClientMock.getSingleton.mockImplementation(() => {
      throw new MockNotInitializedError('not ready');
    });
    workerClientMock.getOrInit.mockImplementation(async () => fakeClient);
    ensureWorkerRuntimeMock.mockResolvedValue(fakeClient);

    const { ensureWorkerInitialized, getWorkerSnapshot, subscribeWorkerState } = await import(
      '../../WorkerStateStore.ts'
    );

    const observedStates: string[] = [];
    const unsubscribe = subscribeWorkerState((snapshot) => {
      observedStates.push(snapshot.state);
    });

    const result = await ensureWorkerInitialized();
    unsubscribe();

    expect(result).toBe(fakeClient);
    expect(getWorkerSnapshot().state).toBe('ready');
    expect(observedStates).toEqual(['uninitialized', 'initializing', 'ready']);
  });

  it('records failure atoms when initialization rejects', async () => {
    const loaderError = new Error('boom');
    workerClientMock.isReady.mockReturnValue(false);
    workerClientMock.getSingleton.mockImplementation(() => {
      throw new MockNotInitializedError('not ready');
    });
    workerClientMock.getOrInit.mockImplementation(async () => {
      throw loaderError;
    });
    ensureWorkerRuntimeMock.mockRejectedValue(loaderError);

    const { ensureWorkerInitialized, getWorkerSnapshot } = await import(
      '../../WorkerStateStore.ts'
    );

    await expect(ensureWorkerInitialized()).rejects.toThrow('boom');
    const snapshot = getWorkerSnapshot();
    expect(snapshot.state).toBe('failed');
    expect(snapshot.error?.message).toBe('boom');
  });
});
