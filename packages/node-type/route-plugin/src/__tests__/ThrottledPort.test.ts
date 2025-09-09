import { describe, expect, it } from 'vitest';
import { ThrottledPort } from '../services/net/ThrottledPort';

class FakePort {
  async get(_url: string) {
    return { ok: true, status: 200, arrayBuffer: async () => new ArrayBuffer(0) };
  }
}

describe('ThrottledPort', () => {
  it('limits concurrent requests', async () => {
    const base = new FakePort();
    const port = new ThrottledPort(base as any, { concurrency: 2 });

    let inFlight = 0;
    let maxInFlight = 0;

    const doReq = async () => {
      inFlight++;
      maxInFlight = Math.max(maxInFlight, inFlight);
      // simulate variable latency
      const res = await port.get('https://example.com/x');
      await new Promise((r) => setTimeout(r, 5));
      inFlight--;
      return res.status;
    };

    const results = await Promise.all(Array.from({ length: 8 }, doReq));
    expect(results.every((s) => s === 200)).toBe(true);
    expect(maxInFlight).toBeLessThanOrEqual(2);
  });

  it('applies simple rps token bucket', async () => {
    const base = new FakePort();
    const port = new ThrottledPort(base as any, { rps: 2 });

    const t0 = Date.now();
    await Promise.all([port.get('a'), port.get('b'), port.get('c')]);
    const elapsedMs = Date.now() - t0;
    // 3rd request should wait roughly until the next second window; allow slack
    expect(elapsedMs).toBeGreaterThanOrEqual(200); // loose bound for CI stability
  });
});

