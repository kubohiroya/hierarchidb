import { type DownloadServiceOptions, type DownloadServiceBundle, createDownloadService } from '@hierarchidb/download';
import { getLocationDownloadService, notifyLocationAuthRequired } from '../download/registry.js';
import { AuthRecoveryService } from '@hierarchidb/auth-recovery';

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

export async function createSharedDownloadService(opts?: DownloadServiceOptions): Promise<DownloadServiceBundle> {
  return createDownloadService(opts);
}
