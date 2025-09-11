/// <reference types="vite/client" />
/// <reference types="vite-plugin-comlink/client" />

interface ImportMetaEnv {
  readonly VITE_AUTH_AUTHORITY: string;
  readonly VITE_AUTH_CLIENT_ID: string;
  readonly VITE_AUTH_REDIRECT_URI: string;
  readonly VITE_AUTH_SCOPE: string;
  readonly VITE_APP_ATTRIBUTION: string;
  readonly VITE_APP_HOMEPAGE: string;
  readonly VITE_ENV: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}

// vite-plugin-comlink provides its own global types.
// Avoid redeclaration here to prevent conflicts.
export {};
