import { DownloadService, FetchNetworkPort, DexieChunkStoragePort } from '@hierarchidb/download';
import { AuthRecoveryService } from '@hierarchidb/auth-recovery';

/**
 * Creates a DownloadService wired with auth headers and IndexedDB-backed storage + CAS index.
 */
export async function createShapeDownloadService(opts?: { dbPrefix?: string; perHostConcurrency?: number }) {
  const auth = await AuthRecoveryService.getSingleton();
  const net = new FetchNetworkPort({
    headers: () => auth.getAuthHeaders(),
    // Default moderate parallelism; caller can override explicitly
    perHostConcurrency: opts?.perHostConcurrency ?? 4,
  });
  const storage = new DexieChunkStoragePort(`${opts?.dbPrefix || 'hidb'}-chunks`);
  const integrity = new (class {
    async compute(buf: ArrayBuffer, algo: 'sha256' = 'sha256') {
      const digest = await crypto.subtle.digest(algo.toUpperCase(), buf);
      return [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, '0')).join('');
    }
  })();
  const service = new DownloadService(net, storage, integrity);
  return {
    service,
    async readAll(fileId: string) {
      return storage.readAll!(fileId);
    },
  };
}
