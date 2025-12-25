import { AuthRecoveryService } from '@hierarchidb/auth-recovery';
import { resolveNetworkUrl } from '@hierarchidb/download';

export async function authFetch(input: string, init?: RequestInit): Promise<Response> {
  const auth = await AuthRecoveryService.getSingleton();
  const target = resolveNetworkUrl(input);
  return auth.fetchWithAuth(target, init, { pluginType: 'shape' });
}
