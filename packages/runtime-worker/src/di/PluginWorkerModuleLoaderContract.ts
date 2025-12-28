export interface PluginWorkerModuleLoaderContract {
  has(nodeType: string): boolean;
  listNodeTypes(): string[];
  importModule<T = unknown>(nodeType: string): Promise<T>;
}
