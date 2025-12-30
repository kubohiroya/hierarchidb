import type {
  FeatureItemBase,
  FeatureStore,
  RelationBase,
  RelationStore,
  VectorTileItemBase,
  VectorTileStore,
} from './store.js';

/**
 * Store registry for plugin-provided entity stores.
 *
 * Plugins register their stores per nodeType. Handlers can look up
 * appropriate stores via this registry. This keeps table names
 * consistent (features/vectorTiles/relations) while allowing
 * per-plugin Dexie DBs.
 */

class StoreRegistry {
  private features = new Map<string, FeatureStore<FeatureItemBase<unknown>>>();
  private vectorTiles = new Map<string, VectorTileStore<VectorTileItemBase>>();
  private rel = new Map<string, RelationStore<RelationBase<unknown>>>();

  registerFeatures<TItem extends FeatureItemBase<unknown>>(nodeType: string, store: FeatureStore<TItem>) {
    this.features.set(nodeType, store as FeatureStore<FeatureItemBase<unknown>>);
  }

  registerVectorTiles<TItem extends VectorTileItemBase>(nodeType: string, store: VectorTileStore<TItem>) {
    this.vectorTiles.set(nodeType, store as VectorTileStore<VectorTileItemBase>);
  }

  registerRelations<TRel extends RelationBase<unknown>>(nodeType: string, store: RelationStore<TRel>) {
    this.rel.set(nodeType, store as RelationStore<RelationBase<unknown>>);
  }

  getFeatures<TItem extends FeatureItemBase<unknown> = FeatureItemBase<unknown>>(
    nodeType: string
  ): FeatureStore<TItem> | undefined {
    return this.features.get(nodeType) as FeatureStore<TItem> | undefined;
  }

  getVectorTiles<TItem extends VectorTileItemBase = VectorTileItemBase>(
    nodeType: string
  ): VectorTileStore<TItem> | undefined {
    return this.vectorTiles.get(nodeType) as VectorTileStore<TItem> | undefined;
  }

  getRelations<TRel extends RelationBase<unknown> = RelationBase<unknown>>(
    nodeType: string
  ): RelationStore<TRel> | undefined {
    return this.rel.get(nodeType) as RelationStore<TRel> | undefined;
  }
}

export const storeRegistry = new StoreRegistry();
