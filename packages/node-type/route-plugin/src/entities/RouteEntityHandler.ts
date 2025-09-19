/**
 * @file RouteEntityHandler.ts
 * @description Route entity handler using common base classes
 */

import type { NodeId } from '@hierarchidb/common-type';
import type { Table } from 'dexie';
import { BaseEntityHandler, type BaseSearchCriteria } from '@hierarchidb/base-plugin';
import type {
  RouteEntity,
  RouteGenerationConfig,
  RouteGenerationMethod,
  RoutePoint,
  RouteStatistics,
  TransportMode,
} from './RouteEntity';
import { RouteDatabase } from '../database/RouteDatabase';
import { RouteGenerator } from '../services/RouteGenerator';
import { LocationResolver } from '../services/LocationResolver';

/**
 * Metadata search criteria
 */
export interface MetadataSearchCriteria {
  metadata?: Record<string, any>;
}

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
export class RouteEntityHandler extends BaseEntityHandler<RouteEntity, Partial<RouteEntity>, RouteSearchCriteria> {
  // Dexie Table typing differs across versions; use a broad compatible shape here
  protected table: any;
  private routeDB: RouteDatabase;
  private routeGenerator: RouteGenerator;
  private locationResolver: LocationResolver;


  constructor() {
    super();
    this.routeDB = new RouteDatabase();
    this.table = this.routeDB.routes as unknown as Table<RouteEntity, NodeId>;
    this.routeGenerator = new RouteGenerator();
    this.locationResolver = new LocationResolver();

    // Initialize metadata handler

  }

  /**
   * Build route entity
   */
  protected buildEntity(
    nodeId: NodeId,
    entityId: NodeId,
    data: Partial<RouteEntity>,
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
  async updateEntity(entityId: NodeId, updates: Partial<RouteEntity>): Promise<RouteEntity> {
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
    updates: Partial<RouteEntity>,
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
      JSON.stringify(updates[field]) !== JSON.stringify(existing[field]),
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
    endLocationId: NodeId,
  ): Promise<RouteEntity[]> {
    return await this.table
      .filter((route: RouteEntity) =>
        route.startLocationId === startLocationId &&
        route.endLocationId === endLocationId,
      )
      .toArray();
  }

  /**
   * Find the shortest sequence of routes that connects two locations.
   * Uses Dijkstra's algorithm with route distance as the edge weight.
   * Returns an empty array when no connecting routes are available.
   */
  async getShortestRouteSetBetweenLocations(
    startLocationId: NodeId,
    endLocationId: NodeId,
  ): Promise<RouteEntity[]> {
    if (startLocationId === endLocationId) {
      return [];
    }

    const routes = (await this.table.toArray()) as RouteEntity[];
    const adjacency = new Map<NodeId, Array<{ to: NodeId; route: RouteEntity; weight: number }>>();

    for (const route of routes) {
      const start = route.startLocationId;
      const end = route.endLocationId;
      if (!start || !end || start === end) {
        continue;
      }

      const weight = this.getRouteWeight(route);
      if (weight === null) {
        continue;
      }

      let edges = adjacency.get(start);
      if (!edges) {
        edges = [];
        adjacency.set(start, edges);
      }

      edges.push({ to: end, route, weight });
    }

    if (!adjacency.has(startLocationId)) {
      return [];
    }

    const distances = new Map<NodeId, number>();
    const previousNodes = new Map<NodeId, NodeId>();
    const previousRoutes = new Map<NodeId, RouteEntity>();
    const visited = new Set<NodeId>();
    const queue: Array<{ nodeId: NodeId; distance: number }> = [
      { nodeId: startLocationId, distance: 0 },
    ];

    distances.set(startLocationId, 0);

    while (queue.length > 0) {
      queue.sort((a, b) => a.distance - b.distance);
      const current = queue.shift()!;

      if (visited.has(current.nodeId)) {
        continue;
      }
      visited.add(current.nodeId);

      if (current.nodeId === endLocationId) {
        break;
      }

      const edges = adjacency.get(current.nodeId);
      if (!edges) {
        continue;
      }

      for (const edge of edges) {
        const newDistance = current.distance + edge.weight;
        if (newDistance < (distances.get(edge.to) ?? Number.POSITIVE_INFINITY)) {
          distances.set(edge.to, newDistance);
          previousNodes.set(edge.to, current.nodeId);
          previousRoutes.set(edge.to, edge.route);
          queue.push({ nodeId: edge.to, distance: newDistance });
        }
      }
    }

    if (!previousRoutes.has(endLocationId)) {
      return [];
    }

    const path: RouteEntity[] = [];
    let currentNode: NodeId | undefined = endLocationId;

    while (currentNode && currentNode !== startLocationId) {
      const route = previousRoutes.get(currentNode);
      const previousNode = previousNodes.get(currentNode);
      if (!route || !previousNode) {
        return [];
      }

      path.push(route);
      currentNode = previousNode;
    }

    return path.reverse();
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

    const outgoing = allRoutes.filter((r: RouteEntity) => r.startLocationId === locationId);
    const incoming = allRoutes.filter((r: RouteEntity) => r.endLocationId === locationId);
    const passing = allRoutes.filter((r: RouteEntity) =>
      r.waypointLocationIds?.includes(locationId) || false,
    );

    return { outgoing, incoming, passing };
  }

  /**
   * Get route statistics
   */
  async getStatistics(): Promise<RouteStatistics> {
    const routes = (await this.table.toArray()) as RouteEntity[];

    const stats: RouteStatistics = {
      totalRoutes: routes.length,
      byTransportMode: {} as Record<TransportMode, number>,
      byGenerationMethod: {} as Record<RouteGenerationMethod, number>,
      totalDistance: 0,
      averageDistance: 0,
      connectedLocations: 0,
      processingStats: {
        pending: 0,
        processing: 0,
        completed: 0,
        failed: 0,
      },
    };
    const connected = new Set<NodeId>();

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
      if (route.startLocationId) connected.add(route.startLocationId);
      if (route.endLocationId) connected.add(route.endLocationId);

      // Processing stats
      const status = route.processingStatus as keyof typeof stats.processingStats | undefined;
      if (status) stats.processingStats[status]!++;
    }

    stats.averageDistance = routes.length > 0
      ? stats.totalDistance / routes.filter((r: RouteEntity) => r.distance).length
      : 0;

    stats.connectedLocations = connected.size;

    return stats;
  }

  /**
   * Batch generate routes
   */
  async batchGenerateRoutes(
    routeConfigs: Array<{
      nodeId: NodeId;
      data: Partial<RouteEntity>;
    }>,
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

  // Note: uses base search (name/createdAt/updatedAt). Route-specific criteria can be added later.

  private getRouteWeight(route: RouteEntity): number | null {
    if (typeof route.distance === 'number' && Number.isFinite(route.distance) && route.distance >= 0) {
      return route.distance;
    }

    if (route.lineGeometry && route.lineGeometry.length >= 2) {
      const lineDistance = this.calculateLineGeometryDistance(route.lineGeometry);
      if (lineDistance > 0) {
        return lineDistance;
      }
    }

    const coordinatePath: [number, number][] = [];
    if (route.startPoint?.coordinates) {
      coordinatePath.push(route.startPoint.coordinates);
    }
    if (route.waypoints?.length) {
      for (const waypoint of route.waypoints) {
        if (waypoint?.coordinates) {
          coordinatePath.push(waypoint.coordinates);
        }
      }
    }
    if (route.endPoint?.coordinates) {
      coordinatePath.push(route.endPoint.coordinates);
    }

    if (coordinatePath.length >= 2) {
      const fallbackDistance = this.calculateLineGeometryDistance(coordinatePath);
      if (fallbackDistance > 0) {
        return fallbackDistance;
      }
    }

    return null;
  }

  private calculateLineGeometryDistance(line: [number, number][]): number {
    let total = 0;

    for (let i = 0; i < line.length - 1; i++) {
      const current = line[i];
      const next = line[i + 1];
      if (!current || !next) {
        continue;
      }

      total += this.calculateDistance(current, next);
    }

    return total;
  }

  private calculateDistance(
    point1: [number, number],
    point2: [number, number],
  ): number {
    const R = 6371000; // Earth radius in meters

    const lat1 = this.toRadians(point1[1]);
    const lat2 = this.toRadians(point2[1]);
    const deltaLat = this.toRadians(point2[1] - point1[1]);
    const deltaLon = this.toRadians(point2[0] - point1[0]);

    const a = Math.sin(deltaLat / 2) * Math.sin(deltaLat / 2) +
      Math.cos(lat1) * Math.cos(lat2) *
      Math.sin(deltaLon / 2) * Math.sin(deltaLon / 2);

    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

    return R * c;
  }

  private toRadians(degrees: number): number {
    return degrees * (Math.PI / 180);
  }

  /**
   * Clean up route-specific data
   */
  protected async cleanupEntityData(entity: RouteEntity): Promise<void> {
    // Clean up any cached route data
    await this.routeDB.cleanupRouteCache(entity.id);
  }
}
