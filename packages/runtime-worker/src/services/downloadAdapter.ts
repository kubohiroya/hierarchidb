import { AuthService } from '@hierarchidb/auth-recovery';
import type { AuthScope } from '@hierarchidb/auth-recovery';
import { DexieChunkStore } from '@hierarchidb/chunk-store';
import { DownloadService, FetchNetworkPort } from '@hierarchidb/download';

export interface SharedDownloadOptions {
  dbPrefix?: string;
  perHostConcurrency?: number;
  /**
   * AuthRequired通知/認証プロバイダ選択ダイアログの文脈を決めるためのスコープ。
   * 例: 'shape' | 'location' | 'route'
   */
  scope?: AuthScope;
}

export interface SharedFetchService {
  service: DownloadService;
  // net is intentionally typed as unknown to avoid leaking DOM-dependent types into public API
  net: FetchNetworkPort;
  readAll: (fileId: string) => Promise<ArrayBuffer>;
}

export async function createSharedDownloadService(
  opts?: SharedDownloadOptions
): Promise<SharedFetchService> {
  const auth = await AuthService.getSingleton();
  const scope = opts?.scope ?? 'generic';
  const net = new FetchNetworkPort({
    headers: () => auth.getAuthHeaders(),
    perHostConcurrency: opts?.perHostConcurrency ?? 4,
    authFetch: (url, init) => auth.fetchWithAuth(url, init, { scope }),
  });
  const storage = new DexieChunkStore<ArrayBuffer>({
    dbName: `${opts?.dbPrefix || 'hidb'}-chunks`,
    serializer: (value) => value,
    deserializer: (buffer) => buffer,
    networkOptions: {
      auth: { enabled: false },
    },
  });
  const integrity = new (class {
    async compute(buffer: ArrayBuffer, algo: 'sha256' = 'sha256'): Promise<string> {
      const digest = await crypto.subtle.digest(algo.toUpperCase(), buffer);
      return [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, '0')).join('');
    }
  })();
  const service = new DownloadService(net, storage, integrity);
  const readAll = storage.readAll.bind(storage) as (fileId: string) => Promise<ArrayBuffer>;
  return { service, net, readAll };
}

/**
 * POST helper (JSON) using AuthRecovery complements DownloadService (GET-oriented).
 */
export async function postJson(
  scope: AuthScope,
  url: string,
  body: string | object,
  headers?: Record<string, string>
) {
  const auth = await AuthService.getSingleton();
  const init: RequestInit = {
    method: 'POST',
    body: typeof body === 'string' ? body : JSON.stringify(body),
    headers: {
      'Content-Type':
        typeof body === 'string' ? 'application/x-www-form-urlencoded' : 'application/json',
      ...(headers || {}),
    },
  };
  // scope is routed to UI notification via common-auth's pluginType (narrowed internally by AuthService).
  const res = await auth.fetchWithAuth(url, init, { scope });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.json();
}
