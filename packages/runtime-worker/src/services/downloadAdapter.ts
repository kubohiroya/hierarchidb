import { AuthRecoveryService } from '@hierarchidb/auth-recovery';
import { DexieChunkStoragePort, DownloadService, FetchNetworkPort } from '@hierarchidb/download';

export interface SharedDownloadOptions {
  dbPrefix?: string;
  perHostConcurrency?: number;
}

export interface SharedDownloadService {
  service: DownloadService;
  // net is intentionally typed as unknown to avoid leaking DOM-dependent types into public API
  net: FetchNetworkPort;
  readAll: (fileId: string) => Promise<ArrayBuffer>;
}

export async function createSharedDownloadService(
  opts?: SharedDownloadOptions
): Promise<SharedDownloadService> {
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
  return { service, net, readAll };
}

/**
 * POST helper (JSON) using AuthRecovery complements DownloadService (GET-oriented).
 */
export async function postJson(
  url: string,
  body: string | object,
  headers?: Record<string, string>
) {
  const auth = await AuthRecoveryService.getSingleton();
  const init: RequestInit = {
    method: 'POST',
    body: typeof body === 'string' ? body : JSON.stringify(body),
    headers: {
      'Content-Type':
        typeof body === 'string' ? 'application/x-www-form-urlencoded' : 'application/json',
      ...(headers || {}),
    },
  };
  // Use a valid PluginType understood by the _obsolate_common-auth system ('shape'|'spreadsheet'|'styler').
  const res = await auth.fetchWithAuth(url, init, { pluginType: 'shape' });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.json();
}
