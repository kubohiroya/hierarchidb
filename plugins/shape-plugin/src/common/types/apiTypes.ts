/**
 * Shape processing status types used by UI and worker helpers.
 */

/**
 * Processing status types
 */
export interface ProcessingStatus {
  status: 'idle' | 'processing' | 'paused' | 'completed' | 'failed';
  lastProcessed?: number;
  totalFeatures?: number;
  totalVectorTiles?: number;
  storageUsed?: number;
  hasErrors: boolean;
  errorMessages: string[];
  // Optional fields used by UI hooks/components
  stage?: string;
  progress?: number;
  lastUpdated?: number;
  error?: string;
}

/**
 * Tile information
 */
export interface TileInfo {
  exists: boolean;
  size: number;
  features: number;
  layers: string[];
  generatedAt: number;
  lastAccessed?: number;
}
