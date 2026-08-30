import type { NodeType } from '@hierarchidb/core-types';
import type { PluginManifest } from '@hierarchidb/plugin-base';

const FDM_PLUGIN_ID = '@hierarchidb/fdm-plugin' as const;
const FDM_PLUGIN_VERSION = '0.1.0' as const;
const FDM_PLUGIN_NODE_TYPE = 'fdm' as NodeType;
const FDM_PLUGIN_FEATURE_FLAG_DEFAULT = true as const;

export const PLUGIN_MANIFEST: PluginManifest = {
  id: FDM_PLUGIN_ID,
  name: 'FDM Plugin',
  displayName: 'FDM',
  nodeType: FDM_PLUGIN_NODE_TYPE,
  version: FDM_PLUGIN_VERSION,
  description: 'FDM dashboard and visualization node',
  i18nNamespace: 'fdm-plugin',
  stepTitleKeys: {
    '1': 'basicInfo',
    '2': 'connection',
  },
  extends: 'folder',
  priority: 530,
  dependencies: ['folder'],
  icon: {
    mui: 'ViewInArOutlined',
    color: '#4f6f52',
    component: {
      specifier: '@hierarchidb/fdm-plugin/icon',
      exportName: 'FdmPluginIcon',
    },
  },
  category: {
    id: 'ide-gsm',
    menuGroup: 'ide-gsm',
    createOrder: 530,
  },
  visibility: {
    showInCreateMenu: FDM_PLUGIN_FEATURE_FLAG_DEFAULT,
    showInPluginList: FDM_PLUGIN_FEATURE_FLAG_DEFAULT,
  },
  capabilities: {
    canHaveChildren: false,
    canBeRoot: false,
    canBeDeleted: true,
    canBeRenamed: true,
    canBeMoved: true,
    canBeCopied: true,
    visualization: true,
  },
  schema: {
    inherits: 'folder',
    fields: [
      { name: 'version', type: 'number', required: true },
      { name: 'connectionName', type: 'string', required: true },
      { name: 'spaceId', type: 'string', required: true },
      { name: 'idegsmProjectNodeId', type: 'string', required: false },
      { name: 'selectedStateDir', type: 'string', required: false },
      { name: 'viewMode', type: 'string', required: true },
      { name: 'filters', type: 'object', required: true },
      { name: 'axisMap', type: 'object', required: true },
      { name: 'tabularSnapshotRefs', type: 'array', required: true },
    ],
  },
};

export type FdmPluginManifest = typeof PLUGIN_MANIFEST;
