import { afterAll, afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  assertCreationAllowed: vi.fn(),
  createAuthSessionStorageBridge: vi.fn(() => ({ getItem: vi.fn() })),
  proxy: vi.fn((value: unknown) => value),
  registerOwnedClientHandle: vi.fn(),
  setUiStorageBridge: vi.fn(),
  unregisterOwnedClientHandle: vi.fn(),
  wrap: vi.fn(),
}));

vi.mock('@hierarchidb/origin-coordinator', () => ({
  assertOriginCoordinatorOwnedClientCreationAllowed: mocks.assertCreationAllowed,
  registerOriginCoordinatorOwnedClientHandle: mocks.registerOwnedClientHandle,
}));

vi.mock('@hierarchidb/ui-auth', () => ({
  createAuthSessionStorageBridge: mocks.createAuthSessionStorageBridge,
}));

vi.mock('comlink', () => ({
  proxy: mocks.proxy,
  wrap: mocks.wrap,
}));

const originalWorker = globalThis.Worker;
let constructedWorkers: FakeWorker[] = [];
let failWorkerConstruction = false;

class FakeWorker extends EventTarget {
  readonly terminate = vi.fn();

  constructor(_url: URL, _options: WorkerOptions) {
    super();
    if (failWorkerConstruction) throw new Error('secret-worker-construction-error');
    constructedWorkers.push(this);
  }
}

beforeEach(() => {
  vi.resetModules();
  vi.clearAllMocks();
  vi.useRealTimers();
  constructedWorkers = [];
  failWorkerConstruction = false;
  Object.defineProperty(globalThis, 'Worker', {
    configurable: true,
    writable: true,
    value: FakeWorker,
  });
  mocks.registerOwnedClientHandle.mockReturnValue(mocks.unregisterOwnedClientHandle);
  mocks.wrap.mockReturnValue({ setUiStorageBridge: mocks.setUiStorageBridge });
});

afterEach(() => {
  vi.useRealTimers();
});

afterAll(() => {
  Object.defineProperty(globalThis, 'Worker', {
    configurable: true,
    writable: true,
    value: originalWorker,
  });
});

describe('getOrCreateAvailabilityWorkerHandle', () => {
  it('shares one initialized worker handle', async () => {
    mocks.setUiStorageBridge.mockResolvedValue(undefined);
    const { getOrCreateAvailabilityWorkerHandle } = await import(
      '../getOrCreateAvailabilityWorkerHandle.js'
    );

    const first = getOrCreateAvailabilityWorkerHandle();
    const second = getOrCreateAvailabilityWorkerHandle();

    expect(second).toBe(first);
    await expect(first.bridgeReady).resolves.toBeUndefined();
    expect(constructedWorkers).toHaveLength(1);
    expect(mocks.setUiStorageBridge).toHaveBeenCalledOnce();
  });

  it('rejects a worker script error, terminates the failed worker, and permits a fresh retry', async () => {
    mocks.setUiStorageBridge
      .mockReturnValueOnce(new Promise<void>(() => {}))
      .mockResolvedValueOnce(undefined);
    const { getOrCreateAvailabilityWorkerHandle } = await import(
      '../getOrCreateAvailabilityWorkerHandle.js'
    );
    const failedHandle = getOrCreateAvailabilityWorkerHandle();
    const rejection = expect(failedHandle.bridgeReady).rejects.toThrow(
      'Country availability worker failed to initialize.'
    );

    constructedWorkers[0]?.dispatchEvent(new Event('error'));

    await rejection;
    expect(constructedWorkers[0]?.terminate).toHaveBeenCalledOnce();
    expect(mocks.unregisterOwnedClientHandle).toHaveBeenCalledOnce();
    const retryHandle = getOrCreateAvailabilityWorkerHandle();
    await expect(retryHandle.bridgeReady).resolves.toBeUndefined();
    expect(constructedWorkers).toHaveLength(2);
  });

  it('rejects message deserialization failures with a stable visible error', async () => {
    mocks.setUiStorageBridge.mockReturnValue(new Promise<void>(() => {}));
    const { getOrCreateAvailabilityWorkerHandle } = await import(
      '../getOrCreateAvailabilityWorkerHandle.js'
    );
    const handle = getOrCreateAvailabilityWorkerHandle();
    const rejection = expect(handle.bridgeReady).rejects.toThrow(
      'Country availability worker message channel failed during initialization.'
    );

    constructedWorkers[0]?.dispatchEvent(new Event('messageerror'));

    await rejection;
    expect(constructedWorkers[0]?.terminate).toHaveBeenCalledOnce();
  });

  it('rejects an unresponsive bridge at the explicit deadline', async () => {
    vi.useFakeTimers();
    mocks.setUiStorageBridge.mockReturnValue(new Promise<void>(() => {}));
    const { AVAILABILITY_WORKER_INITIALIZATION_TIMEOUT_MS, getOrCreateAvailabilityWorkerHandle } =
      await import('../getOrCreateAvailabilityWorkerHandle.js');
    const handle = getOrCreateAvailabilityWorkerHandle();
    const rejection = expect(handle.bridgeReady).rejects.toThrow(
      `Country availability worker bridge initialization timed out after ${AVAILABILITY_WORKER_INITIALIZATION_TIMEOUT_MS}ms.`
    );

    await vi.advanceTimersByTimeAsync(AVAILABILITY_WORKER_INITIALIZATION_TIMEOUT_MS);

    await rejection;
    expect(constructedWorkers[0]?.terminate).toHaveBeenCalledOnce();
  });

  it('sanitizes bridge registration failures', async () => {
    mocks.setUiStorageBridge.mockRejectedValue(new Error('secret-storage-bridge-error'));
    const { getOrCreateAvailabilityWorkerHandle } = await import(
      '../getOrCreateAvailabilityWorkerHandle.js'
    );

    const handle = getOrCreateAvailabilityWorkerHandle();

    await expect(handle.bridgeReady).rejects.toThrow(
      'Country availability worker UI storage bridge initialization failed.'
    );
    expect(constructedWorkers[0]?.terminate).toHaveBeenCalledOnce();
  });

  it('sanitizes synchronous worker construction failures', async () => {
    failWorkerConstruction = true;
    const { getOrCreateAvailabilityWorkerHandle } = await import(
      '../getOrCreateAvailabilityWorkerHandle.js'
    );

    expect(() => getOrCreateAvailabilityWorkerHandle()).toThrow(
      'Country availability worker construction failed.'
    );
  });

  it('terminates the worker when origin coordinator registration fails', async () => {
    mocks.registerOwnedClientHandle.mockImplementation(() => {
      throw new Error('origin-coordinator-registration-failed');
    });
    const { getOrCreateAvailabilityWorkerHandle } = await import(
      '../getOrCreateAvailabilityWorkerHandle.js'
    );

    expect(() => getOrCreateAvailabilityWorkerHandle()).toThrow(
      'origin-coordinator-registration-failed'
    );
    expect(constructedWorkers[0]?.terminate).toHaveBeenCalledOnce();
    expect(mocks.wrap).not.toHaveBeenCalled();
  });

  it('unregisters and terminates the worker when client setup fails', async () => {
    mocks.wrap.mockImplementation(() => {
      throw new Error('secret-client-setup-error');
    });
    const { getOrCreateAvailabilityWorkerHandle } = await import(
      '../getOrCreateAvailabilityWorkerHandle.js'
    );

    expect(() => getOrCreateAvailabilityWorkerHandle()).toThrow(
      'Country availability worker client setup failed.'
    );
    expect(mocks.unregisterOwnedClientHandle).toHaveBeenCalledOnce();
    expect(constructedWorkers[0]?.terminate).toHaveBeenCalledOnce();
  });
});
