import { afterEach, describe, expect, it, vi } from 'vitest';
import { smartFetch } from '~/smartFetch';

const originalFetch = globalThis.fetch;

const makeResponse = (status: number): Response => ({
  status,
  ok: status >= 200 && status < 300,
} as Response);

describe('smartFetch', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    globalThis.fetch = originalFetch;
  });

  it('requires auth.scope when auth is enabled', async () => {
    await expect(
      smartFetch('https://example.com/resource', { auth: { enabled: true } }),
    ).rejects.toThrow('[download][smartFetch] auth.scope is required');
  });

  it('retries on retryable statuses when auth is disabled', async () => {
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(makeResponse(500))
      .mockResolvedValueOnce(makeResponse(200));
    vi.stubGlobal('fetch', fetchMock as unknown as typeof fetch);

    const res = await smartFetch('https://example.com/resource', {
      auth: { enabled: false },
      retry: { retries: 1, baseDelayMs: 0, maxDelayMs: 0 },
    });

    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(res.status).toBe(200);
  });
});
