import { DownloadService, FetchNetworkPort, DexieChunkStoragePort } from '@hierarchidb/download';
import { AuthRecoveryService } from '@hierarchidb/auth-recovery';

/**
 * Create a DownloadService for the route plugin with auth + chunked storage.
 * Mirrors shape/location usage for maximum sharing.
 */
export async function createRouteDownloadService(opts?: { dbPrefix?: string; perHostConcurrency?: number }) {
  const auth = await AuthRecoveryService.getSingleton();
  const net = new FetchNetworkPort({
    headers: () => auth.getAuthHeaders(),
    perHostConcurrency: opts?.perHostConcurrency ?? 4,
  });
  const storage = new DexieChunkStoragePort(`${opts?.dbPrefix || 'hidb'}-chunks`);
  const integrity = new (class {
    async compute(buf: ArrayBuffer, algo: 'sha256' = 'sha256') {
      const digest = await crypto.subtle.digest(algo.toUpperCase(), buf);
      return [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, '0')).join('');
    }
  })();
  const service = new DownloadService(net as any, storage as any, integrity as any);
  return { service, net, readAll: (fileId: string) => storage.readAll!(fileId) };
}
