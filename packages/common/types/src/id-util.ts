import type { NodeId, NodeType, TreeId } from './id-types.js';

function generateUUID(): string {
  const maybeCrypto = (globalThis as { crypto?: { randomUUID?: () => string } }).crypto;
  if (maybeCrypto && typeof maybeCrypto.randomUUID === 'function') {
    return maybeCrypto.randomUUID();
  }
  return `uuid-${Math.random().toString(36).slice(2, 10)}-${Date.now().toString(36)}`;
}

// Helper functions to create branded types
export function toNodeId(id: string): NodeId {
  return id as NodeId;
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
