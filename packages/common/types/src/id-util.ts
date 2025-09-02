import { EntityId, NodeId, TreeId, NodeType } from './id-types';

// Helper functions to create branded types
export function toNodeId(id: string): NodeId {
  return id as NodeId;
}
export function toEntityId(id: string): EntityId {
  return id as EntityId;
}
export function toTreeId(id: string): TreeId {
  return id as TreeId;
}

export function toNodeType(value: string): NodeType {
  return value as NodeType;
}

// Type guards
export function isNodeId(id: unknown): boolean {
  return typeof id === 'string';
}

export function isEntityId(id: unknown): boolean {
  return typeof id === 'string';
}

export function isTreeId(id: unknown): boolean {
  return typeof id === 'string';
}

export function generateNodeId(): NodeId {
  return toNodeId(crypto.randomUUID());
}

export function generateEntityId(): EntityId {
  return toEntityId(crypto.randomUUID());
}

export function generateTreeId(): TreeId {
  return toTreeId(crypto.randomUUID());
}

export function getSuperRootId(treeId: TreeId, rootId: NodeId): NodeId {
  return `${treeId}${rootId}` as NodeId;
}
