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

// Virtual module for plugin definitions
declare module 'virtual:plugin-definitions' {
  import type { PluginDefinition, NodeType } from '@hierarchidb/common-type';

  export const pluginDefinitions: PluginDefinition[];
  export const pluginLoadOrder: NodeType[];
  export const pluginPackageMap: Record<string, string>;
}

export {};
