import { SingletonMixin } from '@hierarchidb/util';
import type { NodeId } from '@hierarchidb/common-types';
import type {
  LocationGroupItem,
  LocationMutationAPI,
  LocationRelation,
} from '@hierarchidb/plugin-service-api';
import { storeRegistry } from '../entity/store-registry.js';

export class LocationMutationService implements LocationMutationAPI {
  static async getSingleton(): Promise<LocationMutationService> {
    return SingletonMixin.getSingleton('LocationMutationService', async () => new LocationMutationService());
  }

  async upsertLocationGroups(nodeId: NodeId, items: LocationGroupItem[]): Promise<void> {
    const store = storeRegistry.getGroup<LocationGroupItem>('location');
    if (!store) return;
    await store.bulkUpsert(nodeId, items);
  }

  async deleteLocationGroups(nodeId: NodeId, itemIds: string[]): Promise<void> {
    const store = storeRegistry.getGroup<LocationGroupItem>('location');
    if (!store) return;
    await store.bulkDelete(nodeId, itemIds);
  }

  async upsertLocationRelations(relations: LocationRelation[]): Promise<void> {
    const store = storeRegistry.getRelations<LocationRelation>('location');
    if (!store) return;
    await store.bulkUpsert(relations);
  }

  async deleteLocationRelations(relations: LocationRelation[]): Promise<void> {
    const store = storeRegistry.getRelations<LocationRelation>('location');
    if (!store) return;
    await store.bulkDelete(relations);
  }

  async clearLocationEntities(nodeId: NodeId): Promise<void> {
    const groupStore = storeRegistry.getGroup<LocationGroupItem>('location');
    if (groupStore) {
      const items = await groupStore.list(nodeId);
      if (items.length > 0) {
        await groupStore.bulkDelete(nodeId, items.map((item) => item.id));
      }
    }
    const relStore = storeRegistry.getRelations<LocationRelation>('location');
    if (relStore) {
      const rels = await relStore.listByNode(nodeId);
      if (rels.length > 0) {
        await relStore.bulkDelete(rels);
      }
    }
  }
}
