import { describe, it, expect } from 'vitest';
import { getRouteDownloadService, registerRouteDownloadServiceFactory } from '../../download/registry.js';

describe('route download registry', () => {
  it('uses injected factory when provided', async () => {
    const fake = {
      service: { download: async () => ({ ok: true }) },
      readAll: async () => new ArrayBuffer(0),
      net: { get: async () => ({ ok: true, status: 200, arrayBuffer: async () => new ArrayBuffer(0) }) },
    } as any;
    registerRouteDownloadServiceFactory(async () => fake);
    const svc = await getRouteDownloadService();
    expect(svc).toBe(fake);
  });
});

