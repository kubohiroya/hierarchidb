import { AuthRecoveryService, type AuthPluginType } from '@hierarchidb/auth-recovery';
import { resolveNetworkUrl } from './resolveNetworkUrl.js';

export async function authFetch(
  pluginType: AuthPluginType,
  input: string,
  init?: RequestInit,
): Promise<Response> {
  const auth = await AuthRecoveryService.getSingleton();
  const target = resolveNetworkUrl(input);
  return auth.fetchWithAuth(target, init, { pluginType });
}
