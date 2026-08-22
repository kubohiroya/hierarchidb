import { WebStorageStateStore } from 'oidc-client-ts';
import { useMemo } from 'react';
import type { AuthProviderProps } from 'react-oidc-context';

const getOAuthRedirectUri = () => `${window.location.origin}/auth/callback`;
const getSilentRenewUri = () => `${window.location.origin}/auth/silent-renew`;
const env = import.meta.env;

const getSecureConfig = () => ({
  oidcAuthority: env.VITE_OIDC_AUTHORITY ?? '',
  oidcClientId: env.VITE_OIDC_CLIENT_ID ?? '',
  oidcScope: env.VITE_OIDC_SCOPE ?? 'openid profile email',
  oidcClientSecret: env.VITE_OIDC_CLIENT_SECRET ?? '',
  isProduction: env.PROD,
  usePKCE: true,
});

const validateOAuthConfig = (_config: unknown) => true;

export const useOidcProviderView = () => {
  const secureConfig = useMemo(() => getSecureConfig(), []);

  const isValid = validateOAuthConfig(secureConfig);
  if (!isValid && secureConfig.isProduction && env.DEV) {
    console.error('OAuth configuration is invalid. Authentication may not work properly.');
  }

  const isConfigured = Boolean(secureConfig.oidcAuthority && secureConfig.oidcClientId);
  if (!isConfigured && env.DEV) {
    console.warn('OAuth is not configured. Authentication features will be disabled.');
  }

  const config = useMemo<AuthProviderProps>(() => {
    const redirectUri = getOAuthRedirectUri();
    return {
      authority: secureConfig.oidcAuthority || '',
      client_id: secureConfig.oidcClientId || '',
      ...(secureConfig.oidcClientSecret && !secureConfig.usePKCE
        ? { client_secret: secureConfig.oidcClientSecret }
        : {}),
      redirect_uri: redirectUri,
      popup_redirect_uri: redirectUri,
      silent_redirect_uri: getSilentRenewUri(),
      response_type: 'code',
      scope: secureConfig.oidcScope,
      automaticSilentRenew: true,
      includeIdTokenInSilentRenew: true,
      filterProtocolClaims: true,
      loadUserInfo: true,
      response_mode: 'query',
      client_authentication: undefined,
      userStore: new WebStorageStateStore({ store: window.localStorage }),
      stateStore: new WebStorageStateStore({
        store: window.localStorage,
        prefix: 'oidc.',
      }),
      monitorSession: true,
      metadata: {
        issuer: secureConfig.oidcAuthority,
        authorization_endpoint: 'https://accounts.google.com/o/oauth2/v2/auth',
        token_endpoint: 'https://oauth2.googleapis.com/token',
        userinfo_endpoint: 'https://openidconnect.googleapis.com/v1/userinfo',
        end_session_endpoint: 'https://accounts.google.com/logout',
        revocation_endpoint: 'https://oauth2.googleapis.com/revoke',
      },
    };
  }, [secureConfig]);

  return {
    isConfigured,
    config,
  };
};
