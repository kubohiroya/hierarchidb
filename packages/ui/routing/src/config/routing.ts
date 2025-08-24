export const ROUTES = {
  home: '/',
  login: '/login',
  logout: '/logout',
  callback: '/callback',
  silentRenew: '/silent-renew',
} as const;

export const getCallbackUrl = () => {
  return `${window.location.origin}${ROUTES.callback}`;
};

export const getSilentRenewUrl = () => {
  return `${window.location.origin}${ROUTES.silentRenew}`;
};

export const getSilentRenewUri = getSilentRenewUrl;

export const getOAuthRedirectUri = getCallbackUrl;

export const getLogoutRedirectUrl = () => {
  return `${window.location.origin}${ROUTES.home}`;
};

export const isGitHubPages = window.location.hostname.includes('github.io');
