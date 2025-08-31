/**
 * @file RouteEntity.ts
 * @description Route entity definition extending Shape plugin
 */

import type { 
  NodeId, 
  EntityId,
  BaseEntity,
  Timestamp
} from '@hierarchidb/common-type';

/**
 * Transport mode types
 */
export type TransportMode = 
  | 'air'        // 航空路
  | 'rail'       // 鉄道
  | 'road'       // 道路
  | 'sea'        // 海路
  | 'ferry'      // フェリー
  | 'pipeline'   // パイプライン
  | 'cable'      // ケーブル（通信・電力）
  | 'walking'    // 歩行路
  | 'cycling';   // 自転車道

/**
 * Route generation method
 */
export type RouteGenerationMethod = 
  | 'direct'       // 直線
  | 'osm_route'    // OpenStreetMapルーティング
  | 'great_circle' // 大圏航路
  | 'searoute'     // 海上航路
  | 'custom';      // カスタム経路

/**
 * Point type for hybrid location management
 */
export interface RoutePoint {
  coordinates: [number, number];
  name?: string;
  type?: 'location_ref' | 'custom' | 'osm_node';
  locationId?: NodeId;  // Locationプラグインへの参照
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
export interface RouteEntity extends BaseEntity {
  // Entity ID
  id: EntityId;
  nodeId: NodeId;
  
  // Basic information
  name: string;
  description?: string;
  category: RouteCategory;
  // Note: Tags are managed by Folder plugin, not stored here
  
  // Metadata fields
  metadata?: Record<string, any>;
  customFields?: Record<string, any>;
  createdAt: Timestamp;
  updatedAt: Timestamp;
  version: number;
  
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
  parentRouteId?: EntityId;  // For route segments
  childRouteIds?: EntityId[]; // Sub-routes
  relatedShapeId?: EntityId; // Parent Shape entity
}

/**
 * Route working copy for editing
 */
export interface RouteWorkingCopy extends RouteEntity {
  isDraft: boolean;
  copiedAt?: number;
  originalVersion?: number;
  modifiedFields?: string[];
}

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
export interface RouteGenerationConfig {
  method: RouteGenerationMethod;
  options?: {
    // OSM routing options
    osmProfile?: 'car' | 'bike' | 'foot' | 'truck';
    avoidTolls?: boolean;
    avoidHighways?: boolean;
    
    // Great circle options
    numPoints?: number;  // Number of interpolation points
    
    // Sea route options
    avoidCanals?: boolean;
    preferredChannels?: string[];
    
    // Custom options
    customAlgorithm?: string;
    customParameters?: Record<string, any>;
  };
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