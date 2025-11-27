import { describe, it, expect, vi } from 'vitest';
import { getLocationDownloadService, registerLocationDownloadServiceFactory, configureLocationDownloadDefaults } from '../../registry';
import type { LocationDownloadService } from '../../download/registry';
import { DownloadService, FetchNetworkPort } from '@hierarchidb/download';
import type { StoragePort } from '@hierarchidb/download';

class StubStoragePort implements StoragePort {
  async putChunk(): Promise<void> {}
  async commit(): Promise<void> {}
  async getResumeInfo(): Promise<{ nextIndex: number } | undefined> { return undefined; }
  async readAll(): Promise<ArrayBuffer> { return new ArrayBuffer(0); }
}

describe('location download registry', () => {
  it('uses injected factory and respects defaults', async () => {
    configureLocationDownloadDefaults({ perHostConcurrency: 7 });
    const fetchSpy = vi.fn<typeof globalThis.fetch>(
      async (_input: Parameters<typeof globalThis.fetch>[0], _init?: Parameters<typeof globalThis.fetch>[1]) =>
        new Response(new ArrayBuffer(0), { status: 200 }),
    );
    const originalFetch = globalThis.fetch;
    globalThis.fetch = fetchSpy;
    try {
      const network = new FetchNetworkPort();
      const storage = new StubStoragePort();
      const service = new DownloadService(network, storage);
      const fake: LocationDownloadService = {
        net: network,
        service,
        readAll: storage.readAll.bind(storage),
      };
      let seen: { dbPrefix?: string; perHostConcurrency?: number } | undefined;
      registerLocationDownloadServiceFactory(async (o) => { seen = o; return fake; });
      const svc = await getLocationDownloadService({ dbPrefix: 'x' });
      expect(svc).toBe(fake);
      expect(seen).toMatchObject({ dbPrefix: 'x', perHostConcurrency: 7 });
    } finally {
      globalThis.fetch = originalFetch;
    }
  });
});
