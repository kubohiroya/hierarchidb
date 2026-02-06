import type { NodeType } from '@hierarchidb/core-types';

/**
 * Taggable capability registry
 * - Keeps a minimal, runtime-worker registry of node types that opted into tagging.
 * - Other packages can query via `isTaggable(nodeType)` to toggle UI/commands.
 */
const taggableSet = new Set<NodeType>();

export type TaggableCapability = {
  capability: 'taggable';
  nodeType: NodeType;
};

export function registerTaggable(nodeType: NodeType): void {
  taggableSet.add(nodeType);
}

export function unregisterTaggable(nodeType: NodeType): void {
  taggableSet.delete(nodeType);
}

export function isTaggable(nodeType: NodeType): boolean {
  return taggableSet.has(nodeType);
}

export function listTaggable(): NodeType[] {
  return Array.from(taggableSet.values());
}
