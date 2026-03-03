import { PluginStepRegistry } from '@hierarchidb/plugin-base';
import type { BaseMapEntity } from '~/common/types/BaseMapEntity';
import { getBasemapStepConfigs } from './getBasemapStepConfigs.js';

const registry = PluginStepRegistry.getInstance();

registry.registerConfigProvider<Partial<BaseMapEntity>>({
  nodeType: 'basemap',
  getCreateStepConfigs: getBasemapStepConfigs,
  getEditStepConfigs: () => getBasemapStepConfigs(),
});
