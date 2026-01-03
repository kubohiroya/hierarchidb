import { describe, it, expect, vi } from 'vitest';
import { RouteSourceOrchestrator } from '../RouteSourceOrchestrator.js';
import * as download from '@hierarchidb/download';
import type { RouteBatchSpec } from '../types.js';
import type { DownloadServiceBundle, FetchNetworkPort } from '@hierarchidb/download';

describe('RouteSourceOrchestrator auth notifier', () => {
  it('notifies on auth error during preview download', async () => {
    const spy = vi.fn();
    download.registerPluginAuthNotifier('route', spy);

    const fakeSvc = createDownloadServiceStub({ ok: false, status: 401 });
    const svcMock = vi.spyOn(download, 'getPluginDownloadService').mockResolvedValue(fakeSvc);

    const orch = new RouteSourceOrchestrator();
    const spec: RouteBatchSpec = { sources: [{ type: 'csv', url: 'https://example.com/protected.csv' }], defaults: {} };

    await expect(orch.preview(spec)).rejects.toThrowError();
    expect(spy).toHaveBeenCalledTimes(1);
    const [[firstCall]] = spy.mock.calls as [[{ resource?: string }]];
    expect(firstCall?.resource).toContain('protected.csv');

    svcMock.mockRestore();
  });
});

function createDownloadServiceStub(response: { ok: boolean; status: number }): DownloadServiceBundle {
  const net = {
    async head() {
      return createResponse(response);
    },
    async get() {
      return createResponse(response);
    },
    async getRange() {
      return createResponse(response);
    },
  } as unknown as FetchNetworkPort;

  return {
    service: {
      download: async () => {
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        return { fileId: 'stub', sizeBytes: 0 };
      },
    } as unknown as DownloadServiceBundle['service'],
    readAll: async () => new ArrayBuffer(0),
    store: {
      async putChunk() {},
      async commit() {},
      async getResumeInfo() {
        return undefined;
      },
    },
    net,
  };
}

function createResponse(response: { ok: boolean; status: number }) {
  return {
    ok: response.ok,
    status: response.status,
    async arrayBuffer() {
      return new ArrayBuffer(0);
    },
  };
}
