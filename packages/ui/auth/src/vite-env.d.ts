/// <reference types="vite/client" />
/// <reference types="@hierarchidb/core/src/types/vite-env" />

// Auth-specific environment variables
interface ImportMetaEnv {
  readonly VITE_OIDC_AUTHORITY: string;
  readonly VITE_OIDC_CLIENT_ID: string;
  readonly VITE_OIDC_CLIENT_SECRET: string;
  readonly VITE_OIDC_SCOPE: string;
  readonly VITE_MICROSOFT_CLIENT_ID: string;
  readonly VITE_MICROSOFT_CLIENT_SECRET: string;
  readonly VITE_GITHUB_CLIENT_ID: string;
  readonly VITE_GITHUB_CLIENT_SECRET: string;
  readonly VITE_GOOGLE_CLIENT_ID: string;
  readonly VITE_BFF_BASE_URL: string;
  readonly VITE_CORS_PROXY_BASE_URL: string;
  readonly VITE_APP_PREFIX: string;
}
