import { createSharedDownloadService, postJson } from '@hierarchidb/runtime-shared/batch-processor/src/downloadAdapter';


let cached: Promise<ReturnType<typeof createSharedDownloadService>> | undefined;

async function ensure() {
  if (!cached) cached = createSharedDownloadService();
  return cached;
}

export async function getJson(url: string, init?: RequestInit): Promise<any> {
  const { net } = await ensure();
  const res = await net.get(url, init);
  if (res.status === 401 || res.status === 403) {
    try {
      const g: any = globalThis as any;
      const reg = g?.AuthNotificationRegistry?.getInstance?.() || g?.authNotificationRegistry || g?.authRegistry;
      reg?.onAuthRequired?.({ resource: url, provider: 'location', hint: 'Authentication required' });
    } catch {}
    throw new Error(`Auth required: ${res.status}`);
  }
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const buf = await res.arrayBuffer();
  const text = new TextDecoder().decode(buf);
  return JSON.parse(text);
}

export { postJson };

