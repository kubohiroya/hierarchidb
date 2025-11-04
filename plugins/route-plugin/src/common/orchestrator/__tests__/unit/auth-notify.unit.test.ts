import { describe, it, expect, vi } from 'vitest';
import { RouteSourceOrchestrator } from '../RouteSourceOrchestrator.js';
import * as registry from '../../../services/download/registry.js';
import type { RouteBatchSpec } from '../types.js';
import type { RouteDownloadService } from '../../../services/download/factory.js';
import type { FetchNetworkPort } from '@hierarchidb/download';
import type { NetworkPortLike } from '../../../services/createRouteBatchManager.js';

describe('RouteSourceOrchestrator auth notifier', () => {
  it('notifies on auth error during preview download', async () => {
    const spy = vi.fn();
    registry.registerRouteAuthNotifier(spy);

    const fakeSvc = createDownloadServiceStub({ ok: false, status: 401 });
    const svcMock = vi.spyOn(registry, 'getRouteDownloadService').mockResolvedValue(fakeSvc);

    const orch = new RouteSourceOrchestrator({ net: createNetworkPort({ ok: true, status: 200 }) });
    const spec: RouteBatchSpec = { sources: [{ type: 'csv', url: 'https://example.com/protected.csv' }], defaults: {} };

    await expect(orch.preview(spec)).rejects.toThrowError();
    expect(spy).toHaveBeenCalledTimes(1);
    const [[firstCall]] = spy.mock.calls as [[{ resource?: string }]];
    expect(firstCall?.resource).toContain('protected.csv');

    svcMock.mockRestore();
  });
});

function createDownloadServiceStub(response: { ok: boolean; status: number }): RouteDownloadService {
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
    } as unknown as RouteDownloadService['service'],
    readAll: async () => new ArrayBuffer(0),
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

function createNetworkPort(response: { ok: boolean; status: number }): NetworkPortLike {
  return {
    async get() {
      return createResponse(response);
    },
  };
}
