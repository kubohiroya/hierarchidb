import type { ILocationDownloadStrategy } from '../types.js';
import type {
  LocationSearchConfig,
} from '../../../common/entities/LocationEntity.js';
import type { LocationPointProperties } from '../../../common/entities/LocationPoint.js';
import {
  mapType,
} from '../mappers.js';
import type { RawOverpassElement } from '../rawTypes.js';
import { buildOverpassPointProperties } from '../../pointFactories.js';

export class OverpassStrategy implements ILocationDownloadStrategy {
  readonly id = 'openstreetmap-overpass';

  supports(config: LocationSearchConfig): boolean {
    return config.dataSource === 'overpass';
  }

  async search(config: LocationSearchConfig): Promise<LocationPointProperties[]> {
    const endpoint = config.options?.overpassEndpoint || 'https://overpass-api.de/api/interpreter';
    const query = typeof config.options?.overpassQuery === 'string' ? config.options.overpassQuery : undefined;
    if (!query?.trim()) {
      // Keep it conservative: require explicit query for now
      return [];
    }
    try {
      const { authFetch } = await import('../../utils/authFetch.js');
      const res = await authFetch(endpoint, {
        method: 'POST',
        body: query,
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      });
      const data = await res.json();
      const elements = Array.isArray(data?.elements) ? data.elements as RawOverpassElement[] : [];
      return elements
        .map((item) => this.fromOverpass(item))
        .filter((value): value is LocationPointProperties => value !== null);
    } catch (e) {
      console.error('[Location][Strategy:Overpass] search failed', e);
      return [];
    }
  }

  private fromOverpass(overpassData: RawOverpassElement): LocationPointProperties | null {
    const lon = typeof overpassData.lon === 'number'
      ? overpassData.lon
      : overpassData.center?.lon;
    const lat = typeof overpassData.lat === 'number'
      ? overpassData.lat
      : overpassData.center?.lat;
    if (typeof lon !== 'number' || typeof lat !== 'number') return null;

    const tags = overpassData.tags ?? {};
    const primaryClass = this.detectClass(tags);
    const primaryType = this.detectType(tags);
    const mappedType = mapType(primaryType);
    const fetchedAt = Date.now();
    const point = buildOverpassPointProperties(
      overpassData,
      mappedType,
      lat,
      lon,
      fetchedAt,
    );
    return point;
  }

  private detectClass(tags: Record<string, string>): string | undefined {
    return tags.amenity
      ? 'amenity'
      : tags.aeroway
        ? 'aeroway'
        : tags.railway
          ? 'railway'
          : tags.highway
            ? 'highway'
            : tags.shop
              ? 'shop'
              : tags.tourism
                ? 'tourism'
                : tags.historic
                  ? 'historic'
                  : tags.leisure
                    ? 'leisure'
                    : tags.natural
                      ? 'natural'
                      : undefined;
  }

  private detectType(tags: Record<string, string>): string | undefined {
    return tags.amenity
      ?? tags.shop
      ?? tags.tourism
      ?? tags.leisure
      ?? tags.natural
      ?? tags.highway
      ?? tags.railway
      ?? tags.aeroway;
  }
}
