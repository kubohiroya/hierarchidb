import { SharedDownloadOptions, SharedDownloadService } from '@hierarchidb/runtime-worker';
import { getLocationDownloadService, notifyLocationAuthRequired } from '../download/registry.js';
import { AuthRecoveryService } from '@hierarchidb/auth-recovery';
import { DexieChunkStoragePort, DownloadService, FetchNetworkPort } from '@hierarchidb/download';

let cached: Promise<Awaited<ReturnType<typeof getLocationDownloadService>>> | undefined;

async function ensure() {
  if (!cached) cached = getLocationDownloadService();
  return cached;
}

export async function getJson(url: string, init?: RequestInit): Promise<any> {
  const { net } = await ensure();
  const res = await net.get(url, init);
  if (res.status === 401 || res.status === 403) {
    notifyLocationAuthRequired({ resource: url, provider: 'location', hint: 'Authentication required', status: res.status });
    throw new Error(`Auth required: ${res.status}`);
  }
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const buf = await res.arrayBuffer();
  const text = new TextDecoder().decode(buf);
  return JSON.parse(text);
}

export async function postJson(url: string, body: string | object, headers?: Record<string, string>) {
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

export async function createSharedDownloadService(opts?: SharedDownloadOptions): Promise<SharedDownloadService> {
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
