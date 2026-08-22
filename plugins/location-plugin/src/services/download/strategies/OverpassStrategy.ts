import type { LocationSearchConfig } from '~/common/entities/LocationEntity';
import type { LocationPointProperties } from '~/common/entities/LocationPoint';
import { mapType } from '~/services/download/mapperUtils';
import type { RawOverpassElement } from '~/services/download/rawTypes';
import type { ILocationDownloadStrategy } from '~/services/download/types';
import { buildOverpassPointProperties } from '~/services/pointFactoryUtils';

export class OverpassStrategy implements ILocationDownloadStrategy {
  readonly id = 'openstreetmap-overpass';

  supports(config: LocationSearchConfig): boolean {
    return config.dataSource === 'overpass';
  }

  async search(config: LocationSearchConfig): Promise<LocationPointProperties[]> {
    const endpoint = config.options?.overpassEndpoint || 'https://overpass-api.de/api/interpreter';
    const query =
      typeof config.options?.overpassQuery === 'string' ? config.options.overpassQuery : undefined;
    if (!query?.trim()) {
      // Keep it conservative: require explicit query for now
      return [];
    }
    try {
      const { authFetch } = await import('@hierarchidb/download');
      const res = await authFetch('location', endpoint, {
        method: 'POST',
        body: query,
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      });
      const data = await res.json();
      const elements = Array.isArray(data?.elements) ? (data.elements as RawOverpassElement[]) : [];
      const points = await Promise.all(elements.map((item) => this.fromOverpass(item)));
      return points.filter((value): value is LocationPointProperties => value !== null);
    } catch (e) {
      console.error('[Location][Strategy:Overpass] search failed', e);
      return [];
    }
  }

  private async fromOverpass(
    overpassData: RawOverpassElement
  ): Promise<LocationPointProperties | null> {
    const lon = typeof overpassData.lon === 'number' ? overpassData.lon : overpassData.center?.lon;
    const lat = typeof overpassData.lat === 'number' ? overpassData.lat : overpassData.center?.lat;
    if (typeof lon !== 'number' || typeof lat !== 'number') return null;

    const tags = overpassData.tags ?? {};
    const primaryType = this.detectType(tags);
    const mappedType = mapType(primaryType);
    const fetchedAt = Date.now();
    const point = await buildOverpassPointProperties(overpassData, mappedType, lat, lon, fetchedAt);
    return point;
  }

  private detectType(tags: Record<string, string>): string | undefined {
    return (
      tags.amenity ??
      tags.shop ??
      tags.tourism ??
      tags.leisure ??
      tags.natural ??
      tags.highway ??
      tags.railway ??
      tags.aeroway
    );
  }
}
