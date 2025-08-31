/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_APP_NAME: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}

// Virtual module for plugin definitions
declare module 'virtual:plugin-definitions' {
  import type { PluginDefinition, NodeType } from '@hierarchidb/common-type';

  export const pluginDefinitions: PluginDefinition[];
  export const pluginLoadOrder: NodeType[];
  export const pluginPackageMap: Record<string, string>;
}
