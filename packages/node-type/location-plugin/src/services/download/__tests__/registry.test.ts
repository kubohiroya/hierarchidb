import { describe, it, expect } from 'vitest';
import { getLocationDownloadService, registerLocationDownloadServiceFactory, configureLocationDownloadDefaults } from '../../download/registry.js';

describe('location download registry', () => {
  it('uses injected factory and respects defaults', async () => {
    configureLocationDownloadDefaults({ perHostConcurrency: 7 });
    const fake = {
      net: { get: async () => ({ ok: true, status: 200, arrayBuffer: async () => new ArrayBuffer(0) }) },
      service: { download: async () => ({ ok: true }) },
    } as any;
    let seen: any;
    registerLocationDownloadServiceFactory(async (o) => { seen = o; return fake; });
    const svc = await getLocationDownloadService({ dbPrefix: 'x' });
    expect(svc).toBe(fake);
    expect(seen).toMatchObject({ dbPrefix: 'x', perHostConcurrency: 7 });
  });
});

