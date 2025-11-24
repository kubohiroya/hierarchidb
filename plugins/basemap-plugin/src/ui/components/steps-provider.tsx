import { PluginStepRegistry } from '@hierarchidb/plugin-base';
import { getBasemapStepConfigs, type BasemapStepData } from './basemapStepConfigs.js';

const registry = PluginStepRegistry.getInstance();

registry.registerConfigProvider<BasemapStepData>({
  nodeType: 'basemap',
  getCreateStepConfigs: getBasemapStepConfigs,
  getEditStepConfigs: () => getBasemapStepConfigs(),
});
