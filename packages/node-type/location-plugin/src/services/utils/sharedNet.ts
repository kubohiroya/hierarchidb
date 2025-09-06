import { createSharedDownloadService } from '@hierarchidb/runtime-shared/batch-processor/src/downloadAdapter';
import { AuthRecoveryService } from '@hierarchidb/auth-recovery';

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

export async function postJson(url: string, body: string, headers?: Record<string,string>) {
  // Fallback to auth-recovery for POST (shared net is GET-oriented)
  const auth = await AuthRecoveryService.getSingleton();
  const res = await auth.fetchWithAuth(url, { method: 'POST', body, headers: { 'Content-Type': 'application/x-www-form-urlencoded', ...(headers||{}) } }, { pluginType: 'location' });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.json();
}

