import type { NodeId } from '@hierarchidb/core-types';
import type { LocationFeature, LocationPointProperties } from '@hierarchidb/location-store';
import type { LocationMutationAPI } from '@hierarchidb/location-api';
import {
  filterIdeGsmPointsBySelection,
  getLocationDB,
  mortonKeyFromLonLat,
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
import { parseIdeGsmRecords } from '@hierarchidb/location-api';
import { loadTabularTableRows } from './utils/tabular.js';

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
    const db = getLocationDB();
    await db.open?.();
    const now = Date.now();
    const rows: LocationFeature[] = items.map((item) => {
      const data = item.data as LocationPointProperties;
      const longitude = data?.longitude;
      const latitude = data?.latitude;
      const mortonKey = typeof longitude === 'number' && Number.isFinite(longitude)
        && typeof latitude === 'number' && Number.isFinite(latitude)
        ? mortonKeyFromLonLat(longitude, latitude)
        : undefined;
      const centroidForShapeId = data?.centroidForShapeId;
      const centroidForShapeContainerNodeId = data?.centroidForShapeContainerNodeId;
      return {
        nodeId,
        id: String(item.id) as LocationFeature['id'],
        type: data?.type ?? 'unknown',
        data,
        mortonKey,
        ...(centroidForShapeId !== undefined && { centroidForShapeId }),
        ...(centroidForShapeContainerNodeId && { centroidForShapeContainerNodeId }),
        updatedAt: now,
      };
    });
    await db.features.bulkPut(rows);
  }

  async deleteLocationGroups(nodeId: NodeId, itemIds: string[]): Promise<void> {
    const db = getLocationDB();
    await db.open?.();
    await db.transaction('rw', db.features, async () => {
      for (const id of itemIds) {
        await db.features.delete([nodeId, String(id)]);
      }
    });
  }

  async upsertLocationRelations(relations: LocationRelation[]): Promise<void> {
    void relations;
  }

  async deleteLocationRelations(relations: LocationRelation[]): Promise<void> {
    void relations;
  }

  async clearLocationEntities(nodeId: NodeId): Promise<void> {
    const db = getLocationDB();
    await db.open?.();
    await db.features.where('nodeId').equals(nodeId).delete();
  }

  async clearLocationArtifacts(nodeId: NodeId): Promise<void> {
    await this.clearLocationEntities(nodeId);
    const db = getLocationDB();
    await db.clearNodeData(nodeId);
  }

  async deleteLocationBySourceKey(nodeId: NodeId, sourceKey: string): Promise<void> {
    const db = getLocationDB();
    await db.open?.();
    const rows = await db.features.where('nodeId').equals(nodeId).toArray();
    if (!rows.length) return;
    const targetIds = rows
      .filter((row) => {
        const meta = (row.data?.metadata ?? {}) as Record<string, unknown>;
        const storedKey = typeof meta.sourceKey === 'string' ? meta.sourceKey : '';
        return sourceKey && storedKey === sourceKey;
      })
      .map((row) => row.id);
    if (!targetIds.length) return;
    await db.transaction('rw', db.features, async () => {
      for (const id of targetIds) {
        await db.features.delete([nodeId, String(id)]);
      }
    });
  }

  // Temporary migration: copy legacy countryCode/countryName into admin0Code/admin0.
  async migrateLegacyAdmin0(nodeId: NodeId): Promise<{ scanned: number; updated: number }> {
    const db = getLocationDB();
    await db.open?.();
    const items = await db.features.where('nodeId').equals(nodeId).toArray();
    if (items.length === 0) return { scanned: 0, updated: 0 };
    const updatedItems: LocationGroupItem[] = [];
    let updated = 0;
    items.forEach((item) => {
      const data = (item.data ?? {}) as Record<string, unknown>;
      const legacyCode = typeof data.countryCode === 'string' ? data.countryCode : undefined;
      const legacyName = typeof data.countryName === 'string' ? data.countryName : undefined;
      const legacyAdmin0Name = typeof data.admin0Name === 'string' ? data.admin0Name : undefined;
      const admin0Code = typeof data.admin0Code === 'string' ? data.admin0Code : undefined;
      const admin0 = typeof data.admin0 === 'string' ? data.admin0 : undefined;
      if (
        (!admin0Code && legacyCode)
        || (!admin0 && (legacyName || legacyAdmin0Name))
        || legacyCode
        || legacyName
        || legacyAdmin0Name
      ) {
        const nextData = { ...data } as Record<string, unknown>;
        if (!admin0Code && legacyCode) {
          nextData.admin0Code = legacyCode;
        }
        if (!admin0 && (legacyName || legacyAdmin0Name)) {
          nextData.admin0 = legacyAdmin0Name ?? legacyName;
        }
        delete nextData.countryCode;
        delete nextData.countryName;
        delete nextData.admin0Name;
        updatedItems.push({ ...item, data: nextData as unknown as LocationGroupItem['data'], updatedAt: Date.now() });
        updated += 1;
      }
    });
    if (updatedItems.length > 0) {
      const now = Date.now();
      const rows: LocationFeature[] = updatedItems.map((item) => {
        const data = item.data as LocationPointProperties;
        const longitude = data?.longitude;
        const latitude = data?.latitude;
        const mortonKey = typeof longitude === 'number' && Number.isFinite(longitude)
          && typeof latitude === 'number' && Number.isFinite(latitude)
          ? mortonKeyFromLonLat(longitude, latitude)
          : undefined;
        const centroidForShapeId = data?.centroidForShapeId;
        const centroidForShapeContainerNodeId = data?.centroidForShapeContainerNodeId;
        return {
          nodeId,
          id: String(item.id) as LocationFeature['id'],
          type: data?.type ?? 'unknown',
          data,
          mortonKey,
          ...(centroidForShapeId !== undefined && { centroidForShapeId }),
          ...(centroidForShapeContainerNodeId && { centroidForShapeContainerNodeId }),
          updatedAt: now,
        };
      });
      await db.features.bulkPut(rows);
    }
    return { scanned: items.length, updated };
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

      const { headers, rows } = await loadTabularTableRows('location', request.tabularSourceId, request.tabularDbPrefix);
      const parsed = await parseIdeGsmRecords(headers, rows);
      emit({ phase: 'parse', total: parsed.rowCount, processed: parsed.rowCount });

      const filtered = filterIdeGsmPointsBySelection(parsed.points, request.selectionEntries);
      emit({ phase: 'filter', total: parsed.points.length, processed: filtered.length });

      const sourceKey = request.tabularSourceId;
      const chunkSize = request.chunkSize ?? IDE_GSM_BULK_CHUNK_SIZE;
      const writeMode = request.mode ?? 'upsert';
      const enriched = filtered.map((point) => ({
        ...point,
        metadata: {
          ...(point.metadata ?? {}),
          sourceKey,
        },
      }));
      await this.writeLocationPointsChunked(request.nodeId, enriched, {
        chunkSize,
        mode: writeMode,
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
          admin0Code: point.admin0Code,
          admin0: point.admin0,
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

  private async writeLocationPointsChunked(
    nodeId: NodeId,
    points: LocationPointProperties[],
    options?: {
      chunkSize?: number;
      onProgress?: (progress: LocationPointWriteProgress) => void;
      mode?: 'replace' | 'append' | 'upsert';
    }
  ): Promise<void> {
    const chunkSize = Math.max(1, options?.chunkSize ?? 1000);
    const db = getLocationDB();
    await db.open?.();
    const mode = options?.mode ?? 'replace';
    let existingByKey: Map<string, string> | null = null;
    if (mode === 'replace') {
      await db.features.where('nodeId').equals(nodeId).delete();
    } else if (mode === 'upsert') {
      existingByKey = new Map<string, string>();
      const existing = await db.features.where('nodeId').equals(nodeId).toArray();
      existing.forEach((item) => {
        const pointId = item.data?.pointId;
        const meta = (item.data?.metadata ?? {}) as Record<string, unknown>;
        const sourceKey = typeof meta.sourceKey === 'string' ? meta.sourceKey : '';
        const sourceUrl = typeof meta.sourceUrl === 'string' ? meta.sourceUrl : '';
        const keyPart = sourceKey || sourceUrl;
        if (!pointId || !keyPart) return;
        existingByKey?.set(`${pointId}::${keyPart}`, item.id);
      });
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
      const items: LocationGroupItem[] = slice.map((point: LocationPointProperties) => {
        const meta = (point.metadata ?? {}) as Record<string, unknown>;
        const sourceKey = typeof meta.sourceKey === 'string' ? meta.sourceKey : '';
        const sourceUrl = typeof meta.sourceUrl === 'string' ? meta.sourceUrl : '';
        const keyPart = sourceKey || sourceUrl;
        const key = keyPart ? `${point.pointId}::${keyPart}` : '';
        const existingId = mode === 'upsert' && existingByKey ? existingByKey.get(key) : undefined;
        return {
          id: existingId ?? crypto.randomUUID(),
          data: { ...point },
          updatedAt: now,
        };
      });
      const rows: LocationFeature[] = items.map((item) => {
        const data = item.data as LocationPointProperties;
        const longitude = data?.longitude;
        const latitude = data?.latitude;
        const mortonKey = typeof longitude === 'number' && Number.isFinite(longitude)
          && typeof latitude === 'number' && Number.isFinite(latitude)
          ? mortonKeyFromLonLat(longitude, latitude)
          : undefined;
        const centroidForShapeId = data?.centroidForShapeId;
        const centroidForShapeContainerNodeId = data?.centroidForShapeContainerNodeId;
        return {
          nodeId,
          id: String(item.id) as LocationFeature['id'],
          type: data?.type ?? 'unknown',
          data,
          mortonKey,
          ...(centroidForShapeId !== undefined && { centroidForShapeId }),
          ...(centroidForShapeContainerNodeId && { centroidForShapeContainerNodeId }),
          updatedAt: now,
        };
      });
      await db.features.bulkPut(rows);
      saved += items.length;
      options?.onProgress?.({ total: points.length, saved, chunkIndex, chunkSize });
    }
  }
}
