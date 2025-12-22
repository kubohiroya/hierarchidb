import { SingletonMixin } from '@hierarchidb/util';
import type { NodeId } from '@hierarchidb/common-types';
import type {
  LocationGroupItem,
  LocationQueryAPI,
  LocationRelation,
} from '@hierarchidb/plugin-service-api';
import { storeRegistry } from '../entity/store-registry.js';

export class LocationQueryService implements LocationQueryAPI {
  static async getSingleton(): Promise<LocationQueryService> {
    return SingletonMixin.getSingleton(LocationQueryService.name, async () => new LocationQueryService());
  }

  async listLocationGroups(nodeId: NodeId): Promise<LocationGroupItem[]> {
    const store = storeRegistry.getGroup('location');
    if (!store) return [];
    const items = await store.list(nodeId);
    return items.map((item) => ({ ...item })) as LocationGroupItem[];
  }

  async listLocationRelations(nodeId: NodeId): Promise<LocationRelation[]> {
    const store = storeRegistry.getRelations('location');
    if (!store) return [];
    const relations = await store.listByNode(nodeId);
    return relations.map((rel) => ({ ...rel })) as LocationRelation[];
  }
}
