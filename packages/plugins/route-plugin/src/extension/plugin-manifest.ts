import { toNodeType, type PluginMetadata } from '@hierarchidb/common-type';

export const PLUGIN_ID = '@hierarchidb/plugins-route-plugin' as const;
export const PLUGIN_VERSION = '1.0.0' as const;
export const PLUGIN_DESCRIPTION = 'Route management plugin extending Shape plugin for HierarchiDB' as const;

export const PLUGIN_MANIFEST: PluginMetadata = {
  id: PLUGIN_ID,
  name: 'Route Plugin',
  displayName: 'Route',
  nodeType: toNodeType('route'),
  version: PLUGIN_VERSION,
  description: PLUGIN_DESCRIPTION,
  extends: 'shape',
  dependencies: ['shape'],
  icon: {
    mui: 'Route',
    emoji: '〰️',
    color: '#a3b030',
  },
};

export type RoutePluginManifest = typeof PLUGIN_MANIFEST;
