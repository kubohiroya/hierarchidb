import { toNodeType } from '@hierarchidb/common-types';
import type { PluginMetadata } from '@hierarchidb/plugin-types';

export const PLUGIN_ID = '@hierarchidb/linker-plugin' as const;
export const PLUGIN_VERSION = '0.0.1' as const;
export const PLUGIN_DESCRIPTION = 'Linker plugin for HierarchiDB: link compiled resources into maps' as const;
export const PLUGIN_NODE_TYPE = toNodeType('linker');

export const PLUGIN_MANIFEST: PluginMetadata = {
  id: PLUGIN_ID,
  name: 'Linker Plugin',
  displayName: 'Linker',
  nodeType: PLUGIN_NODE_TYPE,
  version: PLUGIN_VERSION,
  description: PLUGIN_DESCRIPTION,
  priority: 10,
  dependencies: [],
  icon: {
    mui: 'AccountTree',
    emoji: '🌲',
    color: '#ffe0f3',
    component: {
      specifier: '@hierarchidb/linker-plugin/icon',
      exportName: 'LinkerPluginIcon',
    },
  },
  category: {
    id: 'project',
    treeId: '*',
    menuGroup: 'project',
    createOrder: 10,
  },
  tags: ['linker', 'container'],
  capabilities: {
    workingCopy: true,
  },
  worker: {
    preload: ['registerLinkerWorkerStores', 'loadLinkerEntitiesDbModule'],
  },
};

export type LinkerPluginManifest = typeof PLUGIN_MANIFEST;
