import type { NetworkPortLike } from './ThrottledPort.js';

export function getNetPort(): NetworkPortLike {
  return {
    async get(url: string, init?: RequestInit) {
      const response = await fetch(url, init);
      return {
        ok: response.ok,
        status: response.status,
        arrayBuffer: () => response.arrayBuffer(),
      };
    },
  };
}
