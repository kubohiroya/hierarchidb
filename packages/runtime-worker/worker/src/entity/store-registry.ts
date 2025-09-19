import type { GroupItemBase, GroupStore, PeerStore, RelationBase, RelationStore } from './store.js';

/**
 * Store registry for plugin-provided entity stores.
 *
 * Plugins register their stores per nodeType. Handlers can look up
 * appropriate stores via this registry. This keeps table names
 * consistent (peerEntities/groupEntities/relations) while allowing
 * per-plugin Dexie DBs.
 */

class StoreRegistry {
  private peer = new Map<string, PeerStore<any>>();
  private group = new Map<string, GroupStore<GroupItemBase<any>>>();
  private rel = new Map<string, RelationStore<RelationBase<any>>>();

  registerPeer<TData = unknown>(nodeType: string, store: PeerStore<TData>) {
    this.peer.set(nodeType, store as PeerStore<any>);
  }

  registerGroup<TItem extends GroupItemBase<any>>(nodeType: string, store: GroupStore<TItem>) {
    this.group.set(nodeType, store as unknown as GroupStore<GroupItemBase<any>>);
  }

  registerRelations<TRel extends RelationBase<any>>(nodeType: string, store: RelationStore<TRel>) {
    this.rel.set(nodeType, store as unknown as RelationStore<RelationBase<any>>);
  }

  getPeer<TData = unknown>(nodeType: string): PeerStore<TData> | undefined {
    return this.peer.get(nodeType) as PeerStore<TData> | undefined;
  }

  getGroup<TItem extends GroupItemBase<any> = GroupItemBase<any>>(nodeType: string): GroupStore<TItem> | undefined {
    return this.group.get(nodeType) as unknown as GroupStore<TItem> | undefined;
  }

  getRelations<TRel extends RelationBase<any> = RelationBase<any>>(nodeType: string): RelationStore<TRel> | undefined {
    return this.rel.get(nodeType) as unknown as RelationStore<TRel> | undefined;
  }
}

export const storeRegistry = new StoreRegistry();
