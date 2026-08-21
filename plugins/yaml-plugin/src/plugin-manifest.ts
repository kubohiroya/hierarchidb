import type { NodeType } from '@hierarchidb/core-types';
import type { PluginManifest } from '@hierarchidb/plugin-base';

export const YAML_PLUGIN_ID = '@hierarchidb/yaml-plugin' as const;
export const YAML_PLUGIN_VERSION = '0.1.0' as const;
export const YAML_NODE_TYPE = 'yaml-file' as NodeType;

export const PLUGIN_MANIFEST: PluginManifest = {
    id: YAML_PLUGIN_ID,
    name: 'YAML File Plugin',
    displayName: 'YAML File',
    nodeType: YAML_NODE_TYPE,
    version: YAML_PLUGIN_VERSION,
    description: 'YAML configuration file node for IDE-GSM integration',
    i18nNamespace: 'yaml-plugin',
    stepTitleKeys: {
        '1': 'basicInfo',
        '2': 'schemaSelection',
        '3': 'schemaEditor',
    },
    extends: 'folder',
    priority: 500,
    dependencies: ['folder'],
    icon: {
        mui: 'Description',
        emoji: '📄',
        color: '#4caf50',
        component: {
            specifier: '@hierarchidb/yaml-plugin/icon',
            exportName: 'YamlPluginIcon',
        },
    },
    category: {
        id: 'yaml',
        menuGroup: 'yaml',
        createOrder: 500,
    },
    capabilities: {
        canHaveChildren: false,
        canBeRoot: false,
        canBeDeleted: true,
        canBeRenamed: true,
        canBeMoved: true,
        canBeCopied: true,
    },
    schema: {
        inherits: 'folder',
        fields: [
            { name: 'name', type: 'string', required: true },
            { name: 'schemaId', type: 'string', required: true },
            { name: 'content', type: 'string', required: false },
        ],
    },
};

export type YamlPluginManifest = typeof PLUGIN_MANIFEST;
