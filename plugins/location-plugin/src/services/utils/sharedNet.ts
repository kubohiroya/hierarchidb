import { AuthRecoveryService } from '@hierarchidb/auth-recovery';

type DownloadRegistryModule = typeof import('../download/registry.js');

let registryModule: Promise<DownloadRegistryModule> | null = null;
function ensureDownloadRegistry(): Promise<DownloadRegistryModule> {
  if (!registryModule) {
    registryModule = import('../download/registry.js');
  }
  return registryModule;
}

let cached: Promise<Awaited<ReturnType<DownloadRegistryModule['getLocationDownloadService']>>> | undefined;

async function ensure() {
  if (!cached) {
    const { getLocationDownloadService } = await ensureDownloadRegistry();
    cached = getLocationDownloadService();
  }
  return cached;
}

export async function getJson(url: string, init?: RequestInit): Promise<any> {
  const { net } = await ensure();
  const res = await net.get(url, init);
  if (res.status === 401 || res.status === 403) {
    const { notifyLocationAuthRequired } = await ensureDownloadRegistry();
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
  const res = await auth.fetchWithAuth(url, init, { pluginType: 'location' });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.json();
}
