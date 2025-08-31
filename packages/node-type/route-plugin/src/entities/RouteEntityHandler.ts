/**
 * @file RouteEntityHandler.ts
 * @description Route entity handler using common base classes
 */

import type { NodeId, EntityId } from '@hierarchidb/common-type';
import type { Collection } from 'dexie';
import { 
  BaseEntityHandler,
  type BaseSearchCriteria
} from '@hierarchidb/node-type-base-plugin';

/**
 * Metadata search criteria
 */
export interface MetadataSearchCriteria {
  metadata?: Record<string, any>;
}

import type { 
  RouteEntity,
  RouteWorkingCopy,
  RouteFilterCriteria,
  RouteGenerationConfig,
  RoutePoint,
  TransportMode,
  RouteGenerationMethod,
  RouteStatistics
} from './RouteEntity';
import { RouteDatabase } from '../database/RouteDatabase';
import { RouteGenerator } from '../services/RouteGenerator';
import { LocationResolver } from '../services/LocationResolver';

/**
 * Extended search criteria for routes
 */
export interface RouteSearchCriteria extends BaseSearchCriteria, MetadataSearchCriteria {
  transportModes?: TransportMode[];
  startLocationId?: NodeId;
  endLocationId?: NodeId;
  minDistance?: number;
  maxDistance?: number;
  generationMethod?: RouteGenerationMethod;
}

/**
 * Route entity handler with metadata support
 */
export class RouteEntityHandler extends BaseEntityHandler<any, any, any, any> {
  protected table: any;
  private routeDB: RouteDatabase;
  private routeGenerator: RouteGenerator;
  private locationResolver: LocationResolver;
  


  constructor() {
    super();
    this.routeDB = new RouteDatabase();
    this.table = this.routeDB.routes as any;
    this.routeGenerator = new RouteGenerator();
    this.locationResolver = new LocationResolver();
    
    // Initialize metadata handler

  }

  /**
   * Build route entity
   */
  protected buildEntity(
    nodeId: NodeId,
    entityId: EntityId,
    data: Partial<RouteEntity>
  ): RouteEntity {
    const now = Date.now();
    
    return {
      id: entityId,
      nodeId,
      name: data.name || 'New Route',
      description: data.description,
      category: data.category || { primary: 'road' },
      // Tags are managed by Folder plugin
      
      // Location references
      startLocationId: data.startLocationId,
      endLocationId: data.endLocationId,
      waypointLocationIds: data.waypointLocationIds || [],
      
      // Direct points
      startPoint: data.startPoint,
      endPoint: data.endPoint,
      waypoints: data.waypoints || [],
      
      // Route geometry (will be generated)
      lineGeometry: data.lineGeometry || [],
      generationMethod: data.generationMethod || 'direct',
      distance: data.distance,
      duration: data.duration,
      
      // Transport metadata
      transportMode: data.transportMode || 'road',
      operator: data.operator,
      routeNumber: data.routeNumber,
      frequency: data.frequency,
      
      // Data source
      dataSourceId: data.dataSourceId,
      dataSourceName: data.dataSourceName,
      originalData: data.originalData,
      
      // Processing
      processedAt: data.processedAt,
      processingStatus: data.processingStatus || 'pending',
      processingError: data.processingError,
      
      // Visualization
      style: data.style,
      
      // Relations
      parentRouteId: data.parentRouteId,
      childRouteIds: data.childRouteIds || [],
      relatedShapeId: data.relatedShapeId,
      
      // Metadata
      metadata: data.metadata || {},
      customFields: data.customFields || {},
      
      // Timestamps
      createdAt: data.createdAt || now,
      updatedAt: data.updatedAt || now,
      version: data.version || 1,
    };
  }

  /**
   * Create route entity with automatic geometry generation
   */
  async createEntity(nodeId: NodeId, data: Partial<RouteEntity>): Promise<RouteEntity> {
    // Resolve locations if IDs are provided
    if (data.startLocationId || data.endLocationId) {
      const resolved = await this.resolveLocations(data);
      data = { ...data, ...resolved };
    }
    
    // Generate route geometry if not provided
    if (!data.lineGeometry || data.lineGeometry.length === 0) {
      const geometry = await this.generateRoute(data);
      data.lineGeometry = geometry.lineGeometry;
      data.distance = geometry.distance;
      data.duration = geometry.duration;
      data.processingStatus = 'completed';
    }
    
    return super.createEntity(nodeId, data);
  }

  /**
   * Update route with geometry regeneration if needed
   */
  async updateEntity(entityId: EntityId, updates: Partial<RouteEntity>): Promise<RouteEntity> {
    const existing = await this.table.get(entityId);
    if (!existing) {
      throw new Error(`Route not found: ${entityId}`);
    }
    
    // Check if route needs regeneration
    const needsRegeneration = this.needsRouteRegeneration(existing, updates);
    
    if (needsRegeneration) {
      const merged = { ...existing, ...updates };
      const geometry = await this.generateRoute(merged);
      updates.lineGeometry = geometry.lineGeometry;
      updates.distance = geometry.distance;
      updates.duration = geometry.duration;
      updates.processedAt = Date.now();
      updates.processingStatus = 'completed';
    }
    
    return super.updateEntity(entityId, updates);
  }

  /**
   * Resolve location references to coordinates
   */
  private async resolveLocations(data: Partial<RouteEntity>): Promise<Partial<RouteEntity>> {
    const resolved: Partial<RouteEntity> = {};
    
    if (data.startLocationId && !data.startPoint) {
      const location = await this.locationResolver.getLocation(data.startLocationId);
      if (location) {
        resolved.startPoint = {
          coordinates: location.coordinates,
          name: location.name,
          type: 'location_ref',
          locationId: data.startLocationId,
        };
      }
    }
    
    if (data.endLocationId && !data.endPoint) {
      const location = await this.locationResolver.getLocation(data.endLocationId);
      if (location) {
        resolved.endPoint = {
          coordinates: location.coordinates,
          name: location.name,
          type: 'location_ref',
          locationId: data.endLocationId,
        };
      }
    }
    
    if (data.waypointLocationIds && data.waypointLocationIds.length > 0) {
      const waypoints: RoutePoint[] = [];
      for (const locationId of data.waypointLocationIds) {
        const location = await this.locationResolver.getLocation(locationId);
        if (location) {
          waypoints.push({
            coordinates: location.coordinates,
            name: location.name,
            type: 'location_ref',
            locationId,
          });
        }
      }
      if (waypoints.length > 0) {
        resolved.waypoints = waypoints;
      }
    }
    
    return resolved;
  }

  /**
   * Generate route geometry
   */
  private async generateRoute(data: Partial<RouteEntity>): Promise<{
    lineGeometry: [number, number][];
    distance?: number;
    duration?: number;
  }> {
    const config: RouteGenerationConfig = {
      method: data.generationMethod || 'direct',
      options: {},
    };
    
    // Extract points
    const points: [number, number][] = [];
    if (data.startPoint) {
      points.push(data.startPoint.coordinates);
    }
    if (data.waypoints) {
      points.push(...data.waypoints.map(w => w.coordinates));
    }
    if (data.endPoint) {
      points.push(data.endPoint.coordinates);
    }
    
    if (points.length < 2) {
      return { lineGeometry: [] };
    }
    
    return await this.routeGenerator.generate(points, config);
  }

  /**
   * Check if route needs regeneration
   */
  private needsRouteRegeneration(
    existing: RouteEntity,
    updates: Partial<RouteEntity>
  ): boolean {
    // Check if any location-related field has changed
    const locationFields: (keyof RouteEntity)[] = [
      'startLocationId',
      'endLocationId',
      'waypointLocationIds',
      'startPoint',
      'endPoint',
      'waypoints',
      'generationMethod',
    ];
    
    return locationFields.some(field => 
      updates[field] !== undefined && 
      JSON.stringify(updates[field]) !== JSON.stringify(existing[field])
    );
  }

  /**
   * Get routes by transport mode
   */
  async getRoutesByTransportMode(mode: TransportMode): Promise<RouteEntity[]> {
    return await this.table
      .where('transportMode')
      .equals(mode)
      .toArray();
  }

  /**
   * Get routes between locations
   */
  async getRoutesBetweenLocations(
    startLocationId: NodeId,
    endLocationId: NodeId
  ): Promise<RouteEntity[]> {
    return await this.table
      .filter(route => 
        route.startLocationId === startLocationId &&
        route.endLocationId === endLocationId
      )
      .toArray();
  }

  /**
   * Get connected routes from a location
   */
  async getConnectedRoutes(locationId: NodeId): Promise<{
    outgoing: RouteEntity[];
    incoming: RouteEntity[];
    passing: RouteEntity[];
  }> {
    const allRoutes = await this.table.toArray();
    
    const outgoing = allRoutes.filter(r => r.startLocationId === locationId);
    const incoming = allRoutes.filter(r => r.endLocationId === locationId);
    const passing = allRoutes.filter(r => 
      r.waypointLocationIds?.includes(locationId) || false
    );
    
    return { outgoing, incoming, passing };
  }

  /**
   * Get route statistics
   */
  async getStatistics(): Promise<RouteStatistics> {
    const routes = await this.table.toArray();
    
    const stats: RouteStatistics = {
      totalRoutes: routes.length,
      byTransportMode: {} as Record<TransportMode, number>,
      byGenerationMethod: {} as Record<RouteGenerationMethod, number>,
      totalDistance: 0,
      averageDistance: 0,
      connectedLocations: new Set<NodeId>(),
      processingStats: {
        pending: 0,
        processing: 0,
        completed: 0,
        failed: 0,
      },
    };
    
    for (const route of routes) {
      // Transport mode stats
      stats.byTransportMode[route.transportMode] = 
        (stats.byTransportMode[route.transportMode] || 0) + 1;
      
      // Generation method stats
      stats.byGenerationMethod[route.generationMethod] = 
        (stats.byGenerationMethod[route.generationMethod] || 0) + 1;
      
      // Distance stats
      if (route.distance) {
        stats.totalDistance += route.distance;
      }
      
      // Connected locations
      if (route.startLocationId) {
        (stats.connectedLocations as Set<NodeId>).add(route.startLocationId);
      }
      if (route.endLocationId) {
        (stats.connectedLocations as Set<NodeId>).add(route.endLocationId);
      }
      
      // Processing stats
      if (route.processingStatus) {
        stats.processingStats[route.processingStatus]++;
      }
    }
    
    stats.averageDistance = routes.length > 0 
      ? stats.totalDistance / routes.filter(r => r.distance).length 
      : 0;
    
    stats.connectedLocations = (stats.connectedLocations as Set<NodeId>).size;
    
    return stats;
  }

  /**
   * Batch generate routes
   */
  async batchGenerateRoutes(
    routeConfigs: Array<{
      nodeId: NodeId;
      data: Partial<RouteEntity>;
    }>
  ): Promise<RouteEntity[]> {
    const routes: RouteEntity[] = [];
    
    for (const config of routeConfigs) {
      try {
        const route = await this.createEntity(config.nodeId, config.data);
        routes.push(route);
      } catch (error) {
        console.error(`Failed to generate route: ${error}`);
        // Continue with other routes
      }
    }
    
    return routes;
  }

  /**
   * Apply additional search criteria
   */
  protected applyAdditionalSearchCriteria(
    query: Collection<RouteEntity>,
    criteria: RouteSearchCriteria
  ): Collection<RouteEntity> {
    if (criteria.transportModes && criteria.transportModes.length > 0) {
      query = query.filter(route => 
        criteria.transportModes!.includes(route.transportMode)
      );
    }
    
    if (criteria.startLocationId) {
      query = query.filter(route => 
        route.startLocationId === criteria.startLocationId
      );
    }
    
    if (criteria.endLocationId) {
      query = query.filter(route => 
        route.endLocationId === criteria.endLocationId
      );
    }
    
    if (criteria.minDistance !== undefined) {
      query = query.filter(route => 
        (route.distance || 0) >= criteria.minDistance!
      );
    }
    
    if (criteria.maxDistance !== undefined) {
      query = query.filter(route => 
        (route.distance || 0) <= criteria.maxDistance!
      );
    }
    
    if (criteria.generationMethod) {
      query = query.filter(route => 
        route.generationMethod === criteria.generationMethod
      );
    }
    
    return query;
  }

  /**
   * Clean up route-specific data
   */
  protected async cleanupEntityData(entity: RouteEntity): Promise<void> {
    // Clean up any cached route data
    await this.routeDB.cleanupRouteCache(entity.id);
  }
}

