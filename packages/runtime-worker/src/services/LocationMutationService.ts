import { SingletonMixin } from '@hierarchidb/util';
import type { NodeId } from '@hierarchidb/common-types';
import {
  IDE_GSM_BULK_CHUNK_SIZE,
  type IdeGsmImportCallback,
  type IdeGsmImportProgress,
  type IdeGsmLocationImportRequest,
  type IdeGsmLocationImportResult,
  type LocationGroupItem,
  type LocationRelation,
} from '@hierarchidb/plugin-service-api';
import type { LocationMutationAPI } from '@hierarchidb/location-store';
import { authFetch } from '@hierarchidb/download';
import { getEphemeralLocationDB } from '@hierarchidb/location-store';
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

  async clearLocationArtifacts(nodeId: NodeId): Promise<void> {
    await this.clearLocationEntities(nodeId);
    const db = getEphemeralLocationDB();
    await db.clearNodeData(nodeId);
  }

  async importIdeGsmLocations(
    request: IdeGsmLocationImportRequest,
    progress?: IdeGsmImportCallback,
  ): Promise<IdeGsmLocationImportResult> {
    const emit = (payload: Omit<IdeGsmImportProgress, 'timestamp'>): void => {
      progress?.({ ...payload, timestamp: Date.now() });
    };
    try {
      emit({ phase: 'fetch' });

      const response = await authFetch('location', request.sourceUrl);
      if (!response.ok) {
        throw new Error(`IDE-GSM fetch failed (${response.status})`);
      }
      const csvText = await response.text();
      const {
        parseIdeGsmCsv,
        filterIdeGsmPointsBySelection,
        replaceLocationPointsChunked,
      } = await import('@hierarchidb/location-plugin');
      const parsed = await parseIdeGsmCsv(csvText);
      emit({ phase: 'parse', total: parsed.rowCount, processed: parsed.rowCount });

      const filtered = filterIdeGsmPointsBySelection(parsed.points, request.selectionEntries);
      emit({ phase: 'filter', total: parsed.points.length, processed: filtered.length });

      const chunkSize = request.chunkSize ?? IDE_GSM_BULK_CHUNK_SIZE;
      await replaceLocationPointsChunked(request.nodeId, filtered, {
        chunkSize,
        onProgress: (chunkProgress) => {
          emit({
            phase: 'save',
            total: chunkProgress.total,
            processed: chunkProgress.saved,
            chunk: chunkProgress.chunkIndex,
            chunkSize: chunkProgress.chunkSize,
          });
        },
      });

      const points = filtered.map((point) => ({
        lon: Number(point.longitude) || 0,
        lat: Number(point.latitude) || 0,
        id: point.pointId,
        properties: {
          name: point.name,
          kind: point.kind,
          countryCode: point.countryCode,
          countryName: point.countryName,
          admin1: point.admin1,
          admin2: point.admin2,
          ...(point.metadata ?? {}),
        },
      }));

      emit({ phase: 'completed', total: points.length, processed: points.length });
      return { points, total: points.length };
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      emit({ phase: 'failed', message });
      throw error;
    }
  }
}
