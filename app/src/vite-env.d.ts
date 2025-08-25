/// <reference types="vite/client" />
/// <reference types="vite-plugin-comlink/client" />

interface ImportMetaEnv {
  readonly VITE_AUTH_AUTHORITY: string;
  readonly VITE_AUTH_CLIENT_ID: string;
  readonly VITE_AUTH_REDIRECT_URI: string;
  readonly VITE_AUTH_SCOPE: string;
  readonly VITE_APP_ATTRIBUTION: string;
  readonly VITE_ENV: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}

// vite-plugin-comlink global types
declare global {
  const ComlinkWorker: new <T = any>(
    scriptURL: string | URL,
    options?: WorkerOptions
  ) => Promise<T>;
  
  namespace globalThis {
    const ComlinkWorker: new <T = any>(
      scriptURL: string | URL,
      options?: WorkerOptions
    ) => Promise<T>;
  }
}

export {};
