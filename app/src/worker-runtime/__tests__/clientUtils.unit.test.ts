import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const wrap = vi.fn(() => ({ ping: vi.fn() }));

vi.mock('comlink', () => ({ wrap }));
vi.mock('~/maintenance/maintenanceLock', () => ({
  isMaintenanceLockActive: () => false,
}));

describe('canonical runtime worker initialization', () => {
  beforeEach(() => {
    vi.resetModules();
    wrap.mockClear();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('rejects one canonical attempt with a sanitized terminal error', async () => {
    let constructionCount = 0;
    class FailingSharedWorker {
      readonly port: MessagePort;

      constructor() {
        constructionCount += 1;
        const channel = new MessageChannel();
        this.port = channel.port1;
        queueMicrotask(() => {
          channel.port2.postMessage({
            type: 'INIT_ERROR',
            payload: { error: 'credential=https://private.example.test/token' },
          });
        });
      }
    }
    vi.stubGlobal('SharedWorker', FailingSharedWorker);
    const clientUtils = await import('../clientUtils.ts');
    clientUtils.configureCanonicalRuntimeWorkerBoot();

    await expect(clientUtils.initializeWorker()).rejects.toThrow(
      'runtime-worker-initialization-failed'
    );
    expect(constructionCount).toBe(1);
    expect(wrap).not.toHaveBeenCalled();
  });
});
