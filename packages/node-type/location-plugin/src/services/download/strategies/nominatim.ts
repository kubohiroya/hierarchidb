import type { ILocationDownloadStrategy } from '../types';
import type { LocationSearchConfig, LocationEntity } from '../../../entities/LocationEntity';

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
      const { authFetch } = await import('../../utils/authFetch');
      const response = await authFetch(`${endpoint}?${params}`);
      const data = await response.json();
      return (data as any[]).map((osm) => this.fromOSM(osm));
    } catch (e) {
      console.error('[Location][Strategy:Nominatim] search failed', e);
      return [];
    }
  }

  private fromOSM(osmData: any): LocationEntity {
    const now = Date.now();
    return {
      id: `osm-${osmData.osm_id}` as any,
      nodeId: `osm-node-${osmData.osm_id}` as any,
      name: osmData.display_name || 'Unknown',
      category: this.detectCategory(osmData.class),
      type: this.detectType(osmData.type),
      dataSource: 'openstreetmap',
      point: {
        coordinates: [parseFloat(osmData.lon), parseFloat(osmData.lat)],
        source: 'openstreetmap',
        timestamp: now,
      },
      boundingBox: osmData.boundingbox ? osmData.boundingbox.map((v: string) => parseFloat(v)) as [number, number, number, number] : undefined,
      address: osmData.address ? {
        street: osmData.address.road,
        houseNumber: osmData.address.house_number,
        postcode: osmData.address.postcode,
        city: osmData.address.city || osmData.address.town || osmData.address.village,
        district: osmData.address.suburb,
        state: osmData.address.state,
        country: osmData.address.country,
        countryCode: osmData.address.country_code?.toUpperCase(),
      } : undefined,
      attributes: {
        osmId: osmData.osm_id,
        osmType: osmData.osm_type,
        osmTags: osmData.extratags || {},
      },
      licenseAgreement: true,
      licenseAgreedAt: now,
      processingStatus: 'completed',
      processedAt: now,
      importance: parseFloat(osmData.importance) || 0.5,
      createdAt: now,
      updatedAt: now,
      version: 1,
      tags: [],
      metadata: {},
      customFields: {},
      childLocationIds: [],
      nearbyLocationIds: [],
      searchKeywords: [],
    } as LocationEntity;
  }

  private detectCategory(osmClass?: string): any {
    const map: Record<string, string> = {
      amenity: 'infrastructure',
      aeroway: 'transportation',
      railway: 'transportation',
      highway: 'transportation',
      place: 'administrative',
      shop: 'commercial',
      tourism: 'leisure',
      historic: 'cultural',
      leisure: 'leisure',
      natural: 'natural',
      office: 'administrative',
    };
    return (map[osmClass || ''] || 'infrastructure') as any;
  }

  private detectType(osmType?: string): any {
    const map: Record<string, string> = {
      aerodrome: 'airport',
      railway: 'railway_station',
      bus_station: 'bus_stop',
      harbour: 'port',
      hospital: 'hospital',
      clinic: 'clinic',
      pharmacy: 'pharmacy',
      school: 'school',
      university: 'university',
      library: 'library',
      mall: 'shopping_mall',
      supermarket: 'supermarket',
      restaurant: 'restaurant',
      hotel: 'hotel',
      bank: 'bank',
      museum: 'museum',
      theatre: 'theater',
      monument: 'monument',
      park: 'park',
      stadium: 'stadium',
      beach: 'beach',
      peak: 'mountain',
      water: 'lake',
      river: 'river',
    };
    return (map[osmType || ''] || 'park') as any;
  }
}

