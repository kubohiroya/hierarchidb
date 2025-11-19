import { PluginStepRegistry } from '@hierarchidb/plugin-base';
import type { BaseMapWorkingCopy } from '../../common/types/BaseMapEntity.js';
import { getBasemapStepConfigs } from './basemapStepConfigs.js';

const registry = PluginStepRegistry.getInstance();

registry.registerConfigProvider<BaseMapWorkingCopy>({
  nodeType: 'basemap',
  getCreateStepConfigs: getBasemapStepConfigs,
  getEditStepConfigs: () => getBasemapStepConfigs(),
});
