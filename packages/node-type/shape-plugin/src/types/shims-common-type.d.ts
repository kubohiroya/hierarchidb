// Minimal local declarations for @hierarchidb/common-type used during leaf-only typecheck
declare module '@hierarchidb/common-type' {
  export type NodeId = string & { readonly __brand: 'NodeId' };
  export type EntityId = NodeId;

  export interface PeerEntity {
    id: NodeId;
    nodeId: NodeId;
    createdAt: number;
    updatedAt: number;
    version: number;
  }
}
