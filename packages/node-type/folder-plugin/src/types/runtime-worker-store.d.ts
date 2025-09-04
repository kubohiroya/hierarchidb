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
  import type {
    PeerStore,
    GroupStore,
    RelationStore,
    GroupItemBase,
    RelationBase,
  } from '@hierarchidb/runtime-worker/entity/store';

  export interface StoreRegistry {
    registerPeer<TData = unknown>(nodeType: string, store: PeerStore<TData>): void;
    registerGroup<TItem extends GroupItemBase<any>>(nodeType: string, store: GroupStore<TItem>): void;
    registerRelations<TRel extends RelationBase<any>>(nodeType: string, store: RelationStore<TRel>): void;

    getPeer<TData = unknown>(nodeType: string): PeerStore<TData> | undefined;
    getGroup<TItem extends GroupItemBase<any> = GroupItemBase<any>>(
      nodeType: string,
    ): GroupStore<TItem> | undefined;
    getRelations<TRel extends RelationBase<any> = RelationBase<any>>(
      nodeType: string,
    ): RelationStore<TRel> | undefined;
  }

  export const storeRegistry: StoreRegistry;
}
