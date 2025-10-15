import { DexieChunkStoragePort, DownloadService, FetchNetworkPort } from '@hierarchidb/download';
import { AuthRecoveryService } from '@hierarchidb/auth-recovery';

export interface RouteDownloadService {
  service: DownloadService;
  readAll: (fileId: string) => Promise<ArrayBuffer>;
  net: FetchNetworkPort;
}

export interface RouteDownloadFactoryOptions {
  dbPrefix?: string;
  perHostConcurrency?: number;
}

/**
 * Create a DownloadService for the route plugin with auth + chunked storage.
 * Mirrors shape/location usage for maximum sharing.
 */
export async function createRouteDownloadService(opts?: RouteDownloadFactoryOptions): Promise<RouteDownloadService> {
  const auth = await AuthRecoveryService.getSingleton();
  const net = new FetchNetworkPort({
    headers: () => auth.getAuthHeaders(),
    perHostConcurrency: opts?.perHostConcurrency ?? 4,
  });
  const storage = new DexieChunkStoragePort(`${opts?.dbPrefix || 'hidb'}-chunks`);
  const integrity = new (class {
    async compute(buffer: ArrayBuffer, algo: 'sha256' = 'sha256'): Promise<string> {
      const digest = await crypto.subtle.digest(algo.toUpperCase(), buffer);
      return [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, '0')).join('');
    }
  })();
  const service = new DownloadService(net, storage, integrity);
  if (!storage.readAll) {
    throw new Error('DexieChunkStoragePort.readAll is not available');
  }
  const readAll = storage.readAll.bind(storage) as (fileId: string) => Promise<ArrayBuffer>;
  return {
    service,
    net,
    readAll,
  };
}
