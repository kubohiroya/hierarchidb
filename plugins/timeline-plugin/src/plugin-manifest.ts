import type { NodeType } from '@hierarchidb/common-types';
import type { PluginManifest } from '@hierarchidb/plugin-service-api';

export const PLUGIN_ID = '@hierarchidb/timeline-plugin' as const;
export const PLUGIN_VERSION = '0.0.1' as const;
export const PLUGIN_DESCRIPTION = 'Timeline plugin scaffold for HierarchiDB (new design)' as const;
export const PLUGIN_NODE_TYPE = 'timeline' as NodeType;

export const PLUGIN_MANIFEST: PluginManifest = {
  id: PLUGIN_ID,
  name: 'Timeline Plugin',
  displayName: 'Timeline',
  nodeType: PLUGIN_NODE_TYPE,
  version: PLUGIN_VERSION,
  description: PLUGIN_DESCRIPTION,
  icon: {
    mui: 'AccessTime',
    muiIconName: 'AccessTime',
    emoji: '🕒',
    color: '#8a7cbf',
    component: {
      specifier: '@hierarchidb/timeline-plugin/icon',
      exportName: 'TimelinePluginIcon',
    },
  },
  category: {
    id: 'project',
    menuGroup: 'project',
    createOrder: 20,
  },
  worker: {
    preload: ['registerTimelineWorkerStores', 'loadTimelineEntitiesDbModule'],
  },
};

export type TimelinePluginManifest = typeof PLUGIN_MANIFEST;
