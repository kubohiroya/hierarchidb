import type { NodeId } from '@hierarchidb/common-types';
import { authFetch } from '@hierarchidb/download';
import type { LocationPointProperties } from '@hierarchidb/location-store';
import type { LocationMutationAPI } from '@hierarchidb/location-api';
import {
  filterIdeGsmPointsBySelection,
  getLocationDB,
  parseIdeGsmCsv,
} from '@hierarchidb/location-store';
import {
  IDE_GSM_BULK_CHUNK_SIZE,
  type IdeGsmImportCallback,
  type IdeGsmImportProgress,
  type IdeGsmLocationImportRequest,
  type IdeGsmLocationImportResult,
  type LocationGroupItem,
  type LocationRelation,
} from '@hierarchidb/location-api';
import { SingletonMixin } from '@hierarchidb/util';
import { storeRegistry } from '../entity/store-registry.js';

type LocationPointWriteProgress = {
  total: number;
  saved: number;
  chunkIndex: number;
  chunkSize: number;
};

export class LocationMutationService implements LocationMutationAPI {
  static async getSingleton(): Promise<LocationMutationService> {
    return SingletonMixin.getSingleton(
      'LocationMutationService',
      async () => new LocationMutationService()
    );
  }

  async upsertLocationGroups(nodeId: NodeId, items: LocationGroupItem[]): Promise<void> {
    const store = storeRegistry.getFeatures<LocationGroupItem>('location');
    if (!store) return;
    await store.bulkUpsert(nodeId, items);
  }

  async deleteLocationGroups(nodeId: NodeId, itemIds: string[]): Promise<void> {
    const store = storeRegistry.getFeatures<LocationGroupItem>('location');
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
    const groupStore = storeRegistry.getFeatures<LocationGroupItem>('location');
    if (groupStore) {
      const items = await groupStore.list(nodeId);
      if (items.length > 0) {
        await groupStore.bulkDelete(
          nodeId,
          items.map((item) => item.id)
        );
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
    const db = getLocationDB();
    await db.clearNodeData(nodeId);
  }

  async importIdeGsmLocations(
    request: IdeGsmLocationImportRequest,
    progress?: IdeGsmImportCallback
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
      const parsed = await parseIdeGsmCsv(csvText);
      emit({ phase: 'parse', total: parsed.rowCount, processed: parsed.rowCount });

      const filtered = filterIdeGsmPointsBySelection(parsed.points, request.selectionEntries);
      emit({ phase: 'filter', total: parsed.points.length, processed: filtered.length });

      const chunkSize = request.chunkSize ?? IDE_GSM_BULK_CHUNK_SIZE;
      await this.replaceLocationPointsChunked(request.nodeId, filtered, {
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
        id: crypto.randomUUID(),
        properties: {
          name: point.name,
          type: point.type,
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

  private async replaceLocationPointsChunked(
    nodeId: NodeId,
    points: LocationPointProperties[],
    options?: {
      chunkSize?: number;
      onProgress?: (progress: LocationPointWriteProgress) => void;
    }
  ): Promise<void> {
    const store = storeRegistry.getFeatures<LocationGroupItem>('location');
    const chunkSize = Math.max(1, options?.chunkSize ?? 1000);
    if (!store) {
      options?.onProgress?.({ total: points.length, saved: 0, chunkIndex: 0, chunkSize });
      return;
    }
    const existing = await store.list(nodeId);
    if (existing.length > 0) {
      await store.bulkDelete(
        nodeId,
        existing.map((item) => item.id)
      );
    }
    if (!points.length) {
      options?.onProgress?.({ total: 0, saved: 0, chunkIndex: 0, chunkSize });
      return;
    }
    let saved = 0;
    let chunkIndex = 0;
    for (let i = 0; i < points.length; i += chunkSize) {
      chunkIndex += 1;
      const slice = points.slice(i, i + chunkSize);
      const now = Date.now();
      const items: LocationGroupItem[] = slice.map((point: LocationPointProperties) => ({
        id: crypto.randomUUID(),
        data: { ...point },
        updatedAt: now,
      }));
      await store.bulkUpsert(nodeId, items);
      saved += items.length;
      options?.onProgress?.({ total: points.length, saved, chunkIndex, chunkSize });
    }
  }
}
