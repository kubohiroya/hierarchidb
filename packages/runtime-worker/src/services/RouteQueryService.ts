import type { NodeId } from '@hierarchidb/common-types';
import type {
  RouteNearestEndpoint,
  RouteNearestLine,
  RouteNearestLineQuery,
  RouteNearestLineResponse,
} from '@hierarchidb/plugin-service-api';
import type { RouteDatabaseHandle } from '@hierarchidb/route-store';
import type { RouteQueryAPI } from '@hierarchidb/plugin-service-api';
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

type RoutePointSummary = {
  name?: string;
  admin1Name?: string;
  admin0Name?: string;
  pointId?: string;
};

type RouteLineStringRecord = {
  id: string;
  nodeId: NodeId;
  routeMode?: string;
  waypoints?: [number, number][];
  distance?: number;
  startPoint?: RoutePointSummary;
  endPoint?: RoutePointSummary;
  featureId?: string;
};

type RouteNearestSegment = {
  line: RouteLineStringRecord;
  segmentStart: [number, number];
  segmentEnd: [number, number];
  keyLongitude: number;
};

export const DEFAULT_TILE_CACHE_SIZE = 256;
export const LINESTRING_CACHE_TTL_MS = 5_000;

export class RouteQueryService implements RouteQueryAPI {
  static async getSingleton(db: RouteDatabaseHandle): Promise<RouteQueryService> {
    return SingletonMixin.getSingleton('RouteQueryService', async () => new RouteQueryService(db));
  }

  constructor(private db: RouteDatabaseHandle) {}

  async findNearestRouteLine(query: RouteNearestLineQuery): Promise<RouteNearestLineResponse> {
    const cursor = { longitude: query.longitude, latitude: query.latitude };
    const zoom = clampZoom(query.zoom);
    const maxDistanceMeters = query.maxDistanceMeters;
    await this.db.open?.();
    const tile = toTileCoord(cursor.longitude, cursor.latitude, zoom);
    const maxIndex = 2 ** zoom;
    const candidates = new Map<string, { line: RouteLineStringRecord; distance: number }>();

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
          const existing = candidates.get(key);
          if (!existing || match.distanceMeters < existing.distance) {
            candidates.set(key, { line: match.item.line, distance: match.distanceMeters });
          }
        }
      }
    }

    const matches = Array.from(candidates.values())
      .sort((a, b) => a.distance - b.distance)
      .map((candidate) => ({
        line: this.toNearestLine(candidate.line),
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

    const lineStrings = await this.getLineStrings(nodeId);
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

  private toNearestLine(line: RouteLineStringRecord): RouteNearestLine {
    const start = toEndpoint(line.startPoint);
    const end = toEndpoint(line.endPoint);
    return {
      lineStringId: line.id,
      featureId: line.featureId ?? buildFeatureId(line),
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
    pointId: point.pointId,
  };
};

const buildFeatureId = (line: RouteLineStringRecord): string | undefined => {
  const startId = line.startPoint?.pointId;
  const endId = line.endPoint?.pointId;
  if (startId && endId) return `${startId}+${endId}`;
  return undefined;
};
