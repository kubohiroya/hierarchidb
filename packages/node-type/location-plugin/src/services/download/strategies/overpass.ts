import type { ILocationDownloadStrategy } from '../types';
import type { LocationEntity, LocationSearchConfig } from '../../../entities/LocationEntity';

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
      const { authFetch } = await import('../../utils/authFetch');
      const res = await authFetch(endpoint, {
        method: 'POST',
        body: query,
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      });
      const data = await res.json();
      if (!data?.elements) return [];
      return (data.elements as any[]).map((item) => this.fromOverpass(item)).filter(Boolean) as LocationEntity[];
    } catch (e) {
      console.error('[Location][Strategy:Overpass] search failed', e);
      return [];
    }
  }

  private fromOverpass(overpassData: any): LocationEntity | null {
    const now = Date.now();
    const tags = overpassData.tags || {};
    const lon = overpassData.lon ?? (overpassData.center?.lon);
    const lat = overpassData.lat ?? (overpassData.center?.lat);
    if (typeof lon !== 'number' || typeof lat !== 'number') return null;
    return {
      id: `overpass-${overpassData.id}` as any,
      nodeId: `overpass-node-${overpassData.id}` as any,
      name: tags.name || 'Unknown',
      category: 'infrastructure' as any,
      type: 'park' as any,
      dataSource: 'overpass',
      point: { coordinates: [lon, lat], source: 'overpass', timestamp: now },
      attributes: { osmId: String(overpassData.id), osmType: overpassData.type, osmTags: tags },
      licenseAgreement: true,
      licenseAgreedAt: now,
      processingStatus: 'completed',
      processedAt: now,
      createdAt: now,
      updatedAt: now,
      version: 1,
      tags: [], metadata: {}, customFields: {}, childLocationIds: [], nearbyLocationIds: [], searchKeywords: [],
    } as LocationEntity;
  }
}

