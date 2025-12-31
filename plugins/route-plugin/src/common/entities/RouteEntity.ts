/**
 * @file RouteEntity.ts
 * @description Route entity definition extending Shape plugin
 */

import type { NodeId, Timestamp, TreeNodeUpdaterPayload } from '@hierarchidb/common-types';


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

export interface RouteGenerationConfig {
  method: RouteGenerationMethod;
  options?: RouteGenerationOptions;
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
  simplification?: {
    tolerance: number;
  };
  vectorTiles?: {
    minZoom: number;
    maxZoom: number;
    buffer: number;
    tileWorkers?: number;
  };
}

/**
 * Route entity extending base and metadata entities
 */
export interface RouteEntity {

  /*
  // Transport-specific metadata
  frequency?: {
    type: 'scheduled' | 'on_demand';
    schedule?: string;  // CRON expression or description
    averageInterval?: number; // In minutes
  };
   */

  selectedArrayByCountries: Record<string, boolean[]>;

  // Data source information
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

  // Processing metadata
  processedAt?: number;
  processingStatus?: 'pending' | 'processing' | 'completed' | 'failed';
  processingError?: string;

  zoomRange?: [number, number];

  buildStartedAt?: number;
  buildFinishedAt?: number;

  //processingStatus?: 'pending' | 'processing' | 'completed' | 'failed';
  //processingError?: string;

  // Visualization properties
  /*
  style?: {
    color?: string;
    width?: number;
    opacity?: number;
    dashArray?: number[];
    animate?: boolean;
  };
   */

}

export type RouteUpdaterPayload = TreeNodeUpdaterPayload<RouteEntity>;
