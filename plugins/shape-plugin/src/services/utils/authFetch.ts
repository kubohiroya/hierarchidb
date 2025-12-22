import { AuthRecoveryService } from '@hierarchidb/auth-recovery';
import { resolveNetworkUrl } from '@hierarchidb/download';
import { getCorsProxyBaseURL } from './corsProxyBase.js';

export async function authFetch(input: string, init?: RequestInit): Promise<Response> {
  const auth = await AuthRecoveryService.getSingleton();
  const target = resolveNetworkUrl(input, { corsProxyBaseURL: getCorsProxyBaseURL() });
  return auth.fetchWithAuth(target, init, { pluginType: 'shape' });
}
