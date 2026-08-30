import type { NodeType } from '@hierarchidb/core-types';
import type { PluginManifest } from '@hierarchidb/plugin-base';

const IDEGSM_PROJECT_PLUGIN_ID = '@hierarchidb/idegsm-project-plugin' as const;
const IDEGSM_PROJECT_PLUGIN_VERSION = '0.1.0' as const;
const IDEGSM_PROJECT_PLUGIN_NODE_TYPE = 'idegsm-project' as NodeType;
const IDEGSM_PROJECT_PLUGIN_FEATURE_FLAG_DEFAULT = false as const;

export const PLUGIN_MANIFEST: PluginManifest = {
  id: IDEGSM_PROJECT_PLUGIN_ID,
  name: 'IDE-GSM Project Plugin',
  displayName: 'IDE-GSM Project',
  nodeType: IDEGSM_PROJECT_PLUGIN_NODE_TYPE,
  version: IDEGSM_PROJECT_PLUGIN_VERSION,
  description: 'Synchronized IDE-GSM project root node',
  i18nNamespace: 'idegsm-project-plugin',
  stepTitleKeys: {
    '1': 'basicInfo',
    '2': 'connection',
    '3': 'projectPath',
  },
  extends: 'folder',
  priority: 520,
  dependencies: ['folder'],
  icon: {
    mui: 'AccountTree',
    color: '#2f7d77',
    component: {
      specifier: '@hierarchidb/idegsm-project-plugin/icon',
      exportName: 'IdeGsmProjectPluginIcon',
    },
  },
  category: {
    id: 'ide-gsm',
    menuGroup: 'ide-gsm',
    createOrder: 520,
  },
  visibility: {
    showInCreateMenu: IDEGSM_PROJECT_PLUGIN_FEATURE_FLAG_DEFAULT,
    showInPluginList: IDEGSM_PROJECT_PLUGIN_FEATURE_FLAG_DEFAULT,
  },
  capabilities: {
    canHaveChildren: true,
    canBeRoot: false,
    canBeDeleted: true,
    canBeRenamed: true,
    canBeMoved: true,
    canBeCopied: false,
  },
  schema: {
    inherits: 'folder',
    fields: [
      { name: 'version', type: 'number', required: true },
      { name: 'connectionName', type: 'string', required: true },
      { name: 'projectRelativePath', type: 'string', required: true },
      { name: 'activeSyncGenerationId', type: 'string|null', required: true },
      { name: 'syncState', type: 'string', required: true },
      { name: 'syncedAt', type: 'string|null', required: true },
    ],
  },
};

export type IdeGsmProjectPluginManifest = typeof PLUGIN_MANIFEST;
