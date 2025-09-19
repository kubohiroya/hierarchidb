import type { ILocationDownloadStrategy } from '../types.js';
import type {
  LocationEntity,
  LocationSearchConfig,
} from '../../../entities/LocationEntity.js';
import {
  buildLocationEntity,
  createPoint,
  mapCategory,
  mapType,
  normalizeImportance,
  normalizeOsmType,
  sanitizeTags,
} from '../mappers.js';

interface RawOverpassElement {
  id: number | string;
  type: string;
  lon?: number;
  lat?: number;
  center?: { lon?: number; lat?: number };
  tags?: Record<string, string>;
}

export class OverpassStrategy implements ILocationDownloadStrategy {
  readonly id = 'openstreetmap-overpass';

  supports(config: LocationSearchConfig): boolean {
    return config.dataSource === 'overpass';
  }

  async search(config: LocationSearchConfig): Promise<LocationEntity[]> {
    const endpoint = config.options?.overpassEndpoint || 'https://overpass-api.de/api/interpreter';
    const query = config.options?.overpassQuery;
    if (!query) {
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
        .filter((value): value is LocationEntity => value !== null);
    } catch (e) {
      console.error('[Location][Strategy:Overpass] search failed', e);
      return [];
    }
  }

  private fromOverpass(overpassData: RawOverpassElement): LocationEntity | null {
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

    return buildLocationEntity({
      prefix: 'overpass',
      rawId: overpassData.id,
      name: tags.name || 'Unknown',
      category: mapCategory(primaryClass),
      type: mapType(primaryType),
      dataSource: 'overpass',
      point: createPoint(lon, lat, 'overpass', Date.now()),
      attributes: {
        osmId: String(overpassData.id),
        osmType: normalizeOsmType(overpassData.type),
        osmTags: sanitizeTags(tags),
      },
      metadata: { source: 'overpass' },
      importance: normalizeImportance(tags.importance),
    });
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
