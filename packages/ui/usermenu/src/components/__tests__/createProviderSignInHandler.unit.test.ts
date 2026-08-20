import { describe, expect, it, vi } from 'vitest';
import { createProviderSignInHandler } from '../createProviderSignInHandler.js';

describe('createProviderSignInHandler', () => {
  it.each(['google', 'github'] as const)(
    'passes the selected %s provider to the authentication flow',
    (provider) => {
      const signIn = vi.fn(async () => undefined);
      const signInWithProvider = createProviderSignInHandler(signIn);

      signInWithProvider(provider);

      expect(signIn).toHaveBeenCalledWith({ provider, isUserInitiated: true });
    }
  );
});
