import type { EntityHandler } from './EntityHandler';
import type { PeerStore, GroupStore, RelationStore, GroupItemBase, RelationBase } from './store';

/**
 * Store registry for plugin-provided entity stores.
 *
 * Plugins register their stores per nodeType. Handlers can look up
 * appropriate stores via this registry. This keeps table names
 * consistent (peerEntities/groupEntities/relations) while allowing
 * per-plugin Dexie DBs.
 */

class StoreRegistry {
  private peer = new Map<string, PeerStore>();
  private group = new Map<string, GroupStore<GroupItemBase>>();
  private rel = new Map<string, RelationStore<RelationBase>>();

  registerPeer(nodeType: string, store: PeerStore) {
    this.peer.set(nodeType, store);
  }
  registerGroup<T extends GroupItemBase>(nodeType: string, store: GroupStore<T>) {
    this.group.set(nodeType, store as unknown as GroupStore<GroupItemBase>);
  }
  registerRelations<T extends RelationBase>(nodeType: string, store: RelationStore<T>) {
    this.rel.set(nodeType, store as unknown as RelationStore<RelationBase>);
  }

  getPeer(nodeType: string): PeerStore | undefined {
    return this.peer.get(nodeType);
  }
  getGroup(nodeType: string): GroupStore<GroupItemBase> | undefined {
    return this.group.get(nodeType);
  }
  getRelations(nodeType: string): RelationStore<RelationBase> | undefined {
    return this.rel.get(nodeType);
  }
}

export const storeRegistry = new StoreRegistry();

