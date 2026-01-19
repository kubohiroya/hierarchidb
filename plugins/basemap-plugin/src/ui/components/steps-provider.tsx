import { PluginStepRegistry } from '@hierarchidb/plugin-base';
import type { BaseMapEntity } from '../../common/types/BaseMapEntity.js';
import { getBasemapStepConfigs } from './basemapStepConfigs.js';

const registry = PluginStepRegistry.getInstance();

registry.registerConfigProvider<Partial<BaseMapEntity>>({
  nodeType: 'basemap',
  getCreateStepConfigs: getBasemapStepConfigs,
  getEditStepConfigs: () => getBasemapStepConfigs(),
});
