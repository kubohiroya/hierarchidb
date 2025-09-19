import { describe, it, expect, vi } from 'vitest';
import type { ProgressEvent } from '@hierarchidb/common-type';

vi.mock('@hierarchidb/batch', () => ({ BatchService: class {} }));
vi.mock('@hierarchidb/tabular-store', () => ({ TabularWriter: class {} }));

// Import after mocks are set up
const { UnifiedLocationBatchManager } = await import('../UnifiedLocationBatchManager.js');
const { LocationBatchSessionManager } = await import('../BatchSessionManager.js');

describe('UnifiedLocationBatchManager.onBatchProgress', () => {
  it('converts plugin events to StandardProgressEvent via adapter', async () => {
    const mgr = new UnifiedLocationBatchManager();
    // Inject fake internal manager to control onProgress emission
    class StubManager extends LocationBatchSessionManager {
      constructor(private readonly emit: (cb: (e: ProgressEvent) => void) => void) {
        super();
      }

      override onProgress(_sid: string, cb: (e: ProgressEvent) => void): () => void {
        this.emit(cb);
        return () => {};
      }
    }

    const stub = new StubManager((cb) => {
      cb({ sessionId: 's1', stage: 'index', total: 20, completed: 10, failed: 0, percentage: 50, currentTask: 'indexing' });
    });
    mgr.setInternalManager(stub);

    const spy = vi.fn();
    const unsub = mgr.onBatchProgress('s1', (ev) => spy(ev));
    expect(spy).toHaveBeenCalledTimes(1);
    const [firstCall] = spy.mock.calls;
    expect(firstCall).toBeDefined();
    const arg = firstCall![0];
    expect(arg).toBeDefined();
    expect(arg.sessionId).toBe('s1');
    expect(arg.stage).toBe('vectortile'); // index → vectortile
    expect(arg.percentage).toBe(50);
    expect(arg.total).toBe(20);
    expect(arg.completed).toBe(10);
    unsub();
  });
});
