/**
 * runtime-worker は plugin-registry には依存しない（turbo の依存グラフ循環を避けるため）。
 * 実際の registry / loaders は UI 側が保持し、必要なら Comlink 越しに注入する。
 */
export type PluginRegistryEntry = {
  nodeType: string;
  manifest?: {
    displayName?: string;
    name?: string;
  } | null;
};

export const pluginRegistry: PluginRegistryEntry[] = [];

export const pluginWorkerModuleMap: Record<string, string> = {};
export const pluginWorkerSourceMap: Record<string, string | undefined> = {};
export const pluginWorkerLoaders: Record<string, () => Promise<unknown>> = {};
