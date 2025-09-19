/// <reference types="vite/client" />
/// <reference types="vite-plugin-comlink/client" />

interface ImportMetaEnv {
  readonly VITE_AUTH_AUTHORITY: string;
  readonly VITE_AUTH_CLIENT_ID: string;
  readonly VITE_AUTH_REDIRECT_URI: string;
  readonly VITE_AUTH_SCOPE: string;
  readonly VITE_APP_ATTRIBUTION?: string;
  readonly VITE_APP_HOMEPAGE?: string;
  readonly VITE_ENV: string;
  readonly VITE_APP_PREFIX?: string;
  readonly VITE_APP_NAME?: string;
  readonly VITE_APP_TITLE?: string;
  readonly VITE_APP_DESCRIPTION?: string;
  readonly VITE_APP_DETAILS?: string;
  readonly VITE_APP_LOGO?: string;
  readonly VITE_APP_FAVICON?: string;
  readonly VITE_APP_THEME?: string;
  readonly VITE_APP_LOCALE?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}

// vite-plugin-comlink provides its own global types.
// Avoid redeclaration here to prevent conflicts.

declare global {
  interface Window {
    __DEV_HEALTH_OVERLAY__?: {
      position?: 'bottom-right' | 'bottom-left' | 'top-right' | 'top-left' | { x: number; y: number };
      storageKey?: string;
      draggable?: boolean;
    };
  }
}

export {};

declare module 'virtual:dev-health' {
  export const status: any;
  const _default: any;
  export default _default;
}
