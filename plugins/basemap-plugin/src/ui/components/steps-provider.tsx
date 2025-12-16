import { PluginStepRegistry } from '@hierarchidb/plugin-base';
import { getBasemapStepConfigs } from './basemapStepConfigs.js';
import type { BaseMapEntity } from '../../common/types/BaseMapEntity.js';

const registry = PluginStepRegistry.getInstance();

registry.registerConfigProvider<Partial<BaseMapEntity>>({
  nodeType: 'basemap',
  getCreateStepConfigs: getBasemapStepConfigs,
  getEditStepConfigs: () => getBasemapStepConfigs(),
});
