import { toNodeType } from '@hierarchidb/core-types';
import type { PluginManifest } from '@hierarchidb/plugin-base';

export const PLUGIN_ID = '@hierarchidb/linker-plugin' as const;
export const PLUGIN_VERSION = '0.0.1' as const;
export const PLUGIN_DESCRIPTION =
  'Linker plugin for HierarchiDB: link compiled resources into maps' as const;
export const PLUGIN_NODE_TYPE = toNodeType('linker');

export const PLUGIN_MANIFEST: PluginManifest = {
  id: PLUGIN_ID,
  name: 'Linker Plugin',
  displayName: 'Linker',
  nodeType: PLUGIN_NODE_TYPE,
  version: PLUGIN_VERSION,
  description: PLUGIN_DESCRIPTION,
  i18nNamespace: 'linker-plugin',
  stepTitleKeys: {
    '1': 'basicInfo',
    '2': 'resources',
    '3': 'aggregated',
    '4': 'preview',
  },
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
    draft: true,
  },
  worker: {
    preload: ['registerLinkerWorkerStores', 'loadLinkerEntitiesDbModule'],
  },
};

export type LinkerPluginManifest = typeof PLUGIN_MANIFEST;
