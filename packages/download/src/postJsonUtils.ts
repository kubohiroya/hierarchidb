import { authFetch } from './helpers/authFetchUtils.js';
import { resolveNetworkUrl } from './helpers/resolveNetworkUrl.js';

export async function postJson<T = unknown>(
  scope: string,
  url: string,
  body: string | object,
  headers?: Record<string, string>,
  init?: RequestInit,
): Promise<T> {
  const resolvedUrl = resolveNetworkUrl(url);
  const mergedHeaders = new Headers(init?.headers);
  if (!mergedHeaders.has('Content-Type')) {
    mergedHeaders.set(
      'Content-Type',
      typeof body === 'string' ? 'application/x-www-form-urlencoded' : 'application/json',
    );
  }
  if (headers) {
    Object.entries(headers).forEach(([key, value]) => { mergedHeaders.set(key, value) });
  }
  const initBody = typeof body === 'string' ? body : JSON.stringify(body);
  const requestInit: RequestInit = {
    ...init,
    method: 'POST',
    body: initBody,
    headers: mergedHeaders,
  };
  const response = await authFetch(scope, resolvedUrl, requestInit);
  if (!response.ok) {
    throw new Error(`HTTP ${response.status}`);
  }
  return (await response.json()) as T;
}
