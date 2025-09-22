export type LoadAppConfigReturn = {
  appPrefix: string;
  appName: string;
  appTitle: string;
  appDescription: string;
  appDetails: string;
  appHomepage: string;
  appLogo: string;
  appFavicon: string;
  appTheme: string;
  appLocale: string;
  appDefaultLocale: string;
  appDefaultLanguage: string;
  appAttribution: string;
};

const ABSOLUTE_HREF_REGEX = /^(?:[a-z][a-z0-9+.-]*:|\/)/i;

const normalizePrefix = (raw?: string | null): string => {
  const base = raw?.trim();
  if (!base || base === '.') {
    return '/';
  }

  let prefix = base;
  if (!prefix.startsWith('/')) {
    prefix = `/${prefix}`;
  }
  if (!prefix.endsWith('/')) {
    prefix = `${prefix}/`;
  }
  // collapse repeated slashes (except protocol)
  return prefix.replace(/\/+/g, '/');
};

const normalizeFavicon = (raw?: string | null): string => {
  const asset = raw?.trim();
  if (!asset) {
    return 'favicon.svg';
  }
  return asset;
};

export function resolveAssetHref(prefix: string, asset: string): string {
  if (!asset) return prefix;
  if (asset.startsWith('data:') || ABSOLUTE_HREF_REGEX.test(asset)) {
    return asset;
  }

  const normalizedPrefix = normalizePrefix(prefix);
  const normalizedAsset = asset.startsWith('/') ? asset.slice(1) : asset;
  return `${normalizedPrefix}${normalizedAsset}`;
}

export function loadAppConfig(): LoadAppConfigReturn {
  const {
    VITE_APP_PREFIX,
    VITE_APP_NAME,
    VITE_APP_TITLE,
    VITE_APP_DESCRIPTION,
    VITE_APP_HOMEPAGE,
    VITE_APP_LOGO,
    VITE_APP_FAVICON,
    VITE_APP_THEME,
    VITE_APP_LOCALE,
    VITE_APP_ATTRIBUTION,
    VITE_APP_DETAILS,
  } = import.meta.env;

  const normalizedPrefix = normalizePrefix(VITE_APP_PREFIX ?? import.meta.env.BASE_URL ?? '/');
  const faviconAsset = normalizeFavicon(VITE_APP_FAVICON);

  return {
    appPrefix: normalizedPrefix,
    appName: VITE_APP_NAME || 'HierarchiDB',
    appTitle: VITE_APP_TITLE || 'HierarchiDB',
    appDescription:
      VITE_APP_DESCRIPTION ||
      'High-performance tree-structured data management framework for browser environments',
    appDetails:
      VITE_APP_DETAILS ||
      'A powerful framework for managing hierarchical data in browser environments',
    appHomepage: VITE_APP_HOMEPAGE || 'https://github.com/kubohiroya/hierarchidb',
    appLogo: VITE_APP_LOGO || 'logo.png',
    appFavicon: faviconAsset,
    appTheme: VITE_APP_THEME || 'light',
    appLocale: VITE_APP_LOCALE || 'en-US',
    appAttribution: VITE_APP_ATTRIBUTION || '',
    appDefaultLocale: 'en-US',
    appDefaultLanguage: 'en',
  };
}
