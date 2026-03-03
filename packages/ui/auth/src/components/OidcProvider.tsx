import type { ReactNode } from 'react';
import { AuthProvider } from 'react-oidc-context';
import { useOidcProviderView } from './useOidcProviderView.js';

export const OidcProvider = ({ children }: { children: ReactNode }) => {
  const { isConfigured, config } = useOidcProviderView();

  if (!isConfigured) {
    return <>{children}</>;
  }

  return <AuthProvider {...config}>{children}</AuthProvider>;
};
