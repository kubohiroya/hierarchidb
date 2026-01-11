import type { NodeId, NodeType, TreeNode } from '@hierarchidb/common-types';
import type { FeatureMetadataRow } from '@hierarchidb/vectortile-store';

export type VectorTileProgress = {
  total: number;
  completed: number;
  percent: number;
  zoom: number;
  x: number;
  y: number;
};

/**
 * Lifecycle hooks for node operations
 */
export interface NodeLifecycleHooks {
  // Creation hooks
  beforeCreate?: (parentId: NodeId, nodeData: Partial<TreeNode>) => Promise<void> | void;
  afterCreate?: (nodeId: NodeId) => Promise<void> | void;

  // Update hooks
  beforeUpdate?: (nodeId: NodeId, updates: Partial<TreeNode>) => Promise<void> | void;
  afterUpdate?: (nodeId: NodeId, updates: Partial<TreeNode>) => Promise<void> | void;

  // Deletion hooks
  beforeDelete?: (nodeId: NodeId) => Promise<void> | void;
  afterDelete?: (nodeId: NodeId) => Promise<void> | void;

  // Move hooks
  beforeMove?: (nodeId: NodeId, oldParentId: NodeId, newParentId: NodeId) => Promise<void> | void;
  afterMove?: (nodeId: NodeId, oldParentId: NodeId, newParentId: NodeId) => Promise<void> | void;

  // Load/Unload hooks
  onLoad?: (nodeId: NodeId) => Promise<void> | void;
  onUnload?: (nodeId: NodeId) => Promise<void> | void;

  // Error handling configuration
  stopOnError?: boolean;
}

/**
 * Context provided to lifecycle hooks
 */
export interface LifecycleContext {
  nodeType: NodeType;
  userId?: string;
  timestamp: number;
  correlationId?: string;
  metadata?: Record<string, unknown>;
}

/**
 * Lifecycle event for tracking
 */
export interface LifecycleEvent {
  type: keyof NodeLifecycleHooks;
  nodeType: NodeType;
  nodeId?: NodeId;
  timestamp: number;
  duration: number;
  success: boolean;
  error?: string;
}

// Stage worker APIs (draft contracts for shape-plugin processing)

export interface FetchWorkerAPI {
  download(
    url: string,
    fileId: string,
    opts?: { expectedHash?: string }
  ): Promise<{
    fileId: string;
    sizeBytes?: number;
    hash?: string;
  }>;
}

export interface TransformWorkerAPI {
  transformStage(
    inputBufferId: string,
    config: {
      tolerance: number;
      minArea: number;
    }
  ): Promise<{ outputBufferId: string }>;

  transformStage2(
    inputBufferId: string,
    config: {
      zoomLevels: number[];
      tileSize: number;
    }
  ): Promise<{ outputBufferId: string }>;
}

export interface VTWorkerAPI {
  storeTiles(
    nodeId: NodeId,
    nodeType: string,
    tiles: Array<{
      z: number;
      x: number;
      y: number;
      data: Uint8Array;
      size: number;
      contentType?: 'application/vnd.mapbox-vector-tile';
      timestamp?: number;
    }>,
    metadata?: {
      featureMetadata?: FeatureMetadataRow[];
      metadataReplace?: boolean;
    },
  ): Promise<{ tilesStored: number }>;
  generateTiles(
    inputBufferId: string,
    config: {
      format: 'mvt' | 'pbf';
      compression?: 'gzip' | 'none';
      tileSize?: number;
      buffer?: number;
      minZoom?: number;
      maxZoom?: number;
      inputFormat?: 'geojson' | 'flatgeobuf';
      inputCompression?: 'gzip' | 'none';
      metadataEnabled?: boolean;
      metadataReplace?: boolean;
      metadataContext?: {
        dataSource?: string;
        countryCode?: string;
        countryName?: string;
        adminLevel?: number;
      };
      targetNodeId?: NodeId;
      targetNodeType?: string;
      abortKey?: string;
    },
    onProgress?: (progress: VectorTileProgress) => void,
  ): Promise<{ tilesGenerated: number; totalBytes?: number; metadataCount?: number }>;
  abortGenerateTiles?(abortKey: string): Promise<void>;
  getTile(nodeId: NodeId, z: number, x: number, y: number, nodeType?: string): Promise<Uint8Array | null>;
  listTiles(
    nodeId: NodeId,
    nodeType?: string
  ): Promise<Array<{ z: number; x: number; y: number; size: number; timestamp: number }>>;
  getSummary(
    nodeId: NodeId,
    nodeType?: string
  ): Promise<{ tiles: number; totalBytes: number; zoomMin?: number; zoomMax?: number }>;
}
