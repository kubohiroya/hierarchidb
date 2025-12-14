import { PluginStepRegistry } from '@hierarchidb/plugin-base';

const registry = PluginStepRegistry.getInstance();

registry.registerConfigProvider({
  nodeType: 'folder',
  getCreateStepConfigs() {
    return [];
  },
  getEditStepConfigs() {
    return this.getCreateStepConfigs();
  },
});
