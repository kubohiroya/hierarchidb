import type { NodeType } from '@hierarchidb/common-types';
import type { PluginMetadata } from '@hierarchidb/plugin-types';

export const PLUGIN_ID = '@hierarchidb/folder-plugin' as const;
export const PLUGIN_VERSION = '1.0.0' as const;
export const PLUGIN_DESCRIPTION = 'Basic folder plugin for HierarchiDB UI layer' as const;
export const PLUGIN_NODE_TYPE = 'folder' as NodeType;

export const PLUGIN_MANIFEST: PluginMetadata = {
  id: PLUGIN_ID,
  name: 'Folder Plugin',
  displayName: 'Folder',
  nodeType: PLUGIN_NODE_TYPE,
  version: PLUGIN_VERSION,
  description: PLUGIN_DESCRIPTION,
  priority: 1000,
  dependencies: [],
  icon: {
    mui: 'Folder',
    emoji: '📁',
    color: '#c0eeff',
  },
  category: 'core',
  capabilities: {
    canHaveChildren: true,
    canBeRoot: true,
    canBeDeleted: true,
    canBeRenamed: true,
    canBeMoved: true,
    canBeCopied: true,
  },
  schema: {
    fields: [
      {
        name: 'name',
        type: 'string',
        required: true,
      },
      {
        name: 'description',
        type: 'string',
        required: false,
      },
    ],
  },
};

export type FolderPluginManifest = typeof PLUGIN_MANIFEST;
