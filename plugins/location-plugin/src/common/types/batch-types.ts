import type { NodeId } from '@hierarchidb/common-types';

export interface LocationPointInput {
  lon: number;
  lat: number;
  id?: string | number;
  ts?: number;
  properties?: Record<string, unknown>;
}

export interface LocationTileSettings {
  zoomMinGenerate: number;
  zoomMaxGenerate: number;
  zoomMaxServe?: number;
  tileWorkers?: number;
  attributeAllowlist?: string[];
  tileFeatureLimit?: number;
  extent?: number;
}

export interface SessionSummary {
  sessionId: string;
  nodeId: NodeId;
  zoomMin: number;
  zoomMax: number;
  zoomMaxServe?: number;
  bbox: [number, number, number, number];
  totalPoints: number;
  layers: string[];
}

export interface UnifiedLocationBatchConfig {
  concurrency?: number;
  corsProxyBaseURL?: string;
  maxRetries?: number;
  maxConcurrentTasks?: number;
  tileWorkers?: number;
}

export interface LocationBatchData {
  points: LocationPointInput[];
  settings: LocationTileSettings;
}
