import { postJson as postJsonForPlugin } from '@hierarchidb/download';

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

export async function getText(url: string, init?: RequestInit): Promise<string> {
  const { net } = await ensure();
  const res = await net.get(url, init);
  if (res.status === 401 || res.status === 403) {
    const { notifyLocationAuthRequired } = await ensureDownloadRegistry();
    notifyLocationAuthRequired({ resource: url, provider: 'location', hint: 'Authentication required', status: res.status });
    throw new Error(`Auth required: ${res.status}`);
  }
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const buf = await res.arrayBuffer();
  return new TextDecoder().decode(buf);
}

export async function postJson<T = unknown>(
  url: string,
  body: string | object,
  headers?: Record<string, string>,
): Promise<T> {
  return postJsonForPlugin<T>('location', url, body, headers);
}
