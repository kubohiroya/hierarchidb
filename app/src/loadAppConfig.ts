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

export function loadAppConfig(): LoadAppConfigReturn {
  const {
    VITE_APP_PREFIX,
    VITE_APP_NAME,
    VITE_APP_TITLE,
    VITE_APP_DESCRIPTION,
    APP_HOMEPAGE,
    VITE_APP_LOGO,
    VITE_APP_FAVICON,
    VITE_APP_THEME,
    VITE_APP_LOCALE,
    VITE_APP_ATTRIBUTION,
    VITE_APP_DETAILS,
  } = import.meta.env;

  return {
    appPrefix: VITE_APP_PREFIX || '',
    appName: VITE_APP_NAME || 'HierarchiDB',
    appTitle: VITE_APP_TITLE || 'HierarchiDB',
    appDescription:
      VITE_APP_DESCRIPTION ||
      'High-performance tree-structured data management framework for browser environments',
    appDetails:
      VITE_APP_DETAILS ||
      'A powerful framework for managing hierarchical data in browser environments',
    appHomepage: APP_HOMEPAGE || 'https://github.com/kubohiroya/hierarchidb',
    appLogo: VITE_APP_LOGO || 'logo.png',
    appFavicon: VITE_APP_FAVICON || 'logo.favicon.png',
    appTheme: VITE_APP_THEME || 'light',
    appLocale: VITE_APP_LOCALE || 'en-US',
    appAttribution: VITE_APP_ATTRIBUTION || '',
    appDefaultLocale: 'en-US',
    appDefaultLanguage: 'en',
  };
}
