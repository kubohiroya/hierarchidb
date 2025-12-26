import type { ILocationDownloadStrategy } from '../types.js';
import type {
  LocationSearchConfig,
  LocationType,
} from '../../../common/entities/LocationEntity.js';
import type { LocationPointProperties } from '../../../common/entities/LocationPoint.js';
import { mapType, parseNumber } from '../mappers.js';
import type { RawNominatimResult } from '../rawTypes.js';
import { buildOsmPointProperties } from '../../pointFactories.js';

export class NominatimStrategy implements ILocationDownloadStrategy {
  readonly id = 'openstreetmap-nominatim';

  supports(config: LocationSearchConfig): boolean {
    return config.dataSource === 'openstreetmap';
  }

  async search(config: LocationSearchConfig): Promise<LocationPointProperties[]> {
    const endpoint = config.options?.nominatimEndpoint || 'https://nominatim.openstreetmap.org/search';
    const params = new URLSearchParams({
      q: config.query || '',
      format: 'json',
      limit: String(config.limit || 50),
      addressdetails: config.options?.addressDetails ? '1' : '0',
      extratags: config.options?.extraTags ? '1' : '0',
      namedetails: config.options?.nameDetails ? '1' : '0',
    });
    if (config.boundingBox) {
      params.append('viewbox', config.boundingBox.join(','));
      params.append('bounded', '1');
    }
    if (config.language) {
      params.append('accept-language', config.language);
    }
    try {
      const { authFetch } = await import('../../utils/authFetch.js');
      const response = await authFetch(`${endpoint}?${params}`);
      const data = await response.json();
      if (!Array.isArray(data)) return [];
      const points = data
        .map((item) => this.fromOSM(item as RawNominatimResult))
        .filter((value): value is LocationPointProperties => value !== null);
      return points;
    } catch (e) {
      console.error('[Location][Strategy:Nominatim] search failed', e);
      return [];
    }
  }

  private fromOSM(osmData: RawNominatimResult): LocationPointProperties | null {
    const lon = parseNumber(osmData.lon);
    const lat = parseNumber(osmData.lat);
    if (typeof lon !== 'number' || typeof lat !== 'number') return null;

    const type: LocationType = mapType(osmData.type);
    const fetchedAt = Date.now();
    const point = buildOsmPointProperties(
      osmData,
      type,
      lat,
      lon,
      fetchedAt,
    );
    return point;
  }
}
