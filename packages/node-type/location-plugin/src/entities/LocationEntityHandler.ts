/**
 * @file LocationEntityHandler.ts
 * @description Location entity handler extending metadata base handler
 */

import type { Table } from 'dexie';
import type { NodeId, EntityId } from '@hierarchidb/common-type';
import { MetadataEntityHandler } from '@hierarchidb/common-plugin-base';
import type {
  LocationEntity,
  LocationWorkingCopy,
  LocationFilterCriteria,
  LocationPoint,
  LocationCategory,
  LocationType,
} from './LocationEntity';

/**
 * Create location data interface
 */
export interface CreateLocationData extends Partial<LocationEntity> {
  name: string;
  category: LocationCategory;
  type: LocationType;
  dataSource: any; // LocationDataSource type from LocationEntity
  point?: LocationPoint;
}

/**
 * Location entity handler with full CRUD operations
 */
export class LocationEntityHandler extends MetadataEntityHandler<
  LocationEntity,
  LocationWorkingCopy,
  CreateLocationData,
  LocationFilterCriteria
> {
  protected table: Table<LocationEntity, EntityId>;

  constructor(table: Table<LocationEntity, EntityId>) {
    super();
    this.table = table;
  }

  /**
   * Build location entity from data
   */
  protected buildEntity(
    nodeId: NodeId,
    entityId: EntityId,
    data: CreateLocationData
  ): LocationEntity {
    const now = Date.now();
    
    // Default point if not provided
    const defaultPoint: LocationPoint = {
      coordinates: [0, 0],
      source: data.dataSource,
      timestamp: now,
    };

    const entity: LocationEntity = {
      // Base entity fields
      id: entityId,
      nodeId,
      createdAt: now,
      updatedAt: now,
      version: 1,

      // Required location fields
      name: data.name,
      category: data.category,
      type: data.type,
      dataSource: data.dataSource,
      point: data.point || defaultPoint,
      licenseAgreement: data.licenseAgreement || false,

      // Optional fields with defaults
      description: data.description,
      tags: data.tags || [],
      metadata: data.metadata || {},
      customFields: data.customFields || {},

      // Geographic information
      boundingBox: data.boundingBox,
      area: data.area,
      perimeter: data.perimeter,

      // Address information
      address: data.address,

      // Data source information
      dataSourceId: data.dataSourceId,
      attributes: data.attributes,
      licenseAgreedAt: data.licenseAgreedAt,

      // Relations
      parentLocationId: data.parentLocationId,
      childLocationIds: data.childLocationIds || [],
      nearbyLocationIds: data.nearbyLocationIds || [],
      relatedShapeId: data.relatedShapeId,
      isShapeAnchor: data.isShapeAnchor || false,

      // Processing metadata
      processedAt: data.processedAt,
      processingStatus: data.processingStatus || 'pending',
      processingError: data.processingError,
      geocodingConfidence: data.geocodingConfidence,

      // Visualization
      icon: data.icon || {
        type: 'marker',
        color: '#1976d2',
        size: 24,
      },

      // Clustering
      clusterGroup: data.clusterGroup,
      clusterPriority: data.clusterPriority || 0,

      // Search and filtering
      searchKeywords: data.searchKeywords || [],
      importance: data.importance || 0.5,
      visibility: data.visibility,
    };

    return entity;
  }

  /**
   * Create working copy from existing entity
   */
  async createWorkingCopy(entity: LocationEntity): Promise<LocationWorkingCopy> {
    const workingCopy: LocationWorkingCopy = {
      ...entity,
      isDraft: false,
      copiedAt: Date.now(),
      originalVersion: entity.version,
      modifiedFields: [],
    };

    return workingCopy;
  }

  /**
   * Create new draft working copy
   */
  async createNewDraftWorkingCopy(nodeId?: NodeId): Promise<LocationWorkingCopy> {
    const entityId = 'draft-location' as EntityId;
    const now = Date.now();

    const workingCopy: LocationWorkingCopy = {
      // Base entity fields
      id: entityId,
      nodeId: nodeId || ('new-location' as NodeId),
      createdAt: now,
      updatedAt: now,
      version: 1,

      // Required location fields
      name: '',
      category: 'infrastructure',
      type: 'airport',
      dataSource: 'openstreetmap',
      point: {
        coordinates: [0, 0],
        source: 'manual',
        timestamp: now,
      },
      licenseAgreement: false,

      // Working copy specific
      isDraft: true,
      copiedAt: now,
      originalVersion: 0,
      modifiedFields: [],

      // UI state
      selectedCountries: [],
      selectedTypes: [],
      checkboxState: {},
      searchRadius: 1000, // 1km default
      maxResults: 100,

      // Default empty arrays/objects
      tags: [],
      metadata: {},
      customFields: {},
      childLocationIds: [],
      nearbyLocationIds: [],
      searchKeywords: [],
    };

    return workingCopy;
  }

  /**
   * Cleanup related data when location is deleted
   */
  protected async cleanupEntityData(entity: LocationEntity): Promise<void> {
    // Clean up child locations references
    if (entity.childLocationIds && entity.childLocationIds.length > 0) {
      for (const childId of entity.childLocationIds) {
        const child = await super.getEntityByNodeId(childId);
        if (child) {
          await super.updateEntity(child.id, {
            parentLocationId: undefined,
          });
        }
      }
    }

    // Clean up parent reference
    if (entity.parentLocationId) {
      const parent = await super.getEntityByNodeId(entity.parentLocationId);
      if (parent && parent.childLocationIds) {
        const updatedChildren = parent.childLocationIds.filter(
          (id: NodeId) => id !== entity.nodeId
        );
        await super.updateEntity(parent.id, {
          childLocationIds: updatedChildren,
        });
      }
    }

    // Clean up nearby locations references
    if (entity.nearbyLocationIds && entity.nearbyLocationIds.length > 0) {
      for (const nearbyId of entity.nearbyLocationIds) {
        const nearby = await super.getEntityByNodeId(nearbyId);
        if (nearby && nearby.nearbyLocationIds) {
          const updatedNearby = nearby.nearbyLocationIds.filter(
            (id: NodeId) => id !== entity.nodeId
          );
          await super.updateEntity(nearby.id, {
            nearbyLocationIds: updatedNearby,
          });
        }
      }
    }
  }

  /**
   * Apply additional search criteria for locations
   */
  protected applyAdditionalSearchCriteria(
    query: any,
    criteria: LocationFilterCriteria
  ): any {
    // Apply parent class criteria first
    query = super.applyAdditionalSearchCriteria(query, criteria);

    // Apply location-specific criteria
    if (criteria.categories && criteria.categories.length > 0) {
      query = query.filter((entity: LocationEntity) =>
        criteria.categories!.includes(entity.category)
      );
    }

    if (criteria.types && criteria.types.length > 0) {
      query = query.filter((entity: LocationEntity) =>
        criteria.types!.includes(entity.type)
      );
    }

    if (criteria.dataSources && criteria.dataSources.length > 0) {
      query = query.filter((entity: LocationEntity) =>
        criteria.dataSources!.includes(entity.dataSource)
      );
    }

    if (criteria.countries && criteria.countries.length > 0) {
      query = query.filter((entity: LocationEntity) =>
        entity.address?.countryCode &&
        criteria.countries!.includes(entity.address.countryCode)
      );
    }

    if (criteria.cities && criteria.cities.length > 0) {
      query = query.filter((entity: LocationEntity) =>
        entity.address?.city &&
        criteria.cities!.includes(entity.address.city)
      );
    }

    if (criteria.boundingBox) {
      const [minLon, minLat, maxLon, maxLat] = criteria.boundingBox;
      query = query.filter((entity: LocationEntity) => {
        const [lon, lat] = entity.point.coordinates;
        return lon >= minLon && lon <= maxLon && lat >= minLat && lat <= maxLat;
      });
    }

    if (criteria.nearPoint) {
      const { coordinates, radius } = criteria.nearPoint;
      query = query.filter((entity: LocationEntity) => {
        const distance = this.calculateDistance(
          coordinates,
          entity.point.coordinates
        );
        return distance <= radius;
      });
    }

    if (criteria.minImportance !== undefined) {
      query = query.filter((entity: LocationEntity) =>
        (entity.importance || 0) >= criteria.minImportance!
      );
    }

    if (criteria.hasAddress !== undefined) {
      query = query.filter((entity: LocationEntity) => {
        const hasAddress = entity.address && Object.keys(entity.address).length > 0;
        return hasAddress === criteria.hasAddress;
      });
    }

    if (criteria.hasAttributes !== undefined) {
      query = query.filter((entity: LocationEntity) => {
        const hasAttributes = entity.attributes && Object.keys(entity.attributes).length > 0;
        return hasAttributes === criteria.hasAttributes;
      });
    }

    if (criteria.parentLocationId) {
      query = query.filter((entity: LocationEntity) =>
        entity.parentLocationId === criteria.parentLocationId
      );
    }

    if (criteria.processingStatus) {
      query = query.filter((entity: LocationEntity) =>
        entity.processingStatus === criteria.processingStatus
      );
    }

    return query;
  }

  /**
   * Search locations by proximity
   */
  async searchByProximity(
    center: [number, number],
    radius: number,
    limit?: number
  ): Promise<LocationEntity[]> {
    try {
      const locations = await this.table.toArray();
      
      // Calculate distances and sort
      const locationsWithDistance = locations
        .map((location: LocationEntity) => ({
          location,
          distance: this.calculateDistance(center, location.point.coordinates),
        }))
        .filter((item: any) => item.distance <= radius)
        .sort((a: any, b: any) => a.distance - b.distance);

      // Apply limit if specified
      const results = limit
        ? locationsWithDistance.slice(0, limit)
        : locationsWithDistance;

      return results.map((item: any) => item.location);
    } catch (error) {
      console.error('Failed to search by proximity:', error);
      throw error;
    }
  }

  /**
   * Get locations by category
   */
  async getLocationsByCategory(category: LocationCategory): Promise<LocationEntity[]> {
    try {
      return await this.table
        .where('category')
        .equals(category)
        .toArray();
    } catch (error) {
      console.error('Failed to get locations by category:', error);
      throw error;
    }
  }

  /**
   * Get locations by type
   */
  async getLocationsByType(type: LocationType): Promise<LocationEntity[]> {
    try {
      return await this.table
        .where('type')
        .equals(type)
        .toArray();
    } catch (error) {
      console.error('Failed to get locations by type:', error);
      throw error;
    }
  }

  /**
   * Get child locations
   */
  async getChildLocations(parentNodeId: NodeId): Promise<LocationEntity[]> {
    try {
      return await this.table
        .where('parentLocationId')
        .equals(parentNodeId)
        .toArray();
    } catch (error) {
      console.error('Failed to get child locations:', error);
      throw error;
    }
  }

  /**
   * Update location coordinates
   */
  async updateLocationPoint(
    entityId: EntityId,
    point: LocationPoint
  ): Promise<LocationEntity> {
    try {
      return await super.updateEntity(entityId, {
        point,
        updatedAt: Date.now(),
      });
    } catch (error) {
      console.error('Failed to update location point:', error);
      throw error;
    }
  }

  /**
   * Update processing status
   */
  async updateProcessingStatus(
    entityId: EntityId,
    status: 'pending' | 'processing' | 'completed' | 'failed',
    error?: string
  ): Promise<void> {
    try {
      const updates: Partial<LocationEntity> = {
        processingStatus: status,
        processedAt: Date.now(),
      };

      if (error) {
        updates.processingError = error;
      }

      await super.updateEntity(entityId, updates);
    } catch (error) {
      console.error('Failed to update processing status:', error);
      throw error;
    }
  }

  /**
   * Calculate distance between two points (Haversine formula)
   */
  private calculateDistance(
    point1: [number, number],
    point2: [number, number]
  ): number {
    const R = 6371000; // Earth radius in meters
    const φ1 = (point1[1] * Math.PI) / 180;
    const φ2 = (point2[1] * Math.PI) / 180;
    const Δφ = ((point2[1] - point1[1]) * Math.PI) / 180;
    const Δλ = ((point2[0] - point1[0]) * Math.PI) / 180;

    const a =
      Math.sin(Δφ / 2) * Math.sin(Δφ / 2) +
      Math.cos(φ1) * Math.cos(φ2) * Math.sin(Δλ / 2) * Math.sin(Δλ / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

    return R * c;
  }

  /**
   * Geocode address to coordinates
   */
  async geocodeAddress(address: string): Promise<LocationPoint | null> {
    // This would typically call an external geocoding service
    // For now, return null as placeholder
    console.log('Geocoding address:', address);
    return null;
  }

  /**
   * Reverse geocode coordinates to address
   */
  async reverseGeocode(coordinates: [number, number]): Promise<any | null> {
    // This would typically call an external reverse geocoding service
    // For now, return null as placeholder
    console.log('Reverse geocoding:', coordinates);
    return null;
  }
}