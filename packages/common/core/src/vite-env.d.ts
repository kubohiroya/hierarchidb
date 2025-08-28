/// <reference types="vite/client" />
/// <reference types="vite-plugin-comlink/client" />

interface ImportMetaEnv {
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
