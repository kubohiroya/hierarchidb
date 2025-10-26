export interface PluginWorkerModuleLoader {
  has(nodeType: string): boolean;
  listNodeTypes(): string[];
  importModule<T = unknown>(nodeType: string): Promise<T>;
}
