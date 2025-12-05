import { describe, expect, it, beforeEach, afterEach, vi } from 'vitest';
import type { Remote } from 'comlink';
import type { WorkerAPI, BatchSessionStatus, BatchProgressEvent } from '@hierarchidb/common-api';
import type { NodeType } from '@hierarchidb/common-types';
import {
  __setWorkerBridgeClientRef,
  ensureWorkerAPI,
  getWorkerBridge,
} from '@hierarchidb/ui-worker-client';

function createMockWorkerAPI() {
  return {
    startBatchSession: vi.fn(async (_nodeType: NodeType, nodeId: string) => ({
      sessionId: `${nodeId}-session`,
      status: 'running',
      nodeId,
    } satisfies BatchSessionStatus)),
    getBatchSessionStatus: vi.fn(async () => ({
      sessionId: 'sess-1',
      status: 'running',
      nodeId: 'node-1',
    } satisfies BatchSessionStatus)),
    pauseBatchSession: vi.fn(async () => {}),
    resumeBatchSession: vi.fn(async () => {}),
    cancelBatchSession: vi.fn(async () => {}),
    subscribeBatchProgress: vi.fn(async (_nodeType: NodeType, _sessionId: string, cb: (event: BatchProgressEvent) => void) => {
      cb({
        sessionId: 'sess-1',
        nodeId: 'node-1',
        stage: 'download',
        phase: 'running',
        timestamp: Date.now(),
      });
      return () => {};
    }),
  } as unknown as Remote<WorkerAPI>;
}

describe('worker bridge', () => {
  beforeEach(() => {
    const client = createMockWorkerAPI();
    __setWorkerBridgeClientRef({
      client,
      isInitialized: true,
      initialize: async () => {},
      getAPI: () => client,
    } as any);
  });

  afterEach(() => {
    __setWorkerBridgeClientRef(null);
  });

  it('returns worker API via ensureWorkerAPI', async () => {
    const api = await ensureWorkerAPI();
    expect(api).toBeDefined();
    await api.pauseBatchSession('node' as any, 'sess-1');
    expect((api.pauseBatchSession as any).mock.calls.length).toBe(1);
  });

  it('invokes remote worker operations through bridge helpers', async () => {
    const bridge = getWorkerBridge();
    const status = await bridge.startBatchSession('node' as any, 'node-2');
    expect(status.sessionId).toBe('node-2-session');
    await bridge.subscribeBatchProgress('node' as any, 'sess-1', () => {});
    const api = await ensureWorkerAPI();
    expect((api.subscribeBatchProgress as any).mock.calls.length).toBe(1);
  });
});
