import { SingletonMixin } from '@hierarchidb/util';
import type { NodeId } from '@hierarchidb/common-types';
import { getEphemeralLocationDB, type LocationQueryAPI } from '@hierarchidb/location-store';
import type {
  LocationGroupItem,
  LocationRelation,
  LocationNearestPoint,
  LocationNearestPointQuery,
  LocationNearestPointResponse,
} from '@hierarchidb/plugin-service-api';
import { storeRegistry } from '../entity/store-registry.js';
import { VectorTile } from '@mapbox/vector-tile';
import Pbf from 'pbf';
import {
  BTree,
  LRUMap,
  clampZoom,
  findWithinDistanceInTree,
  haversineMeters,
  toTileCoord,
} from './nearest/tileNearest.js';

export class LocationQueryService implements LocationQueryAPI {
  private readonly tileCache = new LRUMap<string, BTree<LocationNearestPoint>>(DEFAULT_TILE_CACHE_SIZE);
  private readonly sessionCache = new Map<NodeId, { sessionId: string; checkedAt: number }>();

  static async getSingleton(): Promise<LocationQueryService> {
    return SingletonMixin.getSingleton('LocationQueryService', async () => new LocationQueryService());
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

  async findNearestLocationPoint(query: LocationNearestPointQuery): Promise<LocationNearestPointResponse> {
    const cursor = { longitude: query.longitude, latitude: query.latitude };
    const zoom = clampZoom(query.zoom);
    const maxDistanceMeters = query.maxDistanceMeters;
    const sessionId = await this.resolveSessionId(query.nodeId);
    if (!sessionId) {
      return { cursor, matches: [] };
    }

    const tile = toTileCoord(cursor.longitude, cursor.latitude, zoom);
    const maxIndex = 2 ** zoom;
    const candidates: { point: LocationNearestPoint; distanceMeters: number }[] = [];
    for (let dx = -1; dx <= 1; dx += 1) {
      for (let dy = -1; dy <= 1; dy += 1) {
        const x = tile.x + dx;
        const y = tile.y + dy;
        if (x < 0 || y < 0 || x >= maxIndex || y >= maxIndex) continue;
        const tree = await this.getTileTree(sessionId, zoom, x, y);
        if (!tree) continue;
        const matches = findWithinDistanceInTree(
          tree,
          cursor.longitude,
          cursor.latitude,
          maxDistanceMeters,
          (longitude, latitude, value) => haversineMeters(latitude, longitude, value.latitude, value.longitude),
        );
        for (const match of matches) {
          candidates.push({ point: match.item, distanceMeters: match.distanceMeters });
        }
      }
    }

    const matches = candidates
      .sort((a, b) => a.distanceMeters - b.distanceMeters)
      .map((candidate) => ({
        point: candidate.point,
        distanceMeters: candidate.distanceMeters,
      }));

    return { cursor, matches };
  }

  async getVectorTile(nodeId: NodeId, z: number, x: number, y: number): Promise<ArrayBuffer | null> {
    const sessionId = await this.resolveSessionId(nodeId);
    if (!sessionId) return null;
    const db = getEphemeralLocationDB();
    const record = await db.vectorTiles.get(`loc-mvt-${sessionId}-${z}-${x}-${y}`);
    return record?.data ?? null;
  }

  private async resolveSessionId(nodeId: NodeId): Promise<string | null> {
    const cached = this.sessionCache.get(nodeId);
    if (cached && Date.now() - cached.checkedAt < SESSION_CACHE_TTL_MS) {
      return cached.sessionId;
    }
    const db = getEphemeralLocationDB();
    const sessions = await db.sessions.where('nodeId').equals(nodeId).toArray();
    if (!sessions.length) return null;
    const [first, ...rest] = sessions;
    if (!first) return null;
    let latest = first;
    for (const current of rest) {
      latest = (current.createdAt ?? 0) > (latest.createdAt ?? 0) ? current : latest;
    }
    const sessionId = latest.sessionId;
    this.sessionCache.set(nodeId, { sessionId, checkedAt: Date.now() });
    return sessionId ?? null;
  }

  private async getTileTree(
    sessionId: string,
    z: number,
    x: number,
    y: number,
  ): Promise<BTree<LocationNearestPoint> | null> {
    const cacheKey = `${sessionId}:${z}:${x}:${y}`;
    const cached = this.tileCache.get(cacheKey);
    if (cached) return cached;

    const db = getEphemeralLocationDB();
    const record = await db.vectorTiles.get(`loc-mvt-${sessionId}-${z}-${x}-${y}`);
    if (!record?.data) return null;

    const points = decodeLocationPoints(record.data, z, x, y);
    if (points.length === 0) return null;

    const tree = new BTree<LocationNearestPoint>();
    for (const point of points) {
      tree.insert(point.longitude, point);
    }
    this.tileCache.set(cacheKey, tree);
    return tree;
  }
}

const DEFAULT_TILE_CACHE_SIZE = 256;
const SESSION_CACHE_TTL_MS = 5_000;
const DEFAULT_LAYER_NAME = 'location_points';

function decodeLocationPoints(
  tileData: ArrayBuffer,
  z: number,
  x: number,
  y: number,
): LocationNearestPoint[] {
  const tile = new VectorTile(new Pbf(new Uint8Array(tileData)));
  const layer = tile.layers[DEFAULT_LAYER_NAME];
  if (!layer) return [];
  const points: LocationNearestPoint[] = [];
  for (let index = 0; index < layer.length; index += 1) {
    const feature = layer.feature(index);
    const geojson = feature.toGeoJSON(x, y, z) as {
      geometry?: { type?: string; coordinates?: [number, number] };
      properties?: Record<string, unknown>;
      id?: string | number;
    };
    if (!geojson?.geometry || geojson.geometry.type !== 'Point') continue;
    const coords = geojson.geometry.coordinates;
    if (!coords || coords.length !== 2) continue;
    const properties = (feature.properties ?? geojson.properties ?? {}) as Record<string, unknown>;
    points.push({
      id: toOptionalString(feature.id ?? geojson.id),
      name: resolveName(properties),
      kind: resolveKind(properties),
      region: resolveRegion(properties),
      countryName: resolveCountryName(properties),
      longitude: coords[0],
      latitude: coords[1],
      properties,
    });
  }
  return points;
}


function toOptionalString(value: unknown): string | undefined {
  if (typeof value === 'string') return value.trim() || undefined;
  if (typeof value === 'number' && Number.isFinite(value)) return String(value);
  return undefined;
}

function toStringValue(value: unknown): string | undefined {
  if (typeof value === 'string') return value.trim() || undefined;
  if (typeof value === 'number' && Number.isFinite(value)) return String(value);
  return undefined;
}

function resolveName(properties: Record<string, unknown>): string | undefined {
  return toStringValue(properties.name)
    ?? toStringValue(properties.label)
    ?? toStringValue(properties.NAME)
    ?? toStringValue(properties.title);
}

function resolveKind(properties: Record<string, unknown>): string | undefined {
  return toStringValue(properties.kind)
    ?? toStringValue(properties.type)
    ?? toStringValue(properties.locationType);
}

function resolveRegion(properties: Record<string, unknown>): string | undefined {
  return toStringValue(properties.admin1)
    ?? toStringValue(properties.admin2)
    ?? toStringValue(properties.region)
    ?? toStringValue(properties.countryName)
    ?? toStringValue(properties.country);
}

function resolveCountryName(properties: Record<string, unknown>): string | undefined {
  return toStringValue(properties.countryName)
    ?? toStringValue(properties.country)
    ?? toStringValue(properties.country_name)
    ?? toStringValue(properties.COUNTRY)
    ?? toStringValue(properties.NAME_0);
}
