import type { NetworkPortLike } from './ThrottledPort';

export function getNetPort(): NetworkPortLike {
  const g: any = (globalThis as any);
  try {
    const reg = g?.hidbFeatureRegistry || g?.FeatureRegistry || g?.featureRegistry;
    if (reg && typeof reg.require === 'function') {
      const p = reg.require('net.port');
      if (p) return p as NetworkPortLike;
    }
  } catch {
  }
  return {
    async get(url: string, init?: RequestInit) {
      const res = await fetch(url, init);
      return { ok: res.ok, status: res.status, arrayBuffer: () => res.arrayBuffer() } as any;
    },
  } as NetworkPortLike;
}

