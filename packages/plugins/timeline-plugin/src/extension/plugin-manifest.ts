import { toNodeType, type PluginMetadata } from '@hierarchidb/common-type';

export const PLUGIN_ID = '@hierarchidb/plugins-timeline-plugin' as const;
export const PLUGIN_VERSION = '0.0.1' as const;
export const PLUGIN_DESCRIPTION = 'Timeline plugin scaffold for HierarchiDB (new design)' as const;

export const PLUGIN_MANIFEST: PluginMetadata = {
  id: PLUGIN_ID,
  name: 'Timeline Plugin',
  displayName: 'Timeline',
  nodeType: toNodeType('timeline'),
  version: PLUGIN_VERSION,
  description: PLUGIN_DESCRIPTION,
  icon: {
    mui: 'Timeline',
    emoji: '🕒',
    color: '#8a7cbf',
  },
};

export type TimelinePluginManifest = typeof PLUGIN_MANIFEST;
