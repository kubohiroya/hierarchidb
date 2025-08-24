import type { ReactNode } from 'react';
import { WebStorageStateStore } from 'oidc-client-ts';
import { AuthProvider, AuthProviderProps } from 'react-oidc-context';
// import { getOAuthRedirectUri, getSilentRenewUri } from "@/config/routing";
const getOAuthRedirectUri = () => `${window.location.origin}/auth/callback`;
const getSilentRenewUri = () => `${window.location.origin}/auth/silent-renew`;
// import { getSecureConfig, validateOAuthConfig } from "@/config/secureConfig";
const getSecureConfig = () => ({
  oidcAuthority: import.meta.env.VITE_OIDC_AUTHORITY || '',
  oidcClientId: import.meta.env.VITE_OIDC_CLIENT_ID || '',
  oidcScope: import.meta.env.VITE_OIDC_SCOPE || 'openid profile email',
  oidcClientSecret: import.meta.env.VITE_OIDC_CLIENT_SECRET || '',
  isProduction: import.meta.env.PROD,
  usePKCE: true,
});
const validateOAuthConfig = (_config: any) => true;

// import { devWarn, devError } from "@/shared/utils/logger";
const devWarn = (msg: string) => console.warn(msg);
const devError = (msg: string) => console.error(msg);
export const OidcProvider = ({ children }: { children: ReactNode }) => {
  const secureConfig = getSecureConfig();

  // Validate OAuth configuration
  const isValid = validateOAuthConfig(secureConfig);
  if (!isValid && secureConfig.isProduction) {
    devError('OAuth configuration is invalid. Authentication may not work properly.');
  }

  const redirect_uri = getOAuthRedirectUri();

  // Build OAuth configuration
  const config: AuthProviderProps = {
    authority: secureConfig.oidcAuthority || '',
    client_id: secureConfig.oidcClientId || '',
    // Include client_secret if PKCE is disabled or if the OAuth provider requires it
    ...(secureConfig.oidcClientSecret && !secureConfig.usePKCE
      ? { client_secret: secureConfig.oidcClientSecret }
      : {}),
    redirect_uri,
    popup_redirect_uri: redirect_uri,
    silent_redirect_uri: getSilentRenewUri(),
    response_type: 'code', // Authorization Code flow
    scope: secureConfig.oidcScope,

    // PKCE Configuration - explicitly enabled
    automaticSilentRenew: true,
    includeIdTokenInSilentRenew: true,

    // Additional settings for better OAuth handling
    filterProtocolClaims: true,
    loadUserInfo: true,

    // Use query parameters for OAuth response (required for PKCE)
    response_mode: 'query',

    // Authentication method configuration
    // Note: Google OAuth may require client_secret even with PKCE
    // If you're getting "client_secret is missing" error, you need to:
    // 1. Add VITE_OIDC_CLIENT_SECRET to your .env file
    // 2. Set VITE_DISABLE_PKCE=true
    client_authentication: undefined, // Use default client authentication

    userStore: new WebStorageStateStore({ store: window.localStorage }),
    stateStore: new WebStorageStateStore({
      store: window.localStorage,
      prefix: 'oidc.',
    }),

    // Add monitoring of storage events for debugging
    monitorSession: true,

    // Add Google OAuth metadata to ensure correct endpoints are used
    metadata: {
      issuer: secureConfig.oidcAuthority,
      authorization_endpoint: 'https://accounts.google.com/o/oauth2/v2/auth',
      token_endpoint: 'https://oauth2.googleapis.com/token',
      userinfo_endpoint: 'https://openidconnect.googleapis.com/v1/userinfo',
      end_session_endpoint: 'https://accounts.google.com/logout',
      revocation_endpoint: 'https://oauth2.googleapis.com/revoke',
    },
  };

  // Don't render AuthProvider if configuration is invalid
  if (!secureConfig.oidcAuthority || !secureConfig.oidcClientId) {
    devWarn('OAuth is not configured. Authentication features will be disabled.');
    return <>{children}</>;
  }

  return <AuthProvider {...config}>{children}</AuthProvider>;
};
