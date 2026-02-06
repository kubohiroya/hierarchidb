import type { NodeId, NodeType } from './id-types.js';

export function toNodeId(id: string): NodeId {
  return id as NodeId;
}

export function toNodeType(value: string): NodeType {
  return value as NodeType;
}
