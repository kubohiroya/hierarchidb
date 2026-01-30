import type { NodeId } from '@hierarchidb/common-types';
import {
  clampMortonZoom,
  getLocationDB,
  type LocationFeature,
  lonLatToTileXY,
  MORTON_KEY_HEX_LENGTH,
  mortonRangeForTile,
} from '@hierarchidb/location-store';
import type {
  LocationGroupItem,
  LocationNearestPoint,
  LocationNearestPointQuery,
  LocationNearestPointResponse,
  LocationQueryAPI,
  LocationRelation,
  LocationViewportBbox,
  LocationViewportQueryOptions,
} from '@hierarchidb/plugin-service-api';
import { SingletonMixin } from '@hierarchidb/util';
import { storeRegistry } from '../entity/store-registry.js';
import { haversineMeters, metersToLongitudeDelta } from './nearest/tileNearest.js';

const MAX_LATITUDE = 85.05112878;

const clamp = (value: number, min: number, max: number): number =>
  Math.min(max, Math.max(min, value));

const clampBbox = (bbox: LocationViewportBbox): LocationViewportBbox => {
  const [minLon, minLat, maxLon, maxLat] = bbox;
  return [
    clamp(minLon, -180, 180),
    clamp(minLat, -MAX_LATITUDE, MAX_LATITUDE),
    clamp(maxLon, -180, 180),
    clamp(maxLat, -MAX_LATITUDE, MAX_LATITUDE),
  ];
};

const normalizeBbox = (bbox: LocationViewportBbox): LocationViewportBbox => {
  const [minLon, minLat, maxLon, maxLat] = bbox;
  const normalized: LocationViewportBbox = [
    Math.min(minLon, maxLon),
    Math.min(minLat, maxLat),
    Math.max(minLon, maxLon),
    Math.max(minLat, maxLat),
  ];
  return clampBbox(normalized);
};

const expandBbox = (
  bbox: LocationViewportBbox,
  options?: LocationViewportQueryOptions
): LocationViewportBbox => {
  const [minLon, minLat, maxLon, maxLat] = normalizeBbox(bbox);
  const width = Math.max(0, maxLon - minLon);
  const height = Math.max(0, maxLat - minLat);

  let marginLon = 0;
  let marginLat = 0;

  if (options?.prefetchMarginRatio && Number.isFinite(options.prefetchMarginRatio)) {
    const ratio = Math.max(0, options.prefetchMarginRatio);
    marginLon = Math.max(marginLon, width * ratio);
    marginLat = Math.max(marginLat, height * ratio);
  }

  if (options?.prefetchMarginPx && options.viewportSizePx) {
    const px = Math.max(0, options.prefetchMarginPx);
    const widthPx = Math.max(1, options.viewportSizePx.width);
    const heightPx = Math.max(1, options.viewportSizePx.height);
    marginLon = Math.max(marginLon, width * (px / widthPx));
    marginLat = Math.max(marginLat, height * (px / heightPx));
  }

  return clampBbox([
    minLon - marginLon,
    minLat - marginLat,
    maxLon + marginLon,
    maxLat + marginLat,
  ]);
};

const isWithinBbox = (longitude: number, latitude: number, bbox: LocationViewportBbox): boolean => {
  const [minLon, minLat, maxLon, maxLat] = bbox;
  return longitude >= minLon && longitude <= maxLon && latitude >= minLat && latitude <= maxLat;
};

const toGroupItem = (row: {
  id: string;
  data?: LocationGroupItem['data'];
  updatedAt?: number;
}): LocationGroupItem => ({
  id: row.id,
  data: row.data,
  updatedAt: row.updatedAt,
});

export class LocationQueryService implements LocationQueryAPI {
  static async getSingleton(): Promise<LocationQueryService> {
    return SingletonMixin.getSingleton(
      'LocationQueryService',
      async () => new LocationQueryService()
    );
  }

  async listLocationFeatures(nodeId: NodeId): Promise<LocationFeature[]> {
    const store = storeRegistry.getFeatures<LocationFeature>('location');
    if (store) {
      const items = await store.list(nodeId);
      return items;
    }
    const db = getLocationDB();
    const rows = await db.features.where('nodeId').equals(nodeId).toArray();
    return rows;
  }

  async listLocationGroups(nodeId: NodeId): Promise<LocationGroupItem[]> {
    const store = storeRegistry.getFeatures<LocationGroupItem>('location');
    if (store) {
      const items = await store.list(nodeId);
      return items.map((item) => toGroupItem(item));
    }
    const db = getLocationDB();
    const rows = await db.features.where('nodeId').equals(nodeId).toArray();
    return rows.map((row) => toGroupItem(row));
  }

  async listLocationRelations(nodeId: NodeId): Promise<LocationRelation[]> {
    const store = storeRegistry.getRelations('location');
    if (!store) return [];
    const relations = await store.listByNode(nodeId);
    return relations.map((rel) => ({ ...rel })) as LocationRelation[];
  }

  async queryByMortonPrefixes(
    nodeId: NodeId,
    prefixes: string[],
    types?: string[]
  ): Promise<LocationFeature[]> {
    const db = getLocationDB();
    const results = new Map<string, LocationFeature>();
    const normalizedPrefixes = prefixes.filter(
      (prefix) => typeof prefix === 'string' && prefix.length > 0
    );
    if (normalizedPrefixes.length === 0) return [];

    const collect = async (prefix: string, type?: string) => {
      const normalizedPrefix =
        prefix.length > MORTON_KEY_HEX_LENGTH ? prefix.slice(0, MORTON_KEY_HEX_LENGTH) : prefix;
      const start = normalizedPrefix.padEnd(MORTON_KEY_HEX_LENGTH, '0');
      const end = normalizedPrefix.padEnd(MORTON_KEY_HEX_LENGTH, 'f');
      const rows = type
        ? await db.features
            .where('[nodeId+type+mortonKey]')
            .between([nodeId, type, start], [nodeId, type, end], true, true)
            .toArray()
        : await db.features
            .where('[nodeId+mortonKey]')
            .between([nodeId, start], [nodeId, end], true, true)
            .toArray();
      for (const row of rows) {
        if (!row.data) continue;
        results.set(row.id, row);
      }
    };

    if (types && types.length > 0) {
      for (const type of types) {
        for (const prefix of normalizedPrefixes) {
          await collect(prefix, type);
        }
      }
    } else {
      for (const prefix of normalizedPrefixes) {
        await collect(prefix);
      }
    }

    return Array.from(results.values());
  }

  async queryByViewport(
    nodeId: NodeId,
    bbox: LocationViewportBbox,
    zoom: number,
    types?: string[],
    options?: LocationViewportQueryOptions
  ): Promise<LocationFeature[]> {
    const expanded = expandBbox(bbox, options);
    const targetBbox = normalizeBbox(bbox);
    const z = clampMortonZoom(zoom);
    const topLeft = lonLatToTileXY(expanded[0], expanded[3], z);
    const bottomRight = lonLatToTileXY(expanded[2], expanded[1], z);
    const minX = Math.min(topLeft.x, bottomRight.x);
    const maxX = Math.max(topLeft.x, bottomRight.x);
    const minY = Math.min(topLeft.y, bottomRight.y);
    const maxY = Math.max(topLeft.y, bottomRight.y);
    const db = getLocationDB();
    const results = new Map<string, LocationFeature>();
    const maxPoints = options?.maxPoints ?? 0;

    const collectRange = async (start: string, end: string, type?: string) => {
      const rows = type
        ? await db.features
            .where('[nodeId+type+mortonKey]')
            .between([nodeId, type, start], [nodeId, type, end], true, true)
            .toArray()
        : await db.features
            .where('[nodeId+mortonKey]')
            .between([nodeId, start], [nodeId, end], true, true)
            .toArray();
      for (const row of rows) {
        const data = row.data as
          | { latitude?: number; longitude?: number; type?: string }
          | undefined;
        const longitude = data?.longitude;
        const latitude = data?.latitude;
        if (
          typeof longitude !== 'number' ||
          !Number.isFinite(longitude) ||
          typeof latitude !== 'number' ||
          !Number.isFinite(latitude)
        ) {
          continue;
        }
        if (types && types.length > 0) {
          const type = data?.type;
          if (!type || !types.includes(String(type))) continue;
        }
        if (!isWithinBbox(longitude, latitude, targetBbox)) continue;
        results.set(row.id, row);
        if (maxPoints > 0 && results.size >= maxPoints) return;
      }
    };

    for (let x = minX; x <= maxX; x += 1) {
      for (let y = minY; y <= maxY; y += 1) {
        const range = mortonRangeForTile(x, y, z);
        if (types && types.length > 0) {
          for (const type of types) {
            await collectRange(range.start, range.end, type);
            if (maxPoints > 0 && results.size >= maxPoints) return Array.from(results.values());
          }
        } else {
          await collectRange(range.start, range.end);
          if (maxPoints > 0 && results.size >= maxPoints) return Array.from(results.values());
        }
      }
    }

    return Array.from(results.values());
  }

  async findNearestLocationPoint(
    query: LocationNearestPointQuery
  ): Promise<LocationNearestPointResponse> {
    const cursor = { longitude: query.longitude, latitude: query.latitude };
    const maxDistanceMeters = query.maxDistanceMeters;
    const latDelta = maxDistanceMeters / 111_320;
    const lonDelta = metersToLongitudeDelta(maxDistanceMeters, query.latitude);
    const bbox: LocationViewportBbox = [
      query.longitude - lonDelta,
      query.latitude - latDelta,
      query.longitude + lonDelta,
      query.latitude + latDelta,
    ];

    const items = await this.queryByViewport(query.nodeId, bbox, query.zoom, undefined, {
      maxPoints: 5000,
    });
    const matches = items
      .map((item) => {
        const data = item.data as { latitude?: number; longitude?: number } | undefined;
        const longitude = data?.longitude;
        const latitude = data?.latitude;
        if (
          typeof longitude !== 'number' ||
          !Number.isFinite(longitude) ||
          typeof latitude !== 'number' ||
          !Number.isFinite(latitude)
        ) {
          return null;
        }
        const distanceMeters = haversineMeters(
          query.latitude,
          query.longitude,
          latitude,
          longitude
        );
        if (!Number.isFinite(distanceMeters) || distanceMeters > maxDistanceMeters) return null;
        const point: LocationNearestPoint = {
          id: item.id,
          name: (item.data as { name?: string } | undefined)?.name,
          type: (item.data as { type?: string } | undefined)?.type,
          region: (item.data as { admin1?: string } | undefined)?.admin1,
          countryName: (item.data as { countryName?: string } | undefined)?.countryName,
          longitude,
          latitude,
          properties: item.data as unknown as Record<string, unknown>,
        };
        return { point, distanceMeters };
      })
      .filter((item): item is { point: LocationNearestPoint; distanceMeters: number } =>
        Boolean(item)
      )
      .sort((a, b) => a.distanceMeters - b.distanceMeters)
      .map((candidate) => ({
        point: candidate.point,
        distanceMeters: candidate.distanceMeters,
      }));

    return { cursor, matches };
  }
}
