// Minimal local declarations for @hierarchidb/common-type used during leaf-only typecheck
declare module '@hierarchidb/common-type' {
  export type NodeId = string & { readonly __brand: 'NodeId' };
  export type EntityId = string & { readonly __brand: 'EntityId' };
  export interface PeerEntity {
    id: EntityId;
    nodeId: NodeId;
    createdAt: number;
    updatedAt: number;
    version: number;
  }
}

