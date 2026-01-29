import type { ISO2, GroupEntity, NodeId, Timestamp, TreeNodeUpdaterPayload } from '@hierarchidb/common-types';
import type { LocationPointId } from '@hierarchidb/location-store';

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
  coordinates: [number, number];
  pointId: LocationPointId;
  locationId?: NodeId;
  name: string;
  admin0Name: string;
  admin1Name: string;
  admin2Name?: string;
}

export interface RouteFeature extends GroupEntity {
  name: string;
  featureId: string;
  routeMode: RouteMode;
  startPoint: RoutePoint;
  endPoint: RoutePoint;
  waypoints?: [number, number][];
  distance?: number;
  speed?: number;
  metadata?: Record<string, string | number | boolean>;
}

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
  config?: RouteProcessingConfig;
  processing?: RouteProcessingConfig;
  processedAt?: number;
  processingStatus?: 'pending' | 'processing' | 'completed' | 'failed';
  processingError?: string;
  zoomRange?: [number, number];
  buildStartedAt?: number;
  buildFinishedAt?: number;
}

export type RouteUpdaterPayload = TreeNodeUpdaterPayload<RouteEntity>;

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
