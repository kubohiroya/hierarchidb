import { DownloadService, FetchNetworkPort, DexieChunkStoragePort } from '@hierarchidb/download';
import { AuthRecoveryService } from '@hierarchidb/auth-recovery';

export interface SharedDownloadOptions { dbPrefix?: string; perHostConcurrency?: number }

export async function createSharedDownloadService(opts?: SharedDownloadOptions) {
  const auth = await AuthRecoveryService.getSingleton();
  const net = new FetchNetworkPort({ headers: () => auth.getAuthHeaders(), perHostConcurrency: opts?.perHostConcurrency ?? 4 });
  const storage = new DexieChunkStoragePort(`${opts?.dbPrefix || 'hidb'}-chunks`);
  const integrity = new (class { async compute(buf: ArrayBuffer, algo: 'sha256' = 'sha256') { const d = await crypto.subtle.digest(algo.toUpperCase(), buf); return [...new Uint8Array(d)].map((b) => b.toString(16).padStart(2, '0')).join(''); } })();
  const service = new DownloadService(net as any, storage as any, integrity as any);
  return { service, net, readAll: (fileId: string) => storage.readAll!(fileId) };
}

/**
 * POST helper (JSON) using AuthRecovery — complements DownloadService (GET-oriented).
 */
export async function postJson(url: string, body: string | object, headers?: Record<string,string>) {
  const auth = await AuthRecoveryService.getSingleton();
  const init: RequestInit = {
    method: 'POST',
    body: typeof body === 'string' ? body : JSON.stringify(body),
    headers: {
      'Content-Type': typeof body === 'string' ? 'application/x-www-form-urlencoded' : 'application/json',
      ...(headers || {}),
    },
  };
  // Use a valid PluginType understood by the common-auth system ('shape'|'spreadsheet'|'styler').
  const res = await auth.fetchWithAuth(url, init, { pluginType: 'shape' });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.json();
}
