import { describe, it, expect, vi, beforeEach } from 'vitest';
import { FetchNetworkPort } from '../adapters/FetchNetworkPort';

// Fake fetch that records concurrent calls and resolves after a delay
function makeFakeFetch(delayMs = 50) {
  let current = 0;
  let peak = 0;
  const calls: string[] = [];
  const fake = vi.fn(async (url: string) => {
    calls.push(url);
    current++;
    peak = Math.max(peak, current);
    await new Promise((r) => setTimeout(r, delayMs));
    current--;
    return new Response(new Blob(["ok"]), { status: 200 });
  });
  return { fake, getPeak: () => peak, getCalls: () => calls.slice() };
}

describe('FetchNetworkPort throttling', () => {
  beforeEach(() => {
    vi.useRealTimers();
  });

  it('limits per-host concurrency', async () => {
    const { fake, getPeak } = makeFakeFetch(30);
    // @ts-ignore
    global.fetch = fake as any;
    const port = new FetchNetworkPort({ perHostConcurrency: 2 });
    const urls = [1,2,3,4,5].map(i => `https://example.com/r${i}`);
    await Promise.all(urls.map(u => port.get(u)));
    expect(getPeak()).toBeLessThanOrEqual(2);
  });

  it('honors globalConcurrency when provided', async () => {
    const { fake, getPeak } = makeFakeFetch(20);
    // @ts-ignore
    global.fetch = fake as any;
    const port = new FetchNetworkPort({ perHostConcurrency: 10, globalConcurrency: 3 });
    const urls = Array.from({length: 8}, (_,i) => `https://a.example/r${i}`);
    await Promise.all(urls.map(u => port.get(u)));
    expect(getPeak()).toBeLessThanOrEqual(3);
  });

  it('throttles by rps tokens when provided', async () => {
    const { fake } = makeFakeFetch(0);
    // @ts-ignore
    global.fetch = fake as any;
    const port = new FetchNetworkPort({ rps: 2, perHostConcurrency: 5 });
    const start = Date.now();
    await Promise.all([1,2,3,4].map(i => port.get(`https://b.example/r${i}`)));
    const elapsed = Date.now() - start;
    // With rps=2, 4 requests should take at least ~1000ms (2 per second) but allow for timer jitter
    expect(elapsed).toBeGreaterThanOrEqual(800);
  });
});

