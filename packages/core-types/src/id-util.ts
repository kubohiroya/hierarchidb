import type { NodeId, NodeType, TagId } from './id-types.js';

export function toNodeId(id: string): NodeId {
  return id as NodeId;
}

export function toNodeType(value: string): NodeType {
  return value as NodeType;
}

export function toTagId(id: string): TagId {
  return id as TagId;
}
