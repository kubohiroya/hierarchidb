import type { GroupEntity, ISO2, NodeId, Timestamp } from '@hierarchidb/core-types';
import type { TreeNodeUpdaterPayload } from '@hierarchidb/tree-api';
import type { BaseBatchConfig } from '@hierarchidb/batch-api';
import type { BaseBuildConfig } from '@hierarchidb/gis-sdk';
import type { LocationFeatureId } from '@hierarchidb/location-api';

export const ROUTE_MODES = {
  AIRWAY: 'airway',
  WATERWAY: 'waterway',
  RAILWAY: 'railway',
  H_RAILWAY: 'high-speed-railway',
  ROAD: 'road',
  HIGHWAY: 'highway',
} as const;

export type RouteMode = typeof ROUTE_MODES[keyof typeof ROUTE_MODES];

export interface RoutePoint {
  locationFeatureId?: LocationFeatureId;
  locationId?: NodeId;
  pointId?: string;
  latitude: number;
  longitude: number;
  locationName?: string;
  name?: string;
  admin0Name?: string;
  admin0Code?: string;
  admin1Name?: string;
  admin2Name?: string;
}

export interface RouteFeature extends GroupEntity {
  featureId: string;
  name: string;
  routeMode: RouteMode;
  startPoint: RoutePoint;
  endPoint: RoutePoint;
  waypoints?: [number, number][];
  distance?: number;
  speed?: number;
  metadata?: Record<string, string | number | boolean>;
}

export type RouteLineString = RouteFeature;

export type RouteGenerationMethod =
  | 'direct'
  | 'osm_route'
  | 'great_circle'
  | 'searoute'
  | 'custom';

export interface RouteGenerationOptions {
  preferredChannels?: string[];
  avoidCanals?: boolean;
  osmProfile?: string;
  osrmBaseUrl?: string;
  osmAvoidTolls?: boolean;
  osmAvoidHighways?: boolean;
  [key: string]: unknown;
}

export type TransportMode = 'air' | 'sea' | 'rail' | 'road';

export type RouteGenerationConfig = {
  method: RouteGenerationMethod;
  options?: RouteGenerationOptions;
};

export type RouteTransportSelection =
  | 'air'
  | 'sea'
  | 'rail'
  | 'high-speed-rail'
  | 'highway'
  | 'road';

export interface RouteProcessingConfig {
  apiThrottle?: {
    requestsPerSecond: number;
    maxConcurrent: number;
  };
  extraction?: {
    tolerance: number;
  };
  vectorTiles?: {
    minZoom: number;
    maxZoom: number;
    buffer: number;
    inputFormat?: 'geojson' | 'flatgeobuf';
    inputCompression?: 'gzip' | 'none';
  };
}

export interface RouteEntity {
  selectedArrayByCountries: Record<ISO2, boolean[]>;
  dataSourceName?: string;
  licenseAgreement?: boolean;
  licenseAgreedAt?: Timestamp;
  ideGsmFileName?: string;
  ideGsmSourceUrl?: string;
  tabularSourceId?: string;
  transportMode?: TransportMode;
  transportModes?: TransportMode[];
  transportSelection?: RouteTransportSelection;
  railType?: 'conventional' | 'high-speed';
  roadType?: 'highway' | 'general';
  generationMethod?: RouteGenerationMethod;
  generationOptions?: RouteGenerationOptions;
  startLocationId?: NodeId;
  endLocationId?: NodeId;
  lineGeometry?: [number, number][];
  /** @deprecated Use buildConfig instead. */
  config?: RouteProcessingConfig;
  buildConfig?: BaseBuildConfig<string>;
  /** @deprecated Use buildConfig instead. */
  processing?: RouteProcessingConfig;
  processedAt?: number;
  processingStatus?: 'pending' | 'processing' | 'completed' | 'failed';
  processingError?: string;
  zoomRange?: [number, number];
  buildStartedAt?: number;
  buildFinishedAt?: number;
}

export type RouteUpdaterPayload = TreeNodeUpdaterPayload<RouteEntity>;

export interface RouteBatchConfig extends BaseBatchConfig {
  routeGeneration: {
    method: RouteGenerationMethod;
    parallel: boolean;
    maxConcurrent: number;
    retryOnFailure: boolean;
    maxRetries: number;
  };
  locationResolution?: { batchSize: number; cacheResults: boolean; fallbackToCoordinates: boolean };
  validation?: {
    checkLocationExists: boolean;
    checkDuplicateRoutes: boolean;
    validateDistance: boolean;
    maxDistanceKm?: number;
  };
  laneCaps?: Partial<Record<RouteGenerationMethod, number>>;
}

export interface RouteBuildConfig {
  maxRetries?: number;
  retryDelay?: number;
  workerTimeout?: number;
  maxMemoryPerWorker?: number;
  enableProgressTracking?: boolean;
  enableResourceMonitoring?: boolean;
  routeGeneration: {
    method: RouteGenerationMethod;
    parallel: boolean;
    maxConcurrent: number;
    retryOnFailure: boolean;
    maxRetries: number;
  };
  locationResolution?: { batchSize: number; cacheResults: boolean; fallbackToCoordinates: boolean };
  validation?: {
    checkLocationExists: boolean;
    checkDuplicateRoutes: boolean;
    validateDistance: boolean;
    maxDistanceKm?: number;
  };
  laneCaps?: Partial<Record<RouteGenerationMethod, number>>;
}

export type BuildConfig = RouteBuildConfig;

export interface RouteNearestLineQuery {
  nodeId: NodeId;
  longitude: number;
  latitude: number;
  zoom: number;
  maxDistanceMeters: number;
}

export interface RouteNearestEndpoint {
  name?: string;
  admin1Name?: string;
  admin0Name?: string;
  pointId?: string;
}

export interface RouteNearestLine {
  lineStringId?: string;
  featureId?: string;
  routeMode?: string;
  routeDistanceMeters?: number;
  start?: RouteNearestEndpoint;
  end?: RouteNearestEndpoint;
}

export interface RouteNearestLineMatch {
  line: RouteNearestLine;
  distanceMeters: number;
}

export interface RouteNearestLineResponse {
  cursor: {
    longitude: number;
    latitude: number;
  };
  matches: RouteNearestLineMatch[];
}

export interface RouteWaypointPoint {
  coordinates?: [number, number];
  name?: string;
  admin1Name?: string;
  admin0Name?: string;
  pointId?: string;
}

export interface RouteWaypointInput {
  id: string;
  routeMode?: string;
  startPoint?: RouteWaypointPoint;
  endPoint?: RouteWaypointPoint;
  distance?: number;
  speed?: number;
}

export interface RouteWaypointResult {
  id: string;
  waypoints?: [number, number][];
  distance?: number;
  speed?: number;
}
