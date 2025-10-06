/**
  * Route Plugin Type Definitions
   */

import type { WorkingCopyDraft } from '@hierarchidb/plugins-base-plugin';

// Branded types
export type NodeId = string & { readonly __brand: 'NodeId' };
export type TagId = string & { readonly __brand: 'TagId' };

// Route Category Type
export type RouteCategory = 'transportation' | 'recreation' | 'logistics' | 'emergency';

// ================================
// Route Types
// ================================

export enum RouteType {
  ROAD = 'road',
  RAILWAY = 'railway',
  WATERWAY = 'waterway',
  AIRWAY = 'airway',
  WALKING = 'walking',
  CYCLING = 'cycling',
  HIKING = 'hiking',
  SHIPPING = 'shipping',
  PIPELINE = 'pipeline',
  POWERLINE = 'powerline'
}

// ================================
// Transportation Modes
// ================================

export enum TransportMode {
  CAR = 'car',
  TRUCK = 'truck',
  BUS = 'bus',
  TRAIN = 'train',
  SUBWAY = 'subway',
  TRAM = 'tram',
  FERRY = 'ferry',
  AIRPLANE = 'airplane',
  BICYCLE = 'bicycle',
  PEDESTRIAN = 'pedestrian',
  MOTORCYCLE = 'motorcycle'
}

// ================================
// Route Entity Types
// ================================

export type RouteEntity = {
  id: NodeId;
  nodeId: NodeId;

  // Basic Information
  name: string;
  description?: string;
  tags?: TagId[];
  category?: RouteCategory;

  // Route Specifications
  routeType: RouteType;
  transportModes: TransportMode[];

  // Geographic Data
  startPoint?: [number, number]; // [longitude, latitude]
  endPoint?: [number, number];   // [longitude, latitude]
  waypoints?: [number, number][];
  boundingBox?: [number, number, number, number]; // [minLng, minLat, maxLng, maxLat]

  // Route Metrics
  distance?: number; // in meters
  duration?: number; // in seconds
  elevation?: {
    gain: number;
    loss: number;
    min: number;
    max: number;
  };

  // Data Source
  dataSourceName: 'openstreetmap' | 'mapbox' | 'google' | 'custom';

  // License Agreement
  licenseAgreement: boolean;
  licenseAgreedAt?: string;

  // Processing Configuration
  processingConfig: RouteProcessingConfig;

  // Processing Status
  batchSessionId?: string;
  processingStatus?: 'idle' | 'processing' | 'completed' | 'failed';

  // Metadata
  createdAt: number;
  updatedAt: number;
  version: number;
}

export type RouteWorkingCopy = WorkingCopyDraft<RouteEntity> & Partial<RouteEntity> & {
  isDraft?: boolean;
  copiedAt?: number;
  originalVersion?: number;
  modifiedFields?: string[];
  selectedCountries?: string[];
  routeTypes?: RouteType[];
  transportModes?: TransportMode[];
  routeParameters?: RouteParameters;
  draft?: Partial<RouteEntity>;
  payload?: {
    draft?: Partial<RouteEntity>;
    stage?: 'draft' | 'synced';
  };
};

/**
 * Peer payload stored for route nodes in peerEntities.
 */
export interface RoutePeerData {
  schemaVersion: 1;
  lastComputedAt?: number;
  metadata?: Record<string, unknown>;
}

// ================================
// Processing Configuration
// ================================

export interface RouteProcessingConfig {
  concurrentRequests: number;
  corsProxyBaseURL?: string;
  enableRouteOptimization: boolean;
  enableElevationData: boolean;
  enableTrafficData: boolean;
  maxWaypoints?: number;
  routingProfile?: string;
  avoidTolls?: boolean;
  avoidHighways?: boolean;
  avoidFerries?: boolean;
}

// ================================
// Route Parameters
// ================================

export interface RouteParameters {
  maxDistance?: number; // in km
  maxDuration?: number; // in minutes
  minElevationGain?: number; // in meters
  maxElevationGain?: number; // in meters
  surfaceTypes?: SurfaceType[];
  difficultyLevel?: DifficultyLevel;
  accessibilityFeatures?: AccessibilityFeature[];
}

export enum SurfaceType {
  PAVED = 'paved',
  UNPAVED = 'unpaved',
  GRAVEL = 'gravel',
  DIRT = 'dirt',
  SAND = 'sand',
  GRASS = 'grass',
  CONCRETE = 'concrete',
  ASPHALT = 'asphalt'
}

export enum DifficultyLevel {
  EASY = 'easy',
  MODERATE = 'moderate',
  DIFFICULT = 'difficult',
  EXPERT = 'expert'
}

export enum AccessibilityFeature {
  WHEELCHAIR_ACCESSIBLE = 'wheelchair_accessible',
  ELEVATOR_ACCESS = 'elevator_access',
  AUDIO_GUIDANCE = 'audio_guidance',
  BRAILLE_SIGNS = 'braille_signs',
  LOW_SLOPE = 'low_slope'
}

// ================================
// Route Statistics
// ================================

export interface RouteStatistics {
  totalRoutes: number;
  routesByType: Record<RouteType, number>;
  routesByTransportMode: Record<TransportMode, number>;
  totalDistance: number;
  averageDistance: number;
  totalDuration: number;
  averageDuration: number;
}

// ================================
// Create/Update Data Types
// ================================

export interface CreateRouteData {
  name: string;
  description?: string;
  routeType: RouteType;
  transportModes: TransportMode[];
  dataSourceName: 'openstreetmap' | 'mapbox' | 'google' | 'custom';
  processingConfig: RouteProcessingConfig;
}

export interface UpdateRouteData {
  name?: string;
  description?: string;
  routeType?: RouteType;
  transportModes?: TransportMode[];
  processingConfig?: RouteProcessingConfig;
}

// ================================
// UI Dialog Props
// ================================

// RouteDialogProps is now defined in RouteDialog component file
