/// <reference types="vite/client" />

interface ImportMetaEnv {
  // App configuration
  readonly VITE_GITHUB_PAGES_URL: string;
  readonly VITE_APP_PREFIX: string;
  readonly VITE_APP_TITLE: string;
  readonly VITE_APP_DESCRIPTION: string;

  // Auth configuration
  readonly VITE_OIDC_AUTHORITY: string;
  readonly VITE_OIDC_CLIENT_ID: string;
  readonly VITE_OIDC_CLIENT_SECRET: string;
  readonly VITE_OIDC_SCOPE: string;
  readonly VITE_MICROSOFT_CLIENT_ID: string;
  readonly VITE_MICROSOFT_CLIENT_SECRET: string;
  readonly VITE_GITHUB_CLIENT_ID: string;
  readonly VITE_GITHUB_CLIENT_SECRET: string;
  readonly VITE_GOOGLE_CLIENT_ID: string;

  // API configuration
  readonly VITE_BFF_BASE_URL: string;
  readonly VITE_CORS_PROXY_BASE_URL: string;
  readonly VITE_API_BASE_URL: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
  readonly hot?: import('vite/types/hot').ViteHotContext;
}
