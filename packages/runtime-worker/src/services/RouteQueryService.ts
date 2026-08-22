import type { NodeId } from '@hierarchidb/core-types';
import { ephemeralDB } from '@hierarchidb/gis-sdk';
import type { LocationFeature } from '@hierarchidb/location-api';
import { getLocationDB } from '@hierarchidb/location-store';
import type {
  RouteBuildError,
  RouteLineString,
  RouteMetadataSyncRow,
  RouteMetadataSyncSummary,
  RouteNearestEndpoint,
  RouteNearestLine,
  RouteNearestLineQuery,
  RouteNearestLineResponse,
  RouteQueryAPI,
} from '@hierarchidb/route-api';
import type { RouteDatabaseHandle } from '@hierarchidb/route-store';
import { countRouteReferencesToLocations } from '@hierarchidb/route-store';
import { SingletonMixin } from '@hierarchidb/util';
import {
  BTree,
  clampZoom,
  findWithinDistanceInTree,
  haversineMeters,
  LRUMap,
  tileToBbox,
  toTileCoord,
} from './nearest/tileNearest.js';
import {
  DEFAULT_TILE_CACHE_SIZE,
  LINESTRING_CACHE_TTL_MS,
} from './routeQueryCacheConfigConstants.js';
import { toLegacyBuildStage } from './stageAliasConstants.js';

type RoutePointSummary = {
  name?: string;
  admin1Name?: string;
  admin0Name?: string;
  admin2Name?: string;
  pointId?: string;
};

type RouteLineStringRecord = RouteLineString;

type RouteNearestSegment = {
  line: RouteLineStringRecord;
  segmentStart: [number, number];
  segmentEnd: [number, number];
  keyLongitude: number;
};

export class RouteQueryService implements RouteQueryAPI {
  static async getSingleton(db: RouteDatabaseHandle): Promise<RouteQueryService> {
    return SingletonMixin.getSingleton('RouteQueryService', async () => new RouteQueryService(db));
  }

  constructor(private db: RouteDatabaseHandle) {}

  async findNearestRouteLine(query: RouteNearestLineQuery): Promise<RouteNearestLineResponse> {
    const cursor = { longitude: query.longitude, latitude: query.latitude };
    const zoom = clampZoom(query.zoom);
    const maxDistanceMeters = query.maxDistanceMeters;
    const maxMatches = Number.isFinite(query.maxMatches ?? 12)
      ? Math.max(1, Math.min(50, Math.floor(query.maxMatches ?? 12)))
      : 12;
    await this.db.open?.();
    const tile = toTileCoord(cursor.longitude, cursor.latitude, zoom);
    const maxIndex = 2 ** zoom;
    const candidates = new Map<
      string,
      {
        line: RouteLineStringRecord;
        distance: number;
        nearestPoint: [number, number];
      }
    >();

    for (let dx = -1; dx <= 1; dx += 1) {
      for (let dy = -1; dy <= 1; dy += 1) {
        const x = tile.x + dx;
        const y = tile.y + dy;
        if (x < 0 || y < 0 || x >= maxIndex || y >= maxIndex) continue;
        const tree = await this.getTileTree(query.nodeId, zoom, x, y);
        if (!tree) continue;
        const matches = findWithinDistanceInTree(
          tree,
          cursor.longitude,
          cursor.latitude,
          maxDistanceMeters,
          (longitude, latitude, segment) =>
            distancePointToSegmentMeters(
              longitude,
              latitude,
              segment.segmentStart,
              segment.segmentEnd
            )
        );
        for (const match of matches) {
          const key = match.item.line.id;
          const nearestPoint = findNearestPointOnSegment(
            cursor.longitude,
            cursor.latitude,
            match.item.segmentStart,
            match.item.segmentEnd
          );
          if (!nearestPoint) continue;
          const existing = candidates.get(key);
          if (!existing || match.distanceMeters < existing.distance) {
            candidates.set(key, {
              line: match.item.line,
              distance: match.distanceMeters,
              nearestPoint,
            });
          }
        }
      }
    }

    const matches = Array.from(candidates.values())
      .sort((a, b) => a.distance - b.distance)
      .slice(0, maxMatches)
      .map((candidate) => ({
        line: {
          ...this.toNearestLine(candidate.line),
          nearestPoint: candidate.nearestPoint,
        },
        distanceMeters: candidate.distance,
      }));

    return { cursor, matches };
  }

  async getVectorTile(
    nodeId: NodeId,
    z: number,
    x: number,
    y: number
  ): Promise<ArrayBuffer | null> {
    await this.db.open?.();
    const record = await this.db.vectorTiles
      .where('[nodeId+z+x+y]')
      .equals([nodeId, z, x, y])
      .toArray()
      .then((rows) => rows[0]);
    return record?.data ?? null;
  }

  async listRouteLineStrings(nodeId: NodeId): Promise<RouteLineStringRecord[]> {
    await this.db.open?.();
    return this.getLineStrings(nodeId);
  }

  async listRouteBuildErrors(nodeId: NodeId): Promise<RouteBuildError[]> {
    const rows = await ephemeralDB.geometryErrors.where('nodeId').equals(nodeId).toArray();
    return rows
      .filter((row) => row.domainType === 'route')
      .sort((a, b) => (a.createdAt ?? 0) - (b.createdAt ?? 0))
      .map((row) => ({
        id: row.id,
        stage: normalizeRouteBuildErrorStage(row.stage),
        message: row.message ?? 'Unknown route build error',
        sourceKey: row.sourceKey,
        featureId: row.featureId,
        createdAt: row.createdAt ?? Date.now(),
      }));
  }

  async checkRouteMetadataSync(nodeId: NodeId): Promise<RouteMetadataSyncSummary> {
    await this.db.open?.();
    const routeLines = await this.getLineStrings(nodeId);
    const locationDb = getLocationDB();
    await locationDb.open?.();
    const locationCache = new Map<string, LocationFeature | null>();
    const rows: RouteMetadataSyncRow[] = [];

    for (const line of routeLines) {
      const staleFields = new Set<RouteMetadataSyncRow['staleFields'][number]>();
      const reasons: string[] = [];
      const startResult = await compareRoutePointWithLocation(
        'start',
        line.startPoint,
        locationDb,
        locationCache
      );
      const endResult = await compareRoutePointWithLocation(
        'end',
        line.endPoint,
        locationDb,
        locationCache
      );

      [...startResult.staleFields, ...endResult.staleFields].forEach((field) =>
        staleFields.add(field)
      );
      if (startResult.reason) reasons.push(startResult.reason);
      if (endResult.reason) reasons.push(endResult.reason);

      rows.push({
        lineId: String(line.id),
        status: staleFields.size === 0 ? 'synced' : 'stale',
        staleFields: Array.from(staleFields),
        reason: reasons.length > 0 ? reasons.join(' / ') : undefined,
      });
    }

    const staleCount = rows.filter((row) => row.status === 'stale').length;
    const syncedCount = rows.length - staleCount;
    return {
      checkedAt: Date.now(),
      totalCount: rows.length,
      syncedCount,
      staleCount,
      rows,
    };
  }

  async countRouteReferencesToLocations(locationNodeIds: NodeId[]): Promise<number> {
    return countRouteReferencesToLocations(locationNodeIds);
  }

  private readonly tileCache = new LRUMap<string, BTree<RouteNearestSegment>>(
    DEFAULT_TILE_CACHE_SIZE
  );
  private readonly lineStringCache = new Map<
    NodeId,
    { checkedAt: number; items: RouteLineStringRecord[] }
  >();

  private async getTileTree(
    nodeId: NodeId,
    z: number,
    x: number,
    y: number
  ): Promise<BTree<RouteNearestSegment> | null> {
    const cacheKey = `${nodeId}:${z}:${x}:${y}`;
    const cached = this.tileCache.get(cacheKey);
    if (cached) return cached;

    const indexedIds = await this.getTileLineIds(nodeId, z, x, y);
    const lineStrings = indexedIds
      ? await this.getLineStringsByIds(nodeId, indexedIds)
      : await this.getLineStrings(nodeId);
    if (!lineStrings.length) return null;

    const bbox = tileToBbox(z, x, y);
    const segments = buildSegmentsForTile(lineStrings, bbox);
    if (!segments.length) return null;

    const tree = new BTree<RouteNearestSegment>();
    for (const segment of segments) {
      tree.insert(segment.keyLongitude, segment);
    }
    this.tileCache.set(cacheKey, tree);
    return tree;
  }

  private async getLineStrings(nodeId: NodeId): Promise<RouteLineStringRecord[]> {
    const cached = this.lineStringCache.get(nodeId);
    if (cached && Date.now() - cached.checkedAt < LINESTRING_CACHE_TTL_MS) {
      return cached.items;
    }
    const rows = await this.db.features.where('nodeId').equals(nodeId).toArray();
    const items = (rows as RouteLineStringRecord[]).map((row) => ({ ...row }));
    this.lineStringCache.set(nodeId, { checkedAt: Date.now(), items });
    return items;
  }

  private async getLineStringsByIds(
    nodeId: NodeId,
    ids: string[]
  ): Promise<RouteLineStringRecord[]> {
    if (!ids.length) return [];
    const bulkGet = this.db.features.bulkGet;
    if (bulkGet) {
      const rows = await bulkGet(ids as NodeId[]);
      const items = rows.filter(Boolean).map((row) => ({ ...(row as RouteLineStringRecord) }));
      return items;
    }
    const rows = await this.db.features.where('nodeId').equals(nodeId).toArray();
    const wanted = new Set(ids);
    return (rows as RouteLineStringRecord[]).filter((row) => wanted.has(String(row.id)));
  }

  private async getTileLineIds(
    nodeId: NodeId,
    z: number,
    x: number,
    y: number
  ): Promise<string[] | null> {
    const rows = await this.db.tileIndex
      .where('[nodeId+z+x+y]')
      .equals([nodeId, z, x, y])
      .toArray();
    const record = rows[0];
    if (!record?.lineIds?.length) return null;
    return record.lineIds;
  }

  private toNearestLine(line: RouteLineStringRecord): RouteNearestLine {
    const start = toEndpoint(line.startPoint);
    const end = toEndpoint(line.endPoint);
    return {
      lineStringId: line.id,
      featureId: line.featureId ?? buildFeatureId(line),
      routeName: line.name,
      routeMode: line.routeMode,
      routeDistanceMeters: line.distance ?? estimateLineDistance(line.waypoints),
      start,
      end,
    };
  }
}

type TileBBox = { west: number; south: number; east: number; north: number };

const buildSegmentsForTile = (
  lines: RouteLineStringRecord[],
  bbox: TileBBox
): RouteNearestSegment[] => {
  const segments: RouteNearestSegment[] = [];
  for (const line of lines) {
    const points = line.waypoints ?? [];
    if (points.length < 2) continue;
    for (let i = 0; i < points.length - 1; i += 1) {
      const start = points[i] as [number, number];
      const end = points[i + 1] as [number, number];
      if (!segmentIntersectsBbox(start, end, bbox)) continue;
      segments.push({
        line,
        segmentStart: start,
        segmentEnd: end,
        keyLongitude: (start[0] + end[0]) / 2,
      });
    }
  }
  return segments;
};

const segmentIntersectsBbox = (
  start: [number, number],
  end: [number, number],
  bbox: TileBBox
): boolean => {
  const minLon = Math.min(start[0], end[0]);
  const maxLon = Math.max(start[0], end[0]);
  const minLat = Math.min(start[1], end[1]);
  const maxLat = Math.max(start[1], end[1]);
  if (maxLon < bbox.west || minLon > bbox.east) return false;
  if (maxLat < bbox.south || minLat > bbox.north) return false;
  return true;
};

const distancePointToSegmentMeters = (
  longitude: number,
  latitude: number,
  start: [number, number],
  end: [number, number]
): number => {
  const refLat = (latitude + start[1] + end[1]) / 3;
  const metersPerDegLat = 110_574;
  const metersPerDegLon = 111_320 * Math.cos((refLat * Math.PI) / 180);
  const x = longitude * metersPerDegLon;
  const y = latitude * metersPerDegLat;
  const x1 = start[0] * metersPerDegLon;
  const y1 = start[1] * metersPerDegLat;
  const x2 = end[0] * metersPerDegLon;
  const y2 = end[1] * metersPerDegLat;
  const dx = x2 - x1;
  const dy = y2 - y1;
  if (dx === 0 && dy === 0) {
    return Math.hypot(x - x1, y - y1);
  }
  const t = Math.max(0, Math.min(1, ((x - x1) * dx + (y - y1) * dy) / (dx * dx + dy * dy)));
  const projX = x1 + t * dx;
  const projY = y1 + t * dy;
  return Math.hypot(x - projX, y - projY);
};

const findNearestPointOnSegment = (
  longitude: number,
  latitude: number,
  start: [number, number],
  end: [number, number]
): [number, number] | null => {
  const refLat = (latitude + start[1] + end[1]) / 3;
  const metersPerDegLat = 110_574;
  const metersPerDegLon = 111_320 * Math.cos((refLat * Math.PI) / 180);
  if (!Number.isFinite(metersPerDegLon) || !Number.isFinite(metersPerDegLat)) {
    return null;
  }
  const x = longitude * metersPerDegLon;
  const y = latitude * metersPerDegLat;
  const x1 = start[0] * metersPerDegLon;
  const y1 = start[1] * metersPerDegLat;
  const x2 = end[0] * metersPerDegLon;
  const y2 = end[1] * metersPerDegLat;
  const dx = x2 - x1;
  const dy = y2 - y1;
  if (dx === 0 && dy === 0) {
    return [start[0], start[1]];
  }
  const t = Math.max(0, Math.min(1, ((x - x1) * dx + (y - y1) * dy) / (dx * dx + dy * dy)));
  const projX = x1 + t * dx;
  const projY = y1 + t * dy;
  const nearestLon = projX / metersPerDegLon;
  const nearestLat = projY / metersPerDegLat;
  if (!Number.isFinite(nearestLon) || !Number.isFinite(nearestLat)) return null;
  return [nearestLon, nearestLat];
};

const estimateLineDistance = (waypoints?: [number, number][]): number | undefined => {
  if (!waypoints || waypoints.length < 2) return undefined;
  let total = 0;
  for (let i = 0; i < waypoints.length - 1; i += 1) {
    const a = waypoints[i] as [number, number];
    const b = waypoints[i + 1] as [number, number];
    total += haversineMeters(a[1], a[0], b[1], b[0]);
  }
  return total;
};

const toEndpoint = (point?: RoutePointSummary): RouteNearestEndpoint | undefined => {
  if (!point) return undefined;
  return {
    name: point.name,
    admin1Name: point.admin1Name,
    admin0Name: point.admin0Name,
    admin2Name: point.admin2Name,
    pointId: point.pointId,
  };
};

const buildFeatureId = (line: RouteLineStringRecord): string | undefined => {
  const startId = line.startPoint?.pointId;
  const endId = line.endPoint?.pointId;
  if (startId && endId) return `${startId}+${endId}`;
  return undefined;
};

type RoutePointLike = RouteLineStringRecord['startPoint'];

type RoutePointComparisonResult = {
  staleFields: Array<RouteMetadataSyncRow['staleFields'][number]>;
  reason?: string;
};

const compareRoutePointWithLocation = async (
  side: 'start' | 'end',
  point: RoutePointLike | undefined,
  locationDb: ReturnType<typeof getLocationDB>,
  cache: Map<string, LocationFeature | null>
): Promise<RoutePointComparisonResult> => {
  const staleFields: Array<RouteMetadataSyncRow['staleFields'][number]> = [];
  if (!point?.locationId || !point?.locationFeatureId) {
    staleFields.push('reference');
    return { staleFields, reason: `${side}: location reference missing` };
  }

  const cacheKey = `${String(point.locationId)}::${String(point.locationFeatureId)}`;
  let location = cache.get(cacheKey);
  if (typeof location === 'undefined') {
    location = await locationDb.features.get([point.locationId, String(point.locationFeatureId)]);
    cache.set(cacheKey, location ?? null);
  }
  if (!location?.data) {
    staleFields.push('reference');
    return { staleFields, reason: `${side}: location row not found` };
  }

  const coordinateMismatch =
    !isNearlyEqual(point.longitude, location.data.longitude) ||
    !isNearlyEqual(point.latitude, location.data.latitude);
  if (coordinateMismatch) {
    staleFields.push('coordinates');
  }

  const adminCodeMismatch =
    !equalsNullableString(point.admin0Code, location.data.admin0Code) ||
    !equalsNullableString(point.admin1Code, location.data.admin1Code) ||
    !equalsNullableString(point.admin2Code, location.data.admin2Code);
  if (adminCodeMismatch) {
    staleFields.push('adminCode');
  }

  const adminNameMismatch =
    !equalsNullableString(point.admin0Name, location.data.admin0) ||
    !equalsNullableString(point.admin1Name, location.data.admin1) ||
    !equalsNullableString(point.admin2Name, location.data.admin2);
  if (adminNameMismatch) {
    staleFields.push('adminName');
  }

  if (staleFields.length === 0) return { staleFields };
  return {
    staleFields,
    reason: `${side}: ${staleFields.join(', ')}`,
  };
};

const isNearlyEqual = (left?: number, right?: number): boolean => {
  if (typeof left !== 'number' || typeof right !== 'number') return false;
  return Math.abs(left - right) <= 1e-9;
};

const equalsNullableString = (left?: string | null, right?: string | null): boolean =>
  (left ?? '').trim() === (right ?? '').trim();

const normalizeRouteBuildErrorStage = (stage: unknown): RouteBuildError['stage'] => {
  const stageId = typeof stage === 'string' ? stage : undefined;
  return toLegacyBuildStage(stage, stageId) ?? 'geometry';
};
