declare module '@hierarchidb/runtime-worker/entity/store-registry' {
  import type { NodeId, PeerEntity } from '@hierarchidb/common-type';

  // Shape plugin specific store contracts (minimal, explicit)
  export interface ShapePeerStore<TData> {
    get(nodeId: NodeId): Promise<PeerEntity<TData> | undefined>;
    put(entity: PeerEntity<TData>): Promise<void>;
    delete(nodeId: NodeId): Promise<void>;
    bulkUpsert(entities: PeerEntity<TData>[]): Promise<void>;
  }

  export interface ShapeGroupItem { id: string; updatedAt?: number }
  export interface ShapeGroupStore<TItem extends ShapeGroupItem> {
    list(nodeId: NodeId): Promise<TItem[]>;
    bulkUpsert(nodeId: NodeId, items: TItem[]): Promise<void>;
    bulkDelete(nodeId: NodeId, itemIds: string[]): Promise<void>;
  }

  export interface ShapeRelation { srcNodeId: NodeId; dstNodeId: NodeId; type: string; updatedAt?: number }
  export interface ShapeRelationStore<TRelation extends ShapeRelation> {
    listByNode(nodeId: NodeId): Promise<TRelion[]>;
    bulkUpsert(rels: TRelation[]): Promise<void>;
    bulkDelete(rels: TRelation[]): Promise<void>;
  }

  export interface StoreRegistryForShape {
    getPeer(key: 'shape'): ShapePeerStore<unknown> | undefined;
    registerPeer(key: 'shape', store: ShapePeerStore<unknown>): void;
    getGroup(key: 'shape'): ShapeGroupStore<ShapeGroupItem> | undefined;
    registerGroup(key: 'shape', store: ShapeGroupStore<ShapeGroupItem>): void;
    getRelations(key: 'shape'): ShapeRelationStore<ShapeRelation> | undefined;
    registerRelations(key: 'shape', store: ShapeRelationStore<ShapeRelation>): void;
  }

  export const storeRegistry: StoreRegistryForShape;
}
