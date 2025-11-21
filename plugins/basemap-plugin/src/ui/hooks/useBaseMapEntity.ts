/**
 * @file useBaseMapEntity.ts
 * @description React hook for fetching and managing BaseMap entity data
 */

import { useCallback, useEffect, useMemo, useState } from 'react';
import type { NodeId, Timestamp, TreeNode } from '@hierarchidb/common-types';
import type { TreeQueryAPI, WorkingCopyAPI } from '@hierarchidb/common-api';
import { getWorkerClientHook, type WorkerClientRef } from '@hierarchidb/runtime-client';
import type {
  BaseMapEntity,
  MapStyle,
  MapViewport,
} from '../../common/types/BaseMapEntity.js';

export interface UseBaseMapEntityResult {
  entity: BaseMapEntity | null;
  loading: boolean;
  error: Error | null;
  refetch: () => void;
  updateEntity: (updates: Partial<BaseMapEntity>) => Promise<void>;
}

const DEFAULT_MAP_STYLE: MapStyle = {
  style: 'streets',
};

const DEFAULT_VIEWPORT: MapViewport = {
  center: [139.767, 35.681],
  zoom: 10,
  bearing: 0,
  pitch: 0,
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

const toStringArray = (value: unknown): string[] =>
  Array.isArray(value) ? value.filter((entry): entry is string => typeof entry === 'string') : [];

const readNodeData = (node: TreeNode | Record<string, unknown> | null | undefined): Record<string, unknown> => {
  if (!node) return {};
  const nodeRecord = node as unknown as Record<string, unknown>;
  const rawData = nodeRecord.draftData ?? nodeRecord.data;
  return isRecord(rawData) ? (rawData as Record<string, unknown>) : {};
};

export function normalizeMapStyle(mapStyle?: Partial<MapStyle>): MapStyle {
  return {
    ...DEFAULT_MAP_STYLE,
    ...(mapStyle ?? {}),
  };
}

export function normalizeViewport(viewport?: Partial<MapViewport>): MapViewport {
  return {
    ...DEFAULT_VIEWPORT,
    ...(viewport ?? {}),
  };
}

export function buildBaseMapEntityFromNode(node?: TreeNode | null): BaseMapEntity | null {
  if (!node) return null;
  const data = readNodeData(node);
  const mapStyle = normalizeMapStyle(data.mapStyle as Partial<MapStyle> | undefined);
  const viewport = normalizeViewport(data.viewport as Partial<MapViewport> | undefined);
  const createdAt: Timestamp = (typeof node.createdAt === 'number' ? node.createdAt : Date.now()) as Timestamp;
  const updatedAt: Timestamp = (typeof node.updatedAt === 'number' ? node.updatedAt : Date.now()) as Timestamp;
  const name = typeof node.name === 'string' ? node.name : undefined;
  const description = typeof node.description === 'string' ? node.description : undefined;
  const tags = toStringArray(data.tags);

  return {
    id: node.id as NodeId,
    nodeId: node.id as NodeId,
    mapStyle,
    viewport,
    name,
    description,
    tags,
    createdAt,
    updatedAt,
    version: typeof node.version === 'number' ? node.version : 1,
  };
}

function createFallbackEntity(nodeId: NodeId): BaseMapEntity {
  const now = Date.now() as Timestamp;
  return {
    id: nodeId,
    nodeId,
    mapStyle: { ...DEFAULT_MAP_STYLE },
    viewport: { ...DEFAULT_VIEWPORT },
    name: '',
    description: '',
    tags: [],
    createdAt: now,
    updatedAt: now,
    version: 1,
  };
}

async function ensureWorkerApis(
  ref: WorkerClientRef | null
): Promise<{ query: TreeQueryAPI; workingCopy: WorkingCopyAPI } | null> {
  if (!ref) return null;
  try {
    const api = ref.getAPI();
    const [query, workingCopy] = await Promise.all([api.getQueryAPI(), api.getWorkingCopyAPI()]);
    return { query, workingCopy };
  } catch (error) {
    console.error('[useBaseMapEntity] Failed to acquire worker APIs', error);
    return null;
  }
}

async function ensureWorkingCopyNode(
  nodeId: NodeId,
  wcAPI: WorkingCopyAPI
): Promise<{ workingCopyId: NodeId; workingCopyNode: TreeNode }> {
  let wc = await wcAPI.getWorkingCopy(nodeId);
  if (!wc) {
    wc = await wcAPI.createWorkingCopyFromNode(nodeId);
  }
  if (!wc) {
    throw new Error('Working copy creation failed');
  }
  return { workingCopyId: (wc.id ?? nodeId) as NodeId, workingCopyNode: wc };
}

/**
 * Hook to fetch and manage BaseMap entity
 * @param nodeId - Node ID of the BaseMap entity
 * @param options - Hook options
 * @returns BaseMap entity state and methods
 */
export function useBaseMapEntity(
  nodeId: NodeId | null,
  options: {
    /** Skip initial fetch */
    skip?: boolean;
    /** Polling interval in ms */
    pollingInterval?: number;
    /** Initial entity data */
    initialData?: BaseMapEntity;
  } = {}
): UseBaseMapEntityResult {
  const { skip = false, pollingInterval, initialData } = options;

  const [entity, setEntity] = useState<BaseMapEntity | null>(initialData || null);
  const [loading, setLoading] = useState(!initialData && !skip);
  const [error, setError] = useState<Error | null>(null);

  const workerClientHook = useMemo(() => {
    try {
      return getWorkerClientHook<WorkerClientRef | null>();
    } catch {
      return null;
    }
  }, []);
  const workerClient = workerClientHook ? workerClientHook() : null;

  // Fetch entity
  const fetchEntity = useCallback(async () => {
    if (!nodeId || skip) return;

    try {
      setLoading(true);
      setError(null);
      const apis = await ensureWorkerApis(workerClient);
      if (!apis) {
        throw new Error('Worker APIs unavailable');
      }
      const node = await apis.query.getNode(nodeId);
      const data = buildBaseMapEntityFromNode(node);
      if (!data) {
        throw new Error('BaseMap entity not found');
      }
      setEntity(data);
    } catch (err) {
      console.error('Failed to fetch BaseMap entity:', err);
      setError(err instanceof Error ? err : new Error('Failed to fetch entity'));
      setEntity(null);
    } finally {
      setLoading(false);
    }
  }, [nodeId, skip, workerClient]);

  // Update entity
  const updateEntity = useCallback(
    async (updates: Partial<BaseMapEntity>) => {
      if (!nodeId) {
        throw new Error('Cannot update entity without nodeId');
      }
      setLoading(true);
      try {
        const apis = await ensureWorkerApis(workerClient);
        if (!apis) {
          throw new Error('Worker APIs unavailable');
        }
        const { workingCopyId, workingCopyNode } = await ensureWorkingCopyNode(
          nodeId,
          apis.workingCopy
        );
        const current = buildBaseMapEntityFromNode(workingCopyNode) ?? createFallbackEntity(nodeId);
        const next: BaseMapEntity = {
          ...current,
          ...updates,
          mapStyle: normalizeMapStyle(updates.mapStyle ?? current.mapStyle),
          viewport: normalizeViewport(updates.viewport ?? current.viewport),
          updatedAt: Date.now() as Timestamp,
        };
        const existingData = readNodeData(workingCopyNode);
        await apis.workingCopy.updateWorkingCopy(workingCopyId, {
          draftData: {
            ...existingData,
            mapStyle: next.mapStyle,
            viewport: next.viewport,
            tags: next.tags,
            name: next.name,
            description: next.description,
          },
        } as Partial<TreeNode>);
        await apis.workingCopy.commitWorkingCopy(workingCopyId);
        await fetchEntity();
      } catch (err) {
        console.error('Failed to update BaseMap entity:', err);
        setError(err instanceof Error ? err : new Error('Failed to update entity'));
        throw err;
      } finally {
        setLoading(false);
      }
    },
    [fetchEntity, nodeId, workerClient]
  );

  // Initial fetch
  useEffect(() => {
    fetchEntity();
  }, [fetchEntity]);

  // Polling
  useEffect(() => {
    if (!pollingInterval || !nodeId || skip) return;

    const interval = setInterval(fetchEntity, pollingInterval);
    return () => clearInterval(interval);
  }, [fetchEntity, nodeId, pollingInterval, skip]);

  return {
    entity,
    loading,
    error,
    refetch: fetchEntity,
    updateEntity,
  };
}

/**
 * Hook to fetch BaseMap configuration for export/display
 * @param nodeId - Node ID of the BaseMap entity
 * @returns BaseMap configuration
 */
export function useBaseMapConfiguration(nodeId: NodeId | null) {
  const { entity, loading, error } = useBaseMapEntity(nodeId, {
    skip: !nodeId,
  });
  const config = entity
    ? {
        mapStyle: entity.mapStyle,
        viewport: entity.viewport,
      }
    : null;

  return { config, loading, error };
}

/**
 * Hook to validate BaseMap configuration
 * @param config - Partial BaseMap entity configuration
 * @returns Validation result
 */
export function useBaseMapValidation(config: Partial<BaseMapEntity>) {
  const [validation, setValidation] = useState<{
    isValid: boolean;
    errors: string[];
  }>({ isValid: true, errors: [] });
  const [validating, setValidating] = useState(false);

  useEffect(() => {
    const validate = () => {
      setValidating(true);
      try {
        const errors: string[] = [];
        if (config.mapStyle) {
          const { style, customStyleUrl } = config.mapStyle;
          if (!['streets', 'satellite', 'terrain', 'dark', 'light', 'custom'].includes(style)) {
            errors.push('Invalid map style');
          }
          if (style === 'custom') {
            if (!customStyleUrl) {
              errors.push('Custom style URL is required when using custom style');
            } else {
              try {
                new URL(customStyleUrl);
              } catch {
                errors.push('Invalid custom style URL format');
              }
            }
          }
        }
        if (config.viewport) {
          const { center, zoom, bearing, pitch } = config.viewport;
          if (
            !Array.isArray(center) ||
            center.length !== 2 ||
            typeof center[0] !== 'number' ||
            typeof center[1] !== 'number'
          ) {
            errors.push('Valid center coordinates are required');
          }
          if (typeof zoom !== 'number' || zoom < 0 || zoom > 24) {
            errors.push('Zoom must be a number between 0 and 24');
          }
          if (typeof bearing !== 'number' || bearing < 0 || bearing >= 360) {
            errors.push('Bearing must be a number between 0 and 360');
          }
          if (typeof pitch !== 'number' || pitch < 0 || pitch > 60) {
            errors.push('Pitch must be a number between 0 and 60');
          }
        }
        setValidation({ isValid: errors.length === 0, errors });
      } catch (err) {
        console.error('Validation error:', err);
        setValidation({
          isValid: false,
          errors: [`Validation failed: ${(err as Error).message}`],
        });
      } finally {
        setValidating(false);
      }
    };

    const timer = setTimeout(validate, 300);
    return () => clearTimeout(timer);
  }, [config]);

  return { ...validation, validating };
}

export const __testUtils = {
  normalizeMapStyle,
  normalizeViewport,
  buildBaseMapEntityFromNode,
};
