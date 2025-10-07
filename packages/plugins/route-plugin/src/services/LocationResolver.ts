/**
 * @file LocationResolver.ts
 * @description Service for resolving Location plugin references
 */

import type { NodeId } from '@hierarchidb/common-types';

/**
 * Location data from Location plugin
 */
export interface LocationData {
  nodeId: NodeId;
  name: string;
  coordinates: [number, number];
  type?: string;
  metadata?: Record<string, any>;
}

/**
 * Location resolver service
 * Interfaces with Location plugin to resolve location references
 */
export class LocationResolver {
  private locationCache = new Map<NodeId, LocationData>();

  /**
   * Get location data by node ID
   */
  async getLocation(locationId: NodeId): Promise<LocationData | null> {
    // Check cache first
    if (this.locationCache.has(locationId)) {
      return this.locationCache.get(locationId)!;
    }

    try {
      // In real implementation, this would call Location plugin API
      // For now, return mock data
      const location = await this.fetchLocationFromPlugin(locationId);

      if (location) {
        this.locationCache.set(locationId, location);
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
    // In real implementation, this would query Location plugin
    // For now, return empty array
    return [];
  }

  /**
   * Clear location cache
   */
  clearCache(): void {
    this.locationCache.clear();
  }

  /**
   * Mock implementation - would be replaced with actual Location plugin API call
   */
  private async fetchLocationFromPlugin(locationId: NodeId): Promise<LocationData | null> {
    // This would actually call:
    // const locationAPI = await getWorkerAPI().getLocationAPI();
    // return await locationAPI.getLocation(locationId);

    // Mock data for development
    const mockLocations: Record<string, LocationData> = {
      'loc_tokyo': {
        nodeId: 'loc_tokyo' as NodeId,
        name: 'Tokyo',
        coordinates: [139.6917, 35.6895],
        type: 'city',
      },
      'loc_osaka': {
        nodeId: 'loc_osaka' as NodeId,
        name: 'Osaka',
        coordinates: [135.5023, 34.6937],
        type: 'city',
      },
      'loc_kyoto': {
        nodeId: 'loc_kyoto' as NodeId,
        name: 'Kyoto',
        coordinates: [135.7681, 35.0116],
        type: 'city',
      },
    };

    return mockLocations[locationId] || null;
  }
}
