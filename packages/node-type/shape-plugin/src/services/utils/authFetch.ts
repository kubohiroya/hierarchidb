import { AuthRecoveryService } from '@hierarchidb/auth-recovery';

export async function authFetch(input: string, init?: RequestInit): Promise<Response> {
  const auth = await AuthRecoveryService.getSingleton();
  return auth.fetchWithAuth(input, init, { pluginType: 'shape' });
}

