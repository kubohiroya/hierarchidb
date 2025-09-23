import { describe, it, expect } from 'vitest';
import { getRouteDownloadService, registerRouteDownloadServiceFactory } from '../../download/registry.js';
import type { RouteDownloadService } from '../factory.js';
import type { FetchNetworkPort } from '@hierarchidb/download';

function createStubService(): RouteDownloadService {
  const net = {
    async head() { return createResponse(); },
    async get() { return createResponse(); },
    async getRange() { return createResponse(); },
  } as unknown as FetchNetworkPort;

  return {
    service: {
      download: async (_url: string, fileId: string) => ({ fileId }),
    } as unknown as RouteDownloadService['service'],
    readAll: async () => new ArrayBuffer(0),
    net,
  };
}

describe('route download registry', () => {
  it('uses injected factory when provided', async () => {
    const fake = createStubService();
    registerRouteDownloadServiceFactory(async () => fake);
    const svc = await getRouteDownloadService();
    expect(svc).toBe(fake);
  });
});

function createResponse() {
  return {
    ok: true,
    status: 200,
    async arrayBuffer() {
      return new ArrayBuffer(0);
    },
  };
}
