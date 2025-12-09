/**
 * @file RouteEntity.ts
 * @description Route entity definition extending Shape plugin
 */

import type { NodeId, TreeNodeUpdaterPayload } from '@hierarchidb/common-types';
export const ROUTE_TYPES = {
  ROAD: 'road',
  RAILWAY: 'railway',
  WATERWAY: 'waterway',
  AIRWAY: 'airway',
  WALKING: 'walking',
  CYCLING: 'cycling',
  HIKING: 'hiking',
  SHIPPING: 'shipping',
  PIPELINE: 'pipeline',
  POWERLINE: 'powerline',
} as const;

export type RouteType = typeof ROUTE_TYPES[keyof typeof ROUTE_TYPES];

/**
 * Transport mode types
 */
export type TransportMode =
  | 'air' | 'rail' | 'road' | 'sea' | 'ferry' | 'pipeline' | 'cable' | 'walking' | 'cycling';
/**
 * Route generation method
 */
export type RouteGenerationMethod =
  | 'direct' | 'osm_route'    //  OpenStreetMap
  | 'great_circle' | 'searoute' | 'custom';

/**
 * Point type for hybrid location management
 */
export interface RoutePoint {
  coordinates: [number, number];
  name?: string;
  type?: 'location_ref' | 'custom' | 'osm_node';
  locationId?: NodeId;  //  Location
}

/**
 * Route category
 */
export interface RouteCategory {
  primary: TransportMode;
  secondary?: string;
  custom?: string;
}

/**
 * Route entity extending base and metadata entities
 */
export interface RouteEntity {
  // Entity ID
  id: NodeId;
  parentId?: NodeId;

  // Basic information
  name: string;
  description?: string;
  category: RouteCategory;
  // Note: Tags are managed by Folder plugin, not stored here

  // Metadata fields
  metadata?: Record<string, any>;
  customFields?: Record<string, any>;

  // Hybrid location management
  startLocationId?: NodeId;     // Location plugin reference
  endLocationId?: NodeId;       // Location plugin reference
  waypointLocationIds?: NodeId[]; // Waypoints

  // Direct coordinates (fallback/custom)
  startPoint?: RoutePoint;
  endPoint?: RoutePoint;
  waypoints?: RoutePoint[];

  // Generated route information
  lineGeometry: [number, number][];  // LineString coordinates
  generationMethod: RouteGenerationMethod;
  distance?: number;              // Distance in meters
  duration?: number;              // Duration in seconds

  // Transport-specific metadata
  transportMode: TransportMode;
  routeType?: RouteType;
  transportModes?: TransportMode[];
  operator?: string;
  routeNumber?: string;
  frequency?: {
    type: 'scheduled' | 'on_demand';
    schedule?: string;  // CRON expression or description
    averageInterval?: number; // In minutes
  };

  // Data source information
  dataSourceId?: string;
  dataSourceName?: string;
  originalData?: Record<string, any>;
  tabularSourceId?: string;
  extractConfig?: Record<string, unknown>;

  // Processing metadata
  processedAt?: number;
  processingStatus?: 'pending' | 'processing' | 'completed' | 'failed';
  processingError?: string;

  // Visualization properties
  style?: {
    color?: string;
    width?: number;
    opacity?: number;
    dashArray?: number[];
    animate?: boolean;
  };

  // Relations
  parentRouteId?: NodeId;  // For route segments
  childRouteIds?: NodeId[]; // Sub-routes
  relatedShapeId?: NodeId; // Parent Shape entity
  tags?: string[];
}

export type RouteUpdaterPayload = TreeNodeUpdaterPayload<RouteEntity>;

/**
 * Route filter criteria
 */
export interface RouteFilterCriteria {
  transportModes?: TransportMode[];
  operators?: string[];
  startLocationIds?: NodeId[];
  endLocationIds?: NodeId[];
  hasWaypoints?: boolean;
  minDistance?: number;
  maxDistance?: number;
  generationMethod?: RouteGenerationMethod;
  processingStatus?: string;
}

/**
 * Route generation configuration
 */
export interface RouteGenerationOptions {
  // OSM routing options
  osmProfile?: 'car' | 'bike' | 'foot' | 'truck';
  avoidTolls?: boolean;
  avoidHighways?: boolean;
  osrmBaseUrl?: string;
  baseUrl?: string;
  headers?: Record<string, string>;

  // Great circle options
  numPoints?: number;  // Number of interpolation points

  // Sea route options
  avoidCanals?: boolean;
  preferredChannels?: string[];

  // Custom options
  customAlgorithm?: string;
  customParameters?: Record<string, any>;

  // Allow engines to pass through engine-specific parameters without widening to any.
  [key: string]: unknown;
}

export interface RouteGenerationConfig {
  method: RouteGenerationMethod;
  options?: RouteGenerationOptions;
}

/**
 * Route statistics
 */
export interface RouteStatistics {
  totalRoutes: number;
  byTransportMode: Record<TransportMode, number>;
  byGenerationMethod: Record<RouteGenerationMethod, number>;
  totalDistance: number;
  averageDistance: number;
  connectedLocations: number;
  processingStats: {
    pending: number;
    processing: number;
    completed: number;
    failed: number;
  };
}
