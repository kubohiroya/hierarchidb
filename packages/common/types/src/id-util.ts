import { generateUUID } from '@hierarchidb/util';
import type { NodeId, NodeType, TreeId } from './id-types.js';

export function toNodeId(id: string): NodeId {
  return id as NodeId;
}

export function toTreeId(id: string): TreeId {
  return id as TreeId;
}

export function toNodeType(value: string): NodeType {
  return value as NodeType;
}

export function isNodeId(id: unknown): boolean {
  return typeof id === 'string';
}

export function isTreeId(id: unknown): boolean {
  return typeof id === 'string';
}

export function generateNodeId(): NodeId {
  return toNodeId(generateUUID());
}

export function generateTreeId(): TreeId {
  return toTreeId(generateUUID());
}

export function getSuperRootId(treeId: TreeId, rootId: NodeId): NodeId {
  return `${treeId}${rootId}` as NodeId;
}
