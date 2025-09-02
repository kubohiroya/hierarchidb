// Lightweight helper to make a FetchNetworkPort that pulls headers from a provider
import { FetchNetworkPort } from '../adapters/FetchNetworkPort';

export interface AuthHeadersProviderLike {
  getAuthHeaders(): Record<string, string>;
}

export function createAuthAwareNetworkPort(provider: AuthHeadersProviderLike, opts?: { perHostConcurrency?: number; retries?: number }): FetchNetworkPort {
  return new FetchNetworkPort({
    headers: () => provider.getAuthHeaders(),
    perHostConcurrency: opts?.perHostConcurrency,
    retries: opts?.retries,
  });
}

