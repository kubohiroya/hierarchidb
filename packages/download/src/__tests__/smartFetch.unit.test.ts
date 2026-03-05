import { afterEach, describe, expect, it, vi } from 'vitest';
import { smartFetch } from '../smartFetch';

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
    vi.stubGlobal('fetch', fetchMock as typeof fetch);

    const res = await smartFetch('https://example.com/resource', {
      auth: { enabled: false },
      retry: { retries: 1, baseDelayMs: 0, maxDelayMs: 0 },
    });

    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(res.status).toBe(200);
  });

  it('reports download progress percentage while reading response body', async () => {
    const body = new ReadableStream<Uint8Array>({
      start(controller) {
        controller.enqueue(new Uint8Array([1, 2]));
        controller.enqueue(new Uint8Array([3, 4]));
        controller.close();
      },
    });
    const fetchMock = vi.fn().mockResolvedValueOnce(new Response(body, {
      status: 200,
      headers: { 'content-length': '4' },
    }));
    vi.stubGlobal('fetch', fetchMock as typeof fetch);
    const percentages: number[] = [];

    const response = await smartFetch('https://example.com/resource', {
      auth: { enabled: false },
      onDownloadProgress: ({ percentage }) => {
        if (typeof percentage === 'number') {
          percentages.push(Math.round(percentage));
        }
      },
    });

    expect(response.status).toBe(200);
    expect(percentages).toContain(50);
    expect(percentages[percentages.length - 1]).toBe(100);
  });
});
