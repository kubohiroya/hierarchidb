import { describe, it, expect, vi } from 'vitest';

vi.mock('@hierarchidb/batch', () => ({ BatchService: class {} }));
vi.mock('@hierarchidb/tabular-store', () => ({ TabularWriter: class {} }));

// Import after mocks are set up
const { UnifiedLocationBatchManager } = await import('../UnifiedLocationBatchManager');

describe('UnifiedLocationBatchManager.onBatchProgress', () => {
  it('converts plugin events to StandardProgressEvent via adapter', async () => {
    const mgr = new UnifiedLocationBatchManager();
    // Inject fake internal manager to control onProgress emission
    const fake = {
      onProgress: (_sid: string, cb: (e: any) => void) => {
        // simulate a plugin-native event
        cb({ sessionId: 's1', stage: 'index', total: 20, completed: 10 });
        return () => {};
      },
    };
    (mgr as any).manager = fake;

    const spy = vi.fn();
    const unsub = mgr.onBatchProgress('s1', (ev) => spy(ev));
    expect(spy).toHaveBeenCalledTimes(1);
    const arg = spy.mock.calls[0][0];
    expect(arg.sessionId).toBe('s1');
    expect(arg.stage).toBe('vectortile'); // index → vectortile
    expect(arg.percentage).toBe(50);
    expect(arg.total).toBe(20);
    expect(arg.completed).toBe(10);
    unsub();
  });
});
