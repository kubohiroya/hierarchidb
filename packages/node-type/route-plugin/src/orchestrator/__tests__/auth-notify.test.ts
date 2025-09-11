import { describe, it, expect, vi } from 'vitest';
import { RouteSourceOrchestrator } from '../RouteSourceOrchestrator';
import * as registry from '../../services/download/registry';

describe('RouteSourceOrchestrator auth notifier', () => {
  it('notifies on auth error during preview download', async () => {
    const spy = vi.fn();
    registry.registerRouteAuthNotifier(spy);
    // Stub getRouteDownloadService to throw HTTP 401 on download
    const fakeSvc = {
      service: { download: async () => { throw new Error('HTTP 401 Unauthorized'); } },
      readAll: async () => new ArrayBuffer(0),
      net: { get: async () => ({ ok: false, status: 401, arrayBuffer: async () => new ArrayBuffer(0) }) },
    } as any;
    const spySvc = vi.spyOn(registry, 'getRouteDownloadService').mockResolvedValue(fakeSvc);

    const orch = new RouteSourceOrchestrator({ net: { get: async () => ({ ok: true, status: 200, arrayBuffer: async () => new ArrayBuffer(0) }) } });
    const spec: any = { sources: [{ type: 'csv', url: 'https://example.com/protected.csv' }], defaults: {} };

    await expect(orch.preview(spec)).rejects.toThrowError();
    expect(spy).toHaveBeenCalledTimes(1);
    expect(spy.mock.calls[0][0].resource).toContain('protected.csv');

    spySvc.mockRestore();
  });
});
