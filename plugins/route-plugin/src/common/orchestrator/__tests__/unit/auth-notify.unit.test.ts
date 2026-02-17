import { describe, it, expect, vi } from 'vitest';
import { RouteSourceOrchestrator } from '../RouteSourceOrchestrator.js';
import { FetchNetworkPort, registerPluginAuthNotifier } from '@hierarchidb/download';
import type { RouteBuildSpec } from '../types.js';

describe('RouteSourceOrchestrator auth notifier', () => {
  it('notifies on auth error during preview download', async () => {
    const spy = vi.fn();
    registerPluginAuthNotifier('route', spy);

    const getMock = vi.spyOn(FetchNetworkPort.prototype, 'get').mockResolvedValue(createResponse({ ok: false, status: 401 }));

    const orch = new RouteSourceOrchestrator();
    const spec: RouteBuildSpec = { sources: [{ type: 'csv', url: 'https://example.com/protected.csv' }], defaults: {} };

    await expect(orch.preview(spec)).rejects.toThrowError();
    expect(spy).toHaveBeenCalledTimes(1);
    const [[firstCall]] = spy.mock.calls as [[{ resource?: string }]];
    expect(firstCall?.resource).toContain('protected.csv');

    getMock.mockRestore();
  });
});

function createResponse(response: { ok: boolean; status: number }) {
  return {
    ok: response.ok,
    status: response.status,
    async arrayBuffer() {
      return new ArrayBuffer(0);
    },
  };
}
