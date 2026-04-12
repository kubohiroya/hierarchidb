export interface PluginUiModuleLoader {
  has(nodeType: string): boolean;
  listNodeTypes(): string[];
  loadModule<T = unknown>(nodeType: string): Promise<T>;
}
