import type { TreeQueryAPI } from '@hierarchidb/common-api';
import type { NodeId, TreeNode } from '@hierarchidb/common-types';
import { CoreDB, TreeQueryService } from '@hierarchidb/runtime-worker';
import {
  DEFAULT_PROCESSING_CONFIG,
  mergeBatchConfig,
  type Extract2ExtractionMode,
  type FeatureFilterMethod,
  type HybridFilterConfig,
  type ShapeEntity,
} from '../../../common/types/index.js';

export type Extract1Settings = {
  tolerance: number;
  minimumArea: number;
  enableFeatureFiltering: boolean;
  featureFilterMethod?: FeatureFilterMethod;
  minVertexCountForAreaFilter?: number;
  aspectRatioThreshold?: number;
  hybridFilterConfig?: HybridFilterConfig;
};

export type Extract2Settings = {
  tolerance: number;
  zoomLevels: number[];
  tileSize: number;
  quantize?: number;
  enablePerFeatureExtraction?: boolean;
  extractionMode?: Extract2ExtractionMode;
  preserveSharedBoundaries: boolean;
};

export type ExtractStageSettings = {
  extract1: Extract1Settings;
  extract2: Extract2Settings;
};

const FALLBACK_EXTRACT2_TILE_SIZE = 512;

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null;

const resolveShapeEntity = (node: TreeNode | undefined): ShapeEntity | null => {
  if (!node) return null;
  const draftData = (node as { draftData?: unknown }).draftData;
  if (isRecord(draftData)) {
    return draftData as ShapeEntity;
  }
  const data = (node as { data?: unknown }).data;
  if (isRecord(data)) {
    console.warn('[shape-batch] draftData missing; falling back to data for extract settings', {
      nodeId: node.id,
    });
    return data as ShapeEntity;
  }
  return null;
};

const resolveZoomLevels = (minZoom: number, maxZoom: number): number[] => {
  const lower = Math.min(minZoom, maxZoom);
  const upper = Math.max(minZoom, maxZoom);
  if (!Number.isFinite(lower) || !Number.isFinite(upper)) {
    return [];
  }
  return Array.from({ length: upper - lower + 1 }, (_, index) => lower + index);
};

let queryPromise: Promise<TreeQueryAPI> | null = null;

const getTreeQueryAPI = async (): Promise<TreeQueryAPI> => {
  if (!queryPromise) {
    queryPromise = CoreDB.getSingleton().then(async (coreDB) => TreeQueryService.getSingleton(coreDB));
  }
  return queryPromise;
};

export const resolveExtractStageSettings = async (nodeId: NodeId): Promise<ExtractStageSettings> => {
  const query = await getTreeQueryAPI();
  const node = await query.getNode(nodeId);
  if (!node) {
    console.warn('[shape-batch] TreeNode missing for extract settings; using defaults', { nodeId });
  }
  const entity = resolveShapeEntity(node);
  const merged = mergeBatchConfig(entity?.batchConfig ?? DEFAULT_PROCESSING_CONFIG);

  const extract1Config = merged.extract1Config ?? DEFAULT_PROCESSING_CONFIG.extract1Config;
  const extract2Config = merged.extract2Config ?? DEFAULT_PROCESSING_CONFIG.extract2Config;
  const tileConfig = merged.tileConfig ?? DEFAULT_PROCESSING_CONFIG.tileConfig;

  const minZoom = tileConfig?.minZoom ?? 0;
  const maxZoom = tileConfig?.maxZoom ?? minZoom;
  const zoomLevels = resolveZoomLevels(minZoom, maxZoom);
  const tileSize = tileConfig?.tileSize
    ?? DEFAULT_PROCESSING_CONFIG.tileConfig?.tileSize
    ?? FALLBACK_EXTRACT2_TILE_SIZE;

  const extractionMode = extract2Config?.extractionMode
    ?? DEFAULT_PROCESSING_CONFIG.extract2Config?.extractionMode;
  const preserveSharedBoundaries = extractionMode === 'topojson';

  return {
    extract1: {
      tolerance: extract1Config?.tolerance
        ?? DEFAULT_PROCESSING_CONFIG.extract1Config?.tolerance
        ?? 0,
      minimumArea: extract1Config?.areaThreshold
        ?? DEFAULT_PROCESSING_CONFIG.extract1Config?.areaThreshold
        ?? 0,
      enableFeatureFiltering: true,
      featureFilterMethod: extract1Config?.featureFilterMethod
        ?? DEFAULT_PROCESSING_CONFIG.extract1Config?.featureFilterMethod,
      minVertexCountForAreaFilter: extract1Config?.minVertexCountForAreaFilter
        ?? DEFAULT_PROCESSING_CONFIG.extract1Config?.minVertexCountForAreaFilter,
      aspectRatioThreshold: extract1Config?.aspectRatioThreshold
        ?? DEFAULT_PROCESSING_CONFIG.extract1Config?.aspectRatioThreshold,
      hybridFilterConfig: extract1Config?.hybridFilterConfig
        ?? DEFAULT_PROCESSING_CONFIG.extract1Config?.hybridFilterConfig,
    },
    extract2: {
      tolerance: extract2Config?.tolerance
        ?? DEFAULT_PROCESSING_CONFIG.extract2Config?.tolerance
        ?? 0,
      zoomLevels,
      tileSize,
      quantize: extract2Config?.quantize
        ?? DEFAULT_PROCESSING_CONFIG.extract2Config?.quantize,
      enablePerFeatureExtraction: extract2Config?.enablePerFeatureExtraction
        ?? DEFAULT_PROCESSING_CONFIG.extract2Config?.enablePerFeatureExtraction,
      extractionMode,
      preserveSharedBoundaries,
    },
  };
};
