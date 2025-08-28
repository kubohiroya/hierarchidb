/**
 * @file useBaseMapEntity.ts
 * @description React hook for fetching and managing BaseMap entity data
 */

import { useState, useEffect } from 'react';
import type { NodeId } from '@hierarchidb/common-type';
import type { BaseMapEntity } from '../types/BaseMapEntity';
import { BaseMapEntityHandler } from '../handlers/BaseMapEntityHandler';

export interface UseBaseMapEntityResult {
  entity: BaseMapEntity | null;
  loading: boolean;
  error: Error | null;
  refetch: () => void;
  updateEntity: (updates: Partial<BaseMapEntity>) => Promise<void>;
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

  const handler = new BaseMapEntityHandler();

  // Fetch entity
  const fetchEntity = async () => {
    if (!nodeId || skip) return;
    
    try {
      setLoading(true);
      setError(null);
      const data = await handler.getEntity(nodeId);
      
      if (data) {
        setEntity(data);
      } else {
        setEntity(null);
        setError(new Error('BaseMap entity not found'));
      }
    } catch (err) {
      console.error('Failed to fetch BaseMap entity:', err);
      setError(err instanceof Error ? err : new Error('Failed to fetch entity'));
      setEntity(null);
    } finally {
      setLoading(false);
    }
  };

  // Update entity
  const updateEntity = async (updates: Partial<BaseMapEntity>) => {
    if (!nodeId) {
      throw new Error('Cannot update entity without nodeId');
    }

    try {
      await handler.updateEntity(nodeId, updates);
      // Refetch to get updated data
      await fetchEntity();
    } catch (err) {
      console.error('Failed to update BaseMap entity:', err);
      throw err;
    }
  };

  // Initial fetch
  useEffect(() => {
    fetchEntity();
  }, [nodeId, skip]);

  // Polling
  useEffect(() => {
    if (!pollingInterval || !nodeId || skip) return;
    
    const interval = setInterval(fetchEntity, pollingInterval);
    return () => clearInterval(interval);
  }, [nodeId, pollingInterval, skip]);

  return {
    entity,
    loading,
    error,
    refetch: fetchEntity,
    updateEntity
  };
}

/**
 * Hook to fetch BaseMap configuration for export/display
 * @param nodeId - Node ID of the BaseMap entity
 * @returns BaseMap configuration
 */
export function useBaseMapConfiguration(nodeId: NodeId | null) {
  const [config, setConfig] = useState<{
    mapStyle: BaseMapEntity['mapStyle'];
    viewport: BaseMapEntity['viewport'];
    displayOptions: BaseMapEntity['displayOptions'];
  } | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    if (!nodeId) {
      setConfig(null);
      setLoading(false);
      return;
    }

    const handler = new BaseMapEntityHandler();
    
    const fetchConfig = async () => {
      try {
        setLoading(true);
        setError(null);
        const configuration = await handler.getConfiguration(nodeId);
        setConfig(configuration);
      } catch (err) {
        console.error('Failed to fetch BaseMap configuration:', err);
        setError(err instanceof Error ? err : new Error('Failed to fetch configuration'));
        setConfig(null);
      } finally {
        setLoading(false);
      }
    };

    fetchConfig();
  }, [nodeId]);

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
    const handler = new BaseMapEntityHandler();
    
    const validate = async () => {
      setValidating(true);
      try {
        const result = await handler.validateConfiguration(config);
        setValidation(result);
      } catch (err) {
        console.error('Validation error:', err);
        setValidation({
          isValid: false,
          errors: ['Validation failed: ' + (err as Error).message]
        });
      } finally {
        setValidating(false);
      }
    };

    // Debounce validation
    const timer = setTimeout(validate, 300);
    return () => clearTimeout(timer);
  }, [config]);

  return { ...validation, validating };
}