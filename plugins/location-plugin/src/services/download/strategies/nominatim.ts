import type { ILocationDownloadStrategy } from '../types.js';
import type {
  LocationEntity,
  LocationSearchConfig,
  LocationCategory,
  LocationType,
} from '../../../common/entities/LocationEntity.js';
import {
  buildLocationEntity,
  mapCategory,
  mapType,
  normalizeImportance,
  normalizeOsmType,
  parseBoundingBox,
  parseNumber,
  sanitizeTags,
} from '../mappers.js';
import type { RawNominatimResult } from '../rawTypes.js';
import { buildOsmPointProperties } from '../../pointFactories.js';
import { appendLocationPoints } from '../../pointRepository.js';

export class NominatimStrategy implements ILocationDownloadStrategy {
  readonly id = 'openstreetmap-nominatim';

  supports(config: LocationSearchConfig): boolean {
    return config.dataSource === 'openstreetmap';
  }

  async search(config: LocationSearchConfig): Promise<LocationEntity[]> {
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
      const entities = data
        .map((item) => this.fromOSM(item as RawNominatimResult))
        .filter((value): value is LocationEntity => value !== null);
      return entities;
    } catch (e) {
      console.error('[Location][Strategy:Nominatim] search failed', e);
      return [];
    }
  }

  private fromOSM(osmData: RawNominatimResult): LocationEntity | null {
    const lon = parseNumber(osmData.lon);
    const lat = parseNumber(osmData.lat);
    if (typeof lon !== 'number' || typeof lat !== 'number') return null;

    const address = osmData.address
      ? {
          street: osmData.address.road,
          houseNumber: osmData.address.house_number,
          postcode: osmData.address.postcode,
          city: osmData.address.city || osmData.address.town || osmData.address.village,
          district: osmData.address.suburb,
          state: osmData.address.state,
          country: osmData.address.country,
          countryCode: osmData.address.country_code?.toUpperCase(),
        }
      : undefined;

    const attributes = {
      osmId: String(osmData.osm_id),
      osmType: normalizeOsmType(osmData.osm_type),
      osmTags: sanitizeTags(osmData.extratags),
    };

    const category: LocationCategory = mapCategory(osmData.class);
    const type: LocationType = mapType(osmData.type);
    const fetchedAt = Date.now();
    const point = buildOsmPointProperties(
      osmData,
      type,
      lat,
      lon,
      fetchedAt,
    );

    const entity = buildLocationEntity({
      prefix: 'osm',
      rawId: osmData.osm_id,
      name: osmData.display_name || 'Unknown',
      category,
      type,
      dataSource: 'openstreetmap',
      attributes,
      boundingBox: parseBoundingBox(osmData.boundingbox),
      address,
      importance: normalizeImportance(osmData.importance, 0.5),
    });
    void appendLocationPoints(entity.nodeId, [point]).catch((err) => {
      console.warn('[Location][Nominatim] failed to persist point', err);
    });
    return entity;
  }
}
