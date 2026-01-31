import type { AuthScope } from '@hierarchidb/auth-api';
import { AuthService } from '@hierarchidb/auth';
import { resolveNetworkUrl } from './resolveNetworkUrl.js';

/**
 * authFetch is a helper for authenticated network access.
 * - It resolves URL via resolveNetworkUrl (CORS proxy/local proxy)
 * - It delegates to AuthService (canonical authenticated fetch entry point)
 */
export async function authFetch(
  scope: string,
  input: string,
  init?: RequestInit,
): Promise<Response> {
  const auth = await AuthService.getSingleton();
  const target = resolveNetworkUrl(input);
  return auth.fetchWithAuth(target, init, { scope: scope as AuthScope });
}
