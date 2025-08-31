import type { NodeType } from '@hierarchidb/common-type';

import { NodeTypeConfig } from '~/registry/nodeTypeConfig';

/**
 * Registry for managing node type configurations
 */
export type INodeTypeRegistry = {
  registerNodeType(nodeType: NodeType, config: NodeTypeConfig): void;
  unregisterNodeType(nodeType: NodeType): void;
  isRegistered(nodeType: NodeType): boolean;
  getNodeTypeConfig(nodeType: NodeType): NodeTypeConfig | undefined;
  getAllNodeTypes(): NodeType[];
  canAddChild(parentType: NodeType, childType: NodeType): boolean;
  getDefaultIcon(nodeType: NodeType): string;
};
