import type { Remote } from 'comlink';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { BuildWorkerAPI } from '../../../types/workerApiTypes.js';

const getWorkerClient = vi.hoisted(() => vi.fn<() => Promise<Remote<BuildWorkerAPI>>>());
const getRawWorkerInstance = vi.hoisted(() => vi.fn(() => null));

vi.mock('../../clientUtils.ts', () => ({
  getWorkerClient,
  getRawWorkerInstance,
  isWorkerInitCompleted: () => true,
}));

describe('WorkerAPIClient prepared client reuse', () => {
  const preparedClient = {} as Remote<BuildWorkerAPI>;

  beforeEach(() => {
    vi.resetModules();
    getWorkerClient.mockReset();
    getRawWorkerInstance.mockClear();
    getWorkerClient.mockResolvedValue(preparedClient);
  });

  afterEach(async () => {
    const { WorkerAPIClient } = await import('../../WorkerAPIClient.ts');
    WorkerAPIClient.reset();
  });

  it('returns the prepared canonical singleton without creating a second worker client', async () => {
    const { loadWorkerAPIClientModule } = await import('../../workerApiClientLoader.ts');
    const preparedModule = await loadWorkerAPIClientModule();
    const { WorkerAPIClient } = preparedModule;

    await WorkerAPIClient.initialize();
    const preparedSingleton = WorkerAPIClient.getSingleton();
    const providerModule = await loadWorkerAPIClientModule();
    const providerSingleton = await providerModule.WorkerAPIClient.getOrInit();

    expect(providerModule).toBe(preparedModule);
    expect(preparedSingleton).toBe(providerSingleton);
    expect(getWorkerClient).toHaveBeenCalledOnce();
  });
});
