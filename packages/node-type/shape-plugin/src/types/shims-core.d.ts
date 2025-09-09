// Minimal shims for @hierarchidb/core used by shape-plugin during typecheck only.
declare module '@hierarchidb/core' {
  export type NodeId = string & { readonly __brand: 'NodeId' };
  export type EntityId = NodeId;
  export type TreeNodeId = string & { readonly __brand: 'TreeNodeId' };

  export function createNodeId(): NodeId;

  export function createEntityId(): EntityId;
}
