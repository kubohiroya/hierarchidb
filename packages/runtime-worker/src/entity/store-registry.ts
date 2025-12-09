import type { GroupItemBase, GroupStore, RelationBase, RelationStore } from './store.js';

/**
 * Store registry for plugin-provided entity stores.
 *
 * Plugins register their stores per nodeType. Handlers can look up
 * appropriate stores via this registry. This keeps table names
 * consistent (peerEntities/groupEntities/relations) while allowing
 * per-plugin Dexie DBs.
 */

class StoreRegistry {
  private group = new Map<string, GroupStore<GroupItemBase<unknown>>>();
  private rel = new Map<string, RelationStore<RelationBase<unknown>>>();

  registerGroup<TItem extends GroupItemBase<unknown>>(nodeType: string, store: GroupStore<TItem>) {
    this.group.set(nodeType, store as GroupStore<GroupItemBase<unknown>>);
  }

  registerRelations<TRel extends RelationBase<unknown>>(
    nodeType: string,
    store: RelationStore<TRel>
  ) {
    this.rel.set(nodeType, store as RelationStore<RelationBase<unknown>>);
  }

  getGroup<TItem extends GroupItemBase<unknown> = GroupItemBase<unknown>>(
    nodeType: string
  ): GroupStore<TItem> | undefined {
    return this.group.get(nodeType) as GroupStore<TItem> | undefined;
  }

  getRelations<TRel extends RelationBase<unknown> = RelationBase<unknown>>(
    nodeType: string
  ): RelationStore<TRel> | undefined {
    return this.rel.get(nodeType) as RelationStore<TRel> | undefined;
  }
}

export const storeRegistry = new StoreRegistry();
