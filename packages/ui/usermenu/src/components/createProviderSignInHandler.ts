import type { AuthProviderType } from '@hierarchidb/ui-auth';

type ProviderSignIn = (options: {
  provider: AuthProviderType;
  isUserInitiated: true;
}) => Promise<void>;

export const createProviderSignInHandler =
  (signIn: ProviderSignIn) =>
  (provider: AuthProviderType): void => {
    void signIn({ provider, isUserInitiated: true });
  };
