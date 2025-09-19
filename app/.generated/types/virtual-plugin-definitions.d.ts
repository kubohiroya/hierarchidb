declare module 'virtual:plugin-definitions' {
  export interface PluginDefinition {
    name: string;
    version: string;
    packageName: string;
    nodeType: string;
    priority: number;
    plugin?: any;
    config?: any;
  }

  export const pluginDefinitions: PluginDefinition[];
  export default pluginDefinitions;
}
