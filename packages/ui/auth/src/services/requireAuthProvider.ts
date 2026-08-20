import type { AuthProviderType } from '~/types/AuthProviderType';

export const requireAuthProvider = (provider: unknown): AuthProviderType => {
  if (provider === 'google' || provider === 'microsoft' || provider === 'github') {
    return provider;
  }
  throw new Error('OAuth provider is required');
};
