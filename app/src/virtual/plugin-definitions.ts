// Fallback virtual module for production build when the package-reader
// plugin is not active (e.g., in react-router build worker context).
export interface VMPluginDefinition {
  name: string;
  version: string;
  packageName: string;
  nodeType: string;
  priority: number;
  plugin?: unknown;
  config?: unknown;
}

const pluginDefinitions: VMPluginDefinition[] = [];
export default pluginDefinitions;

