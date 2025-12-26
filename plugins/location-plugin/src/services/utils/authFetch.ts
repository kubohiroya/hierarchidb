import { authFetch as sharedAuthFetch } from '@hierarchidb/download';

export async function authFetch(input: string, init?: RequestInit): Promise<Response> {
  return sharedAuthFetch('location', input, init);
}
