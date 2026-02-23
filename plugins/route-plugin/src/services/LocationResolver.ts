/**
 * @file LocationResolver.ts
 * @description Service for resolving Location plugin references
 */

import type { NodeId } from '@hierarchidb/core-types';
import { getLocationDB } from '@hierarchidb/location-store';
import type { LocationFeatureId, LocationPointId } from '@hierarchidb/location-api';

type LocationIdLike = string | NodeId | LocationFeatureId | LocationPointId;

type LocationFeatureData = {
  name: string;
  latitude?: number;
  longitude?: number;
  pointId?: string;
  type?: string;
  metadata?: Record<string, string | number | null>;
};

type LocationFeatureRecord = {
  id: string;
  nodeId: NodeId;
  type: string;
  data: LocationFeatureData;
};

type LocationFeatureTable = {
  where(key: 'nodeId'): {
    equals(nodeId: string): {
      toArray: () => Promise<LocationFeatureRecord[]>;
    };
  };
  toArray: () => Promise<LocationFeatureRecord[]>;
};

type LocationResolverDBLike = {
  open?: () => Promise<unknown>;
  features: LocationFeatureTable;
};

export type LocationResolverDeps = {
  db?: LocationResolverDBLike;
};

/**
 * Location data from Location plugin
 */
export interface LocationData {
  nodeId: NodeId;
  name: string;
  coordinates: [number, number];
  type?: string;
  metadata?: Record<string, string | number | null>;
}

const normalizeSearchKey = (value: unknown): string => String(value ?? '').trim().toLowerCase();
const trimString = (value?: string): string | undefined => value?.trim();
const hasFiniteCoordinate = (value: unknown): value is number => typeof value === 'number' && Number.isFinite(value);
/**
 * Location resolver service
 * Interfaces with Location plugin to resolve location references
 */
export class LocationResolver {
  private locationCache = new Map<string, LocationData>();
  private readonly db: LocationResolverDBLike;

  constructor(deps: LocationResolverDeps = {}) {
    this.db = deps.db ?? getLocationDB();
  }

  /**
   * Get location data by node ID
   */
  async getLocation(locationId: LocationIdLike): Promise<LocationData | null> {
    const cacheKey = String(locationId);
    const cached = this.locationCache.get(cacheKey);
    if (cached) {
      return cached;
    }

    try {
      await this.db.open?.();
      const byNodeId = await this.db.features.where('nodeId').equals(cacheKey).toArray();
      const directMatch = byNodeId.find((item) => item.nodeId === cacheKey);
      if (directMatch) {
        const location = toLocationData(directMatch.id, directMatch.data);
        if (location) {
          this.locationCache.set(cacheKey, location);
        }
        return location;
      }

      const pointIdMatch = byNodeId.find((item) => item.data.pointId === cacheKey);
      if (pointIdMatch) {
        const location = toLocationData(pointIdMatch.id, pointIdMatch.data);
        if (location) {
          this.locationCache.set(cacheKey, location);
        }
        return location;
      }

      const location = await this.fetchLocationByFallbackKey(locationId);
      if (location) {
        this.locationCache.set(cacheKey, location);
      }
      return location;
    } catch (error) {
      console.error(`Failed to resolve location ${locationId}:`, error);
      return null;
    }
  }

  /**
   * Get multiple locations
   */
  async getLocations(locationIds: NodeId[]): Promise<Map<NodeId, LocationData>> {
    const locations = new Map<NodeId, LocationData>();

    for (const id of locationIds) {
      const location = await this.getLocation(id);
      if (location) {
        locations.set(id, location);
      }
    }

    return locations;
  }

  /**
   * Search locations by criteria
   */
  async searchLocations(_criteria: {
    name?: string;
    type?: string;
    bounds?: [[number, number], [number, number]];
  }): Promise<LocationData[]> {
    try {
      const criteria = normalizeCriteria(_criteria);
      await this.db.open?.();
      const all = await this.db.features.toArray();
      const matches = all
        .filter((feature) => matchesLocationCriteria(feature, criteria));
      return matches
        .map((feature) => toLocationData(feature.id, feature.data))
        .filter((feature): feature is LocationData => feature !== null);
    } catch (error) {
      console.error('Failed to search locations:', error);
      return [];
    }
  }

  /**
   * Clear location cache
   */
  clearCache(): void {
    this.locationCache.clear();
  }

  private async fetchLocationByFallbackKey(locationId: LocationIdLike): Promise<LocationData | null> {
    const key = normalizeSearchKey(locationId);
    if (!key) return null;
    const all = await this.db.features.toArray();

    const exactMatch = all.find((item) => (
      normalizeSearchKey(item.nodeId) === key
      || normalizeSearchKey(item.id) === key
      || normalizeSearchKey(item.data.pointId) === key
      || normalizeSearchKey(item.type) === key
    ));
    if (exactMatch) {
      return toLocationData(exactMatch.id, exactMatch.data);
    }

    const partialMatch = all.find((item) => (
      item.data.name.toLowerCase().includes(key)
      || (item.data.pointId?.toLowerCase().includes(key) ?? false)
      || item.type.toLowerCase().includes(key)
    ));
    if (!partialMatch) return null;

    return toLocationData(partialMatch.id, partialMatch.data);
  }
}

type SearchCriteria = {
  name?: string;
  type?: string;
  minLon?: number;
  minLat?: number;
  maxLon?: number;
  maxLat?: number;
};

function normalizeCriteria(criteria: {
  name?: string;
  type?: string;
  bounds?: [[number, number], [number, number]];
}): SearchCriteria {
  const rawBounds = criteria.bounds;
  const normalizedName = trimString(criteria.name)?.toLowerCase();
  const normalizedType = trimString(criteria.type)?.toLowerCase();

  if (!rawBounds) {
    return {
      name: normalizedName,
      type: normalizedType,
    };
  }

  const [[minLon, minLat], [maxLon, maxLat]] = rawBounds;
  return {
    name: normalizedName,
    type: normalizedType,
    minLon: typeof minLon === 'number' && Number.isFinite(minLon) ? minLon : undefined,
    minLat: typeof minLat === 'number' && Number.isFinite(minLat) ? minLat : undefined,
    maxLon: typeof maxLon === 'number' && Number.isFinite(maxLon) ? maxLon : undefined,
    maxLat: typeof maxLat === 'number' && Number.isFinite(maxLat) ? maxLat : undefined,
  };
}

function matchesLocationCriteria(
  feature: {
    id: string;
    type: string;
    data: LocationFeatureData;
  },
  criteria: SearchCriteria,
): boolean {
  if (criteria.name && !feature.data.name.toLowerCase().includes(criteria.name)) return false;
  if (criteria.type && feature.type.toLowerCase() !== criteria.type && feature.data.type?.toLowerCase() !== criteria.type) {
    return false;
  }

  const featureLon = feature.data.longitude;
  const featureLat = feature.data.latitude;

  if (criteria.minLon !== undefined && (!hasFiniteCoordinate(featureLon) || featureLon < criteria.minLon)) return false;
  if (criteria.maxLon !== undefined && (!hasFiniteCoordinate(featureLon) || featureLon > criteria.maxLon)) return false;
  if (criteria.minLat !== undefined && (!hasFiniteCoordinate(featureLat) || featureLat < criteria.minLat)) return false;
  if (criteria.maxLat !== undefined && (!hasFiniteCoordinate(featureLat) || featureLat > criteria.maxLat)) return false;

  if (!hasFiniteCoordinate(featureLon) || !hasFiniteCoordinate(featureLat)) return false;
  return true;
}

function toLocationData(locationId: LocationIdLike, data: LocationFeatureData): LocationData | null {
  const latitude = Number(data.latitude);
  const longitude = Number(data.longitude);
  if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) {
    return null;
  }
  return {
    nodeId: String(locationId) as NodeId,
    name: data.name,
    coordinates: [longitude, latitude],
    type: data.type,
    metadata: data.metadata,
  };
}
