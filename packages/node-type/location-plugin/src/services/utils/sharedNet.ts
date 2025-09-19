import { postJson } from '@hierarchidb/runtime-shared-batch-processor';
import { getLocationDownloadService, notifyLocationAuthRequired } from '../download/registry.js';

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

export { postJson };
