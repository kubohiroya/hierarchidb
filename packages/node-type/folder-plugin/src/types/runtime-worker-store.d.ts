declare module '@hierarchidb/runtime-worker/entity/store' {
  import type { NodeId } from '@hierarchidb/common-type';

  export interface PeerEntity<TData = unknown> {
    nodeId: NodeId;
    data?: TData;
    updatedAt?: number;
  }

  export interface PeerStore<TData = unknown> {
    get(nodeId: NodeId): Promise<PeerEntity<TData> | undefined>;
    put(entity: PeerEntity<TData>): Promise<void>;
    delete(nodeId: NodeId): Promise<void>;
    bulkUpsert?(entities: PeerEntity<TData>[]): Promise<void>;
  }

  export interface GroupItemBase<TItemData = unknown> {
    id: string;
    data?: TItemData;
    updatedAt?: number;
  }

  export interface GroupStore<TItem extends GroupItemBase = GroupItemBase> {
    list(nodeId: NodeId): Promise<TItem[]>;
    bulkUpsert(nodeId: NodeId, items: TItem[]): Promise<void>;
    bulkDelete(nodeId: NodeId, itemIds: string[]): Promise<void>;
  }

  export interface RelationBase<TRelMeta = unknown> {
    srcNodeId: NodeId;
    dstNodeId: NodeId;
    type: string;
    meta?: TRelMeta;
    updatedAt?: number;
  }

  export interface RelationStore<TRel extends RelationBase = RelationBase> {
    listByNode(nodeId: NodeId): Promise<TRel[]>;
    bulkUpsert(rels: TRel[]): Promise<void>;
    bulkDelete(rels: TRel[]): Promise<void>;
  }
}

declare module '@hierarchidb/runtime-worker/entity/store-registry' {
  export const storeRegistry: Record<string, unknown>;
}

