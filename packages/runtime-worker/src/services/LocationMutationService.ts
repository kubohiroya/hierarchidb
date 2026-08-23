import type { NodeId } from '@hierarchidb/core-types';
import { ephemeralDB } from '@hierarchidb/gis-sdk';
import type { LocationMutationAPI } from '@hierarchidb/location-api';
import {
  IDE_GSM_BULK_CHUNK_SIZE,
  type IdeGsmImportCallback,
  type IdeGsmImportProgress,
  type IdeGsmLocationImportRequest,
  type IdeGsmLocationImportResult,
  type LocationGroupItem,
  type LocationRelation,
  parseIdeGsmRecords,
} from '@hierarchidb/location-api';
import type { LocationFeature, LocationPointProperties } from '@hierarchidb/location-store';
import {
  filterIdeGsmPointsBySelection,
  getLocationDB,
  mortonKeyFromLonLat,
} from '@hierarchidb/location-store';
import type { RouteLineString } from '@hierarchidb/route-api';
import { getRouteDB } from '@hierarchidb/route-store';
import { SingletonMixin } from '@hierarchidb/util';
import { loadTabularTableRows } from './utils/loadTabularTableRows.js';

type LocationPointWriteProgress = {
  total: number;
  saved: number;
  chunkIndex: number;
  chunkSize: number;
};

type LocationUpsertDiff = {
  featureId: string;
  nextData: LocationPointProperties;
  structuralChanged: boolean;
  metadataChanged: boolean;
};

type MutableLocationPointData = LocationPointProperties & {
  [key: string]: unknown;
};

const normalizeRecord = (value: unknown): Record<string, unknown> => {
  if (!value || typeof value !== 'object') return {};
  return { ...(value as { [key: string]: unknown }) };
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
    const existingRows =
      items.length > 0
        ? await db.features.bulkGet(
            items.map((item) => [nodeId, String(item.id)] as [NodeId, string])
          )
        : [];
    const updateDiffs: LocationUpsertDiff[] = [];
    const now = Date.now();
    const rows: LocationFeature[] = items.map((item, index) => {
      const data = item.data;
      const existing = existingRows[index];
      const structuralChanged = hasStructuralLocationDiff(existing?.data, data);
      const metadataChanged = hasMetadataLocationDiff(existing?.data, data);
      if (existing && (structuralChanged || metadataChanged)) {
        updateDiffs.push({
          featureId: String(item.id),
          nextData: data,
          structuralChanged,
          metadataChanged: !structuralChanged && metadataChanged,
        });
      }
      const longitude = data?.longitude;
      const latitude = data?.latitude;
      const mortonKey =
        typeof longitude === 'number' &&
        Number.isFinite(longitude) &&
        typeof latitude === 'number' &&
        Number.isFinite(latitude)
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
    if (updateDiffs.length > 0) {
      await this.syncRoutesAfterLocationUpdates(nodeId, updateDiffs);
    }
  }

  async deleteLocationGroups(nodeId: NodeId, itemIds: string[]): Promise<void> {
    const db = getLocationDB();
    await db.open?.();
    await this.deleteRoutesReferencingLocationRows(
      nodeId,
      itemIds.map((id) => String(id))
    );
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
    await db.clearNodeFeatures(nodeId);
  }

  async clearLocationVectorTiles(nodeId: NodeId): Promise<void> {
    const db = getLocationDB();
    await db.open?.();
    await db.clearNodeVectorTiles(nodeId);
  }

  async clearLocationArtifacts(nodeId: NodeId): Promise<void> {
    const db = getLocationDB();
    await db.open?.();
    await db.clearNodeArtifacts(nodeId);
  }

  async deleteLocationBySourceKey(nodeId: NodeId, sourceKey: string): Promise<void> {
    const db = getLocationDB();
    await db.open?.();
    const rows = await db.features.where('nodeId').equals(nodeId).toArray();
    if (!rows.length) return;
    const targetIds = rows
      .filter((row) => {
        const meta = normalizeRecord(row.data?.metadata);
        const storedKey = typeof meta.sourceKey === 'string' ? meta.sourceKey : '';
        return sourceKey && storedKey === sourceKey;
      })
      .map((row) => row.id);
    if (!targetIds.length) return;
    await this.deleteRoutesReferencingLocationRows(
      nodeId,
      targetIds.map((id) => String(id))
    );
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
      const data: MutableLocationPointData = { ...item.data };
      const legacyCode = typeof data.countryCode === 'string' ? data.countryCode : undefined;
      const legacyName = typeof data.countryName === 'string' ? data.countryName : undefined;
      const legacyAdmin0Name = typeof data.admin0Name === 'string' ? data.admin0Name : undefined;
      const admin0Code = typeof data.admin0Code === 'string' ? data.admin0Code : undefined;
      const admin0 = typeof data.admin0 === 'string' ? data.admin0 : undefined;
      if (
        (!admin0Code && legacyCode) ||
        (!admin0 && (legacyName || legacyAdmin0Name)) ||
        legacyCode ||
        legacyName ||
        legacyAdmin0Name
      ) {
        const nextData: MutableLocationPointData = { ...data };
        if (!admin0Code && legacyCode) {
          nextData.admin0Code = legacyCode;
        }
        if (!admin0 && (legacyName || legacyAdmin0Name)) {
          nextData.admin0 = legacyAdmin0Name ?? legacyName;
        }
        delete nextData.countryCode;
        delete nextData.countryName;
        delete nextData.admin0Name;
        updatedItems.push({ ...item, data: nextData, updatedAt: Date.now() });
        updated += 1;
      }
    });
    if (updatedItems.length > 0) {
      const now = Date.now();
      const rows: LocationFeature[] = updatedItems.map((item) => {
        const data = item.data;
        const longitude = data?.longitude;
        const latitude = data?.latitude;
        const mortonKey =
          typeof longitude === 'number' &&
          Number.isFinite(longitude) &&
          typeof latitude === 'number' &&
          Number.isFinite(latitude)
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
      emit({ phase: 'source' });

      const { headers, rows } = await loadTabularTableRows(
        'location',
        request.tabularSourceId,
        request.tabularDbPrefix
      );
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
        const mortonKey =
          typeof longitude === 'number' &&
          Number.isFinite(longitude) &&
          typeof latitude === 'number' &&
          Number.isFinite(latitude)
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

  private async deleteRoutesReferencingLocationRows(
    locationNodeId: NodeId,
    locationFeatureIds: string[]
  ): Promise<void> {
    if (!locationFeatureIds.length) return;
    const routeDb = getRouteDB();
    await routeDb.open?.();
    const impactedRouteIds = await this.findRouteIdsReferencingLocationFeatures(
      routeDb,
      locationNodeId,
      locationFeatureIds
    );
    if (!impactedRouteIds.length) return;
    const impactedRows = await routeDb.features.bulkGet(impactedRouteIds as NodeId[]);
    const impacted = impactedRows.filter((row): row is RouteLineString => Boolean(row));
    if (!impacted.length) return;
    const impactedRouteNodeIds = new Set(impacted.map((row) => row.nodeId));
    await routeDb.transaction(
      'rw',
      routeDb.features,
      routeDb.vectorTiles,
      routeDb.tileIndex,
      async () => {
        for (const routeId of impactedRouteIds) {
          await routeDb.features.delete(routeId);
        }
        for (const routeNodeId of impactedRouteNodeIds) {
          await routeDb.vectorTiles.where('nodeId').equals(routeNodeId).delete();
          await routeDb.tileIndex.where('nodeId').equals(routeNodeId).delete();
        }
      }
    );
    for (const routeNodeId of impactedRouteNodeIds) {
      await this.clearRouteArtifactsAndReserveRouteRebuild(routeNodeId);
    }
  }

  private async syncRoutesAfterLocationUpdates(
    locationNodeId: NodeId,
    diffs: LocationUpsertDiff[]
  ): Promise<void> {
    if (!diffs.length) return;
    const routeDb = getRouteDB();
    await routeDb.open?.();
    const diffByFeatureId = new Map(diffs.map((diff) => [diff.featureId, diff]));
    const impactedRouteIds = await this.findRouteIdsReferencingLocationFeatures(
      routeDb,
      locationNodeId,
      diffs.map((diff) => String(diff.featureId))
    );
    if (!impactedRouteIds.length) return;
    const impactedRows = await routeDb.features.bulkGet(impactedRouteIds as NodeId[]);
    const rows = impactedRows.filter((row): row is RouteLineString => Boolean(row));
    const metadataUpdates: RouteLineString[] = [];
    const structuralUpdates: RouteLineString[] = [];
    const structuralRouteNodes = new Set<NodeId>();
    const structuralUpdatedAt = Date.now();

    rows.forEach((route) => {
      const startFeatureId = route.startPoint?.locationFeatureId
        ? String(route.startPoint.locationFeatureId)
        : null;
      const endFeatureId = route.endPoint?.locationFeatureId
        ? String(route.endPoint.locationFeatureId)
        : null;
      const startMatched =
        (route.startLocationId === locationNodeId ||
          route.startPoint?.locationId === locationNodeId) &&
        startFeatureId
          ? diffByFeatureId.get(startFeatureId)
          : undefined;
      const endMatched =
        (route.endLocationId === locationNodeId || route.endPoint?.locationId === locationNodeId) &&
        endFeatureId
          ? diffByFeatureId.get(endFeatureId)
          : undefined;
      if (!startMatched && !endMatched) return;

      if (startMatched?.structuralChanged || endMatched?.structuralChanged) {
        structuralRouteNodes.add(route.nodeId);
        structuralUpdates.push({
          ...route,
          rebuildRequired: true,
          rebuildRequiredAt: structuralUpdatedAt,
          updatedAt: structuralUpdatedAt,
        });
        return;
      }

      let changed = false;
      const nextRoute: RouteLineString = {
        ...route,
        startPoint: route.startPoint ? { ...route.startPoint } : route.startPoint,
        endPoint: route.endPoint ? { ...route.endPoint } : route.endPoint,
      };
      if (startMatched?.metadataChanged && nextRoute.startPoint) {
        nextRoute.startPoint = applyLocationMetadataToRoutePoint(
          nextRoute.startPoint,
          startMatched.nextData
        );
        changed = true;
      }
      if (endMatched?.metadataChanged && nextRoute.endPoint) {
        nextRoute.endPoint = applyLocationMetadataToRoutePoint(
          nextRoute.endPoint,
          endMatched.nextData
        );
        changed = true;
      }
      if (!changed) return;
      nextRoute.updatedAt = Date.now();
      metadataUpdates.push(nextRoute);
    });

    await routeDb.transaction(
      'rw',
      routeDb.features,
      routeDb.vectorTiles,
      routeDb.tileIndex,
      async () => {
        if (metadataUpdates.length > 0) {
          await routeDb.features.bulkPut(metadataUpdates);
        }
        if (structuralUpdates.length > 0) {
          await routeDb.features.bulkPut(structuralUpdates);
        }
        for (const routeNodeId of structuralRouteNodes) {
          await routeDb.vectorTiles.where('nodeId').equals(routeNodeId).delete();
          await routeDb.tileIndex.where('nodeId').equals(routeNodeId).delete();
        }
      }
    );

    for (const routeNodeId of structuralRouteNodes) {
      await this.clearRouteArtifactsAndReserveRouteRebuild(routeNodeId);
    }
  }

  private async findRouteIdsReferencingLocationFeatures(
    routeDb: ReturnType<typeof getRouteDB>,
    locationNodeId: NodeId,
    locationFeatureIds: string[]
  ): Promise<NodeId[]> {
    if (!locationFeatureIds.length) return [];
    const locationFeatureSet = new Set(locationFeatureIds.map((id) => String(id)));

    const startIds = await routeDb.features
      .where('startLocationId')
      .equals(locationNodeId)
      .primaryKeys();
    const endIds = await routeDb.features
      .where('endLocationId')
      .equals(locationNodeId)
      .primaryKeys();
    const candidateIds = new Set<NodeId>([...startIds, ...endIds].map((id) => id as NodeId));

    const candidateRows =
      candidateIds.size > 0 ? await routeDb.features.bulkGet(Array.from(candidateIds)) : [];
    const matchedIds = new Set<NodeId>();
    const addRouteMatch = (route: RouteLineString): void => {
      const startFeatureId = route.startPoint?.locationFeatureId
        ? String(route.startPoint.locationFeatureId)
        : null;
      const endFeatureId = route.endPoint?.locationFeatureId
        ? String(route.endPoint.locationFeatureId)
        : null;

      const startMatched =
        (route.startLocationId === locationNodeId ||
          route.startPoint?.locationId === locationNodeId) &&
        startFeatureId !== null &&
        locationFeatureSet.has(startFeatureId);
      const endMatched =
        (route.endLocationId === locationNodeId || route.endPoint?.locationId === locationNodeId) &&
        endFeatureId !== null &&
        locationFeatureSet.has(endFeatureId);

      if (startMatched || endMatched) {
        matchedIds.add(route.id);
      }
    };

    for (const route of candidateRows) {
      if (!route) continue;
      addRouteMatch(route);
    }

    const fallbackRows = await routeDb.features.toArray();
    for (const route of fallbackRows) {
      const typedRoute = route as RouteLineString;
      const startFeatureId = route.startPoint?.locationFeatureId
        ? String(route.startPoint.locationFeatureId)
        : null;
      const endFeatureId = route.endPoint?.locationFeatureId
        ? String(route.endPoint.locationFeatureId)
        : null;
      const hasLegacyLocationMatch =
        (typedRoute.startLocationId === undefined &&
          typedRoute.startPoint?.locationId === locationNodeId) ||
        (typedRoute.endLocationId === undefined &&
          typedRoute.endPoint?.locationId === locationNodeId);
      const hasLegacyFeatureMatch =
        (startFeatureId !== null && locationFeatureSet.has(startFeatureId)) ||
        (endFeatureId !== null && locationFeatureSet.has(endFeatureId));
      if (hasLegacyLocationMatch && hasLegacyFeatureMatch) {
        addRouteMatch(typedRoute);
      }
    }

    return Array.from(matchedIds);
  }

  private async clearRouteArtifactsAndReserveRouteRebuild(routeNodeId: NodeId): Promise<void> {
    await ephemeralDB.open?.();
    const now = Date.now();
    await ephemeralDB.transaction(
      'rw',
      [
        ephemeralDB.sourceCache,
        ephemeralDB.sourceCacheMeta,
        ephemeralDB.geometryCache,
        ephemeralDB.geometryCacheMeta,
        ephemeralDB.geometryErrors,
        ephemeralDB.tileEmitBufferRelations,
        ephemeralDB.buildTasks,
        ephemeralDB.buildSessionConfigs,
        ephemeralDB.buildSessionStatuses,
      ],
      async () => {
        await ephemeralDB.sourceCache.where('nodeId').equals(routeNodeId).delete();
        await ephemeralDB.sourceCacheMeta.where('nodeId').equals(routeNodeId).delete();
        await ephemeralDB.tileEmitBufferRelations.where('nodeId').equals(routeNodeId).delete();
        await ephemeralDB.geometryCache.where('nodeId').equals(routeNodeId).delete();
        await ephemeralDB.geometryCacheMeta.where('nodeId').equals(routeNodeId).delete();
        await ephemeralDB.geometryErrors.where('nodeId').equals(routeNodeId).delete();
        await ephemeralDB.buildTasks.where('nodeId').equals(routeNodeId).delete();
        const currentStatus = await ephemeralDB.buildSessionStatuses.get(routeNodeId);
        if (currentStatus?.status === 'running') return;
        const current = await ephemeralDB.buildSessionConfigs.get(routeNodeId);
        await ephemeralDB.buildSessionConfigs.put({
          ...(current ?? {}),
          nodeId: routeNodeId,
          domainType: 'route',
          startedAt: current?.startedAt ?? now,
        });
        await ephemeralDB.buildSessionStatuses.put({
          nodeId: routeNodeId,
          status: 'idle',
          completedAt: undefined,
          stopReason: 'unknown',
        });
      }
    );
  }
}

const hasStructuralLocationDiff = (
  prev?: LocationPointProperties,
  next?: LocationPointProperties
): boolean => {
  if (!prev || !next) return false;
  return (
    !isEqualNumber(prev.longitude, next.longitude) ||
    !isEqualNumber(prev.latitude, next.latitude) ||
    !isEqualString(prev.admin0Code, next.admin0Code) ||
    !isEqualString(prev.admin1Code, next.admin1Code) ||
    !isEqualString(prev.admin2Code, next.admin2Code)
  );
};

const hasMetadataLocationDiff = (
  prev?: LocationPointProperties,
  next?: LocationPointProperties
): boolean => {
  if (!prev || !next) return false;
  const prevComparable = normalizeMetadataComparable(prev);
  const nextComparable = normalizeMetadataComparable(next);
  return !isMetadataComparableEqual(prevComparable, nextComparable);
};

const normalizeMetadataComparable = (
  value: LocationPointProperties
): {
  name: string;
  type: string;
  admin0?: string;
  admin1?: string;
  admin2?: string;
  pointId?: string;
  metadata: Record<string, string | number | boolean>;
} => ({
  name: value.name,
  type: value.type,
  admin0: value.admin0,
  admin1: value.admin1,
  admin2: value.admin2,
  pointId: value.pointId,
  metadata: normalizeLocationMetadata(value.metadata ?? {}),
});

const isMetadataComparableEqual = (
  left: ReturnType<typeof normalizeMetadataComparable>,
  right: ReturnType<typeof normalizeMetadataComparable>
): boolean => {
  if (left.name !== right.name) return false;
  if (left.type !== right.type) return false;
  if ((left.admin0 ?? '') !== (right.admin0 ?? '')) return false;
  if ((left.admin1 ?? '') !== (right.admin1 ?? '')) return false;
  if ((left.admin2 ?? '') !== (right.admin2 ?? '')) return false;
  if ((left.pointId ?? '') !== (right.pointId ?? '')) return false;
  if (Object.keys(left.metadata).length !== Object.keys(right.metadata).length) return false;
  return Object.entries(left.metadata).every(([key, value]) => right.metadata[key] === value);
};

const normalizeLocationMetadata = (
  metadata: Record<string, unknown>
): Record<string, string | number | boolean> => {
  const normalized: Record<string, string | number | boolean> = {};
  Object.keys(metadata)
    .sort()
    .forEach((key) => {
      const value = metadata[key];
      if (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') {
        normalized[key] = value;
      }
    });
  return normalized;
};

const applyLocationMetadataToRoutePoint = (
  point: NonNullable<RouteLineString['startPoint']>,
  source: LocationPointProperties
): NonNullable<RouteLineString['startPoint']> => ({
  ...point,
  name: source.name,
  locationName: source.name,
  admin0Name: source.admin0,
  admin1Name: source.admin1,
  admin2Name: source.admin2,
  admin0Code: source.admin0Code,
  admin1Code: source.admin1Code,
  admin2Code: source.admin2Code,
});

const isEqualNumber = (left?: number, right?: number): boolean => {
  if (left == null && right == null) return true;
  if (typeof left !== 'number' || typeof right !== 'number') return false;
  return Math.abs(left - right) <= 1e-9;
};

const isEqualString = (left?: string, right?: string): boolean => (left ?? '') === (right ?? '');
