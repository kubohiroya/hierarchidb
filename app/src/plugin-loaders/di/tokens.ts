export const UIPluginRegistryTokens = {
  PluginDefinitions: Symbol.for('app.pluginRegistry.PluginDefinitions'),
  PluginRegistry: Symbol.for('app.pluginRegistry.PluginRegistry'),
  PluginUiModuleMap: Symbol.for('app.pluginRegistry.PluginUiModuleMap'),
  PluginUiLoaders: Symbol.for('app.pluginRegistry.PluginUiLoaders'),
  PluginUiModuleLoader: Symbol.for('app.pluginRegistry.PluginUiModuleLoader'),
} as const;

export type UIPluginRegistryTokenKeys = keyof typeof UIPluginRegistryTokens;
