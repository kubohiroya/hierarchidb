import { DownloadService as DownloadEngine } from './DownloadService.js';
import { DexieChunkStoragePort } from './adapters/DexieChunkStoragePort.js';
import { FetchNetworkPort } from './adapters/FetchNetworkPort.js';
import { AuthRecoveryService, type AuthPluginType } from '@hierarchidb/auth-recovery';

export interface DownloadServiceOptions {
  dbPrefix?: string;
  perHostConcurrency?: number;
  corsProxyBaseURL?: string;
  pluginType?: AuthPluginType;
}

export interface DownloadServiceBundle {
  service: DownloadEngine;
  net: FetchNetworkPort;
  readAll: (fileId: string) => Promise<ArrayBuffer>;
}

export async function createDownloadService(opts?: DownloadServiceOptions): Promise<DownloadServiceBundle> {
  const auth = await AuthRecoveryService.getSingleton();
  const pluginType = opts?.pluginType ?? 'generic';
  const net = new FetchNetworkPort({
    headers: () => auth.getAuthHeaders(),
    perHostConcurrency: opts?.perHostConcurrency ?? 4,
    corsProxyBaseURL: opts?.corsProxyBaseURL,
    authFetch: (url, init) => auth.fetchWithAuth(url, init, { pluginType }),
  });
  const storage = new DexieChunkStoragePort(`${opts?.dbPrefix || 'hidb'}-chunks`);
  const integrity = new (class {
    async compute(buffer: ArrayBuffer, algo: 'sha256' = 'sha256'): Promise<string> {
      const digest = await crypto.subtle.digest(algo.toUpperCase(), buffer);
      return [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, '0')).join('');
    }
  })();
  const service = new DownloadEngine(net, storage, integrity);
  if (!storage.readAll) {
    throw new Error('DexieChunkStoragePort.readAll is not available');
  }
  const readAll = storage.readAll.bind(storage) as (fileId: string) => Promise<ArrayBuffer>;
  return { service, net, readAll };
}
