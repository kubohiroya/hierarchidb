/**
 * @file useBaseMapEntity.ts
 * @description React hook for fetching and managing BaseMap entity data
 */

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { NodeId, TreeId, TreeNode, TreeNodeUpdater, TreeNodeMetadata } from '@hierarchidb/common-types';
import { getWorkerClientHook, type WorkerClientRef } from '@hierarchidb/ui-worker-provider';
import { useTreeNodeUpdater, createTreeNodeUpdaterActions } from '@hierarchidb/plugin-ui-sdk';
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
  updateEntity: (id: NodeId, updates: TreeNodeUpdater<BaseMapEntity>) => Promise<void>;
}

export const DEFAULT_MAP_STYLE: MapStyle = {
  style: 'streets',
};

export const DEFAULT_VIEWPORT: MapViewport = {
  center: [0, 0],
  zoom: 1,
  bearing: 0,
  pitch: 0,
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

const coerceMapStyle = (value: unknown): MapStyle => {
  if (isRecord(value) && typeof (value as { style?: unknown }).style === 'string') {
    return { ...(value as unknown as MapStyle) };
  }
  return { ...DEFAULT_MAP_STYLE };
};

const coerceViewport = (value: unknown): MapViewport | undefined => {
  if (!isRecord(value)) return undefined;
  const center = (value as { center?: unknown }).center;
  const zoom = (value as { zoom?: unknown }).zoom;
  if (
    Array.isArray(center) &&
    center.length === 2 &&
    typeof center[0] === 'number' &&
    typeof center[1] === 'number' &&
    typeof zoom === 'number'
  ) {
    return { ...(value as unknown as MapViewport) };
  }
  return undefined;
};

const readNodeData = (
  node: TreeNode | Record<string, unknown> | null | undefined
): Record<string, unknown> => {
  if (!node) return {};
  const nodeRecord = node as unknown as Record<string, unknown>;
  const rawData = nodeRecord.draftData ?? nodeRecord.data;
  return isRecord(rawData) ? (rawData as Record<string, unknown>) : {};
};

export function buildBaseMapEntityFromNode(node?: TreeNode | null): (BaseMapEntity & { draftMetadata?: TreeNodeMetadata }) | null{
  if (!node) return null;
  const data = readNodeData(node);
  const mapStyle = coerceMapStyle(data.mapStyle);
  const viewport = coerceViewport(data.viewport);
  const draftMetadata = (node as { draftMetadata?: unknown }).draftMetadata;
  const committedMetadata = (node as { metadata?: unknown }).metadata;
  return {
    mapStyle,
    viewport,
    draftMetadata: (draftMetadata || committedMetadata || { name: '', description: '', tags: [] }) as any,
  };
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
  const askedGeolocationRef = useRef(false);

  const workerClientHook = useMemo(() => {
    try {
      return getWorkerClientHook<WorkerClientRef | null>();
    } catch {
      return null;
    }
  }, []);
  const workerClient = workerClientHook ? workerClientHook() : null;

  const {
    treeNodeUpdater: treeNodeUpdater,
    updateTreeNodeUpdater,
    commitTreeNodeUpdater,
    discardDraft,
  } = useTreeNodeUpdater<BaseMapEntity>({
    mode: nodeId ? 'edit' : 'create',
    nodeType: 'basemap',
    parentId: nodeId ?? undefined,
    treeId: (nodeId ?? '') as TreeId,
    workerClient,
    initialDraftData: {
      mapStyle: { ...DEFAULT_MAP_STYLE },
      viewport: undefined,
    },
    initialDraftMetadata: nodeId
      ? { name: '', description: '', tags: [] }
      : undefined,
  });
  const { updatePayload, updatePayloadAndMetadata } = useMemo(
    () => createTreeNodeUpdaterActions<BaseMapEntity>(updateTreeNodeUpdater),
    [updateTreeNodeUpdater],
  );

  // Fetch entity
  const fetchEntity = useCallback(async () => {
    if (!nodeId || skip) return;

    try {
      setLoading(true);
      setError(null);
      if (!workerClient) {
        throw new Error('Worker client unavailable');
      }
      const api = workerClient.getAPI();
      const query = await api.getQueryAPI();
      const node = await query.getNode(nodeId);
      const data = buildBaseMapEntityFromNode(node);
      if (!data) {
        throw new Error('BaseMap entity not found');
      }
      // Seed draft with committed metadata if draftMetadata is empty
      if (treeNodeUpdater && data.draftMetadata) {
        void updateTreeNodeUpdater({
          draftMetadata: {
            name: (data.draftMetadata as { name?: string }).name ?? '',
            description: (data.draftMetadata as { description?: string }).description ?? '',
            tags: (data.draftMetadata as { tags?: string[] }).tags ?? [],
          },
        });
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

  const resolveViewport = useCallback(async (): Promise<MapViewport> => {
    if (typeof navigator !== 'undefined' && navigator.geolocation) {
      try {
        const pos = await new Promise<GeolocationPosition>((resolve, reject) =>
          navigator.geolocation.getCurrentPosition(resolve, reject)
        );
        const { latitude, longitude } = pos.coords;
        return {
          center: [longitude || 0, latitude || 0],
          zoom: 1,
          bearing: 0,
          pitch: 0,
        };
      } catch {
        // ignore and fallback
      }
    }
    return DEFAULT_VIEWPORT;
  }, []);

  // Cache geolocation result for the session to reuse across steps
  const geolocationCacheRef = useRef<MapViewport | null>(null);

  const getOrResolveViewport = useCallback(async (): Promise<MapViewport> => {
    if (geolocationCacheRef.current) {
      return geolocationCacheRef.current;
    }
    const viewport = await resolveViewport();
    geolocationCacheRef.current = viewport;
    return viewport;
  }, [resolveViewport]);

  // Update entity
  const updateEntity = useCallback(
    async (id: NodeId, updater: TreeNodeUpdater<BaseMapEntity>) => {
      if (!nodeId) {
        throw new Error('Cannot update entity without nodeId');
      }
      setLoading(true);
      try {
        /*
        const updating: Partial<BaseMapEntity> =
        const next: Partial<BaseMapEntity> = {
          ...updating,
        };
         */
        if (!treeNodeUpdater) {
          throw new Error('No draft available for basemap');
        }
        updateTreeNodeUpdater({ treeNodeId: id });
        updatePayloadAndMetadata(
          {
            mapStyle: updater.payload.draftData?.mapStyle ?? { ...DEFAULT_MAP_STYLE },
            viewport: updater.payload.draftData?.viewport,
          },
          {
            name: updater.payload.draftMetadata?.name ?? '',
            description: updater.payload.draftMetadata?.description ?? '',
            tags: updater.payload.draftMetadata?.tags ?? [],
          },
        );
        await commitTreeNodeUpdater();
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

  // Initial fetch and viewport hydration (defer to Geolocation when allowed)
  useEffect(() => {
    fetchEntity().then(() => {
      if (!entity || entity.viewport) return;
      if (askedGeolocationRef.current) return;
      askedGeolocationRef.current = true;

      // If we already have a cached geolocation and viewport is still undefined, apply it immediately.
      if (geolocationCacheRef.current) {
        const cached = geolocationCacheRef.current;
        setEntity((prev) =>
          prev
            ? {
                ...prev,
                viewport: cached,
              }
            : prev
        );
        if (treeNodeUpdater) {
          void updatePayload({ viewport: cached }, treeNodeUpdater.draftData ?? undefined);
        }
        return;
      }

      // Show map immediately with fallback viewport
      const fallbackViewport = DEFAULT_VIEWPORT;
      setEntity((prev) =>
        prev
          ? {
              ...prev,
              viewport: fallbackViewport,
            }
          : prev
      );
      if (treeNodeUpdater) {
        void updatePayload({ viewport: fallbackViewport }, treeNodeUpdater.draftData ?? undefined);
      }

      // Then (once) ask and resolve geolocation; cache result for reuse
      if (typeof window !== 'undefined') {
        window.setTimeout(async () => {
          if (!navigator?.geolocation) return;
          const shouldUseGeo = window.confirm(
            'Use your current location to set the initial basemap view?'
          );
          if (!shouldUseGeo) return;
          const geoViewport = await getOrResolveViewport();
          setEntity((prev) =>
            prev
              ? {
                  ...prev,
                  viewport: geoViewport,
                }
              : prev
          );
          if (treeNodeUpdater) {
            updatePayload({ viewport: geoViewport }, treeNodeUpdater.draftData ?? undefined);
          }
        }, 0);
      }
    });
  }, [entity, fetchEntity, getOrResolveViewport, treeNodeUpdater, updateTreeNodeUpdater]);

  // Cleanup draft on unmount
  useEffect(() => {
    return () => {
      void discardDraft().catch(() => {});
    };
  }, [discardDraft]);

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
  buildBaseMapEntityFromNode,
};
