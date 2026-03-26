import type { NodeType } from '@hierarchidb/core-types';

/** Canonical nodeType value for YamlFileNode. */
export const YAML_NODE_TYPE = 'yaml-file' as NodeType;

/**
 * Data payload stored in a YamlFileNode.
 * - name:     file name, e.g. "scenario.yml"
 * - schemaId: JSON Schema identifier, e.g. "ide-gsm/scenario"
 * - content:  YAML text produced by the schema editor (empty string when not yet edited)
 */
export interface YamlFileNodeData {
    name: string;
    schemaId: string;
    content: string;
}
