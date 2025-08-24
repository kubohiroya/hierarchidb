/**
 * React hook for BaseMap data management
 */

import { useState, useEffect, useCallback } from 'react';
import { NodeId } from '@hierarchidb/common-core';
import { 
  BaseMapEntity, 
  CreateBaseMapData, 
  UpdateBaseMapData,
  isBaseMapValidationError,
  isBaseMapEntityNotFoundError,
  isBaseMapApiError,
  BaseMapDataValidationError
} from '../../shared';
import { useBaseMapAPI } from './useBaseMapAPI';
// TODO: Replace with actual notification system when available

export interface UseBaseMapDataResult {
  entity: BaseMapEntity | undefined;
  loading: boolean;
  error: string | null;
  create: (data: CreateBaseMapData) => Promise<BaseMapEntity>;
  update: (data: UpdateBaseMapData) => Promise<void>;
  remove: () => Promise<void>;
  reload: () => Promise<void>;
}

/**
 * Hook for managing BaseMap entity data
 */
export function useBaseMapData(nodeId: NodeId): UseBaseMapDataResult {
  const [entity, setEntity] = useState<BaseMapEntity | undefined>();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  
  const baseMapAPIPromise = useBaseMapAPI();
  
  // Mock notification functions - replace with actual implementation
  const showNotification = (message: string) => console.log('Notification:', message);
  const showErrorNotification = (message: string) => console.error('Error:', message);

  // Load entity data
  const loadEntity = useCallback(async () => {
    if (!nodeId) return;
    
    try {
      setLoading(true);
      setError(null);
      const baseMapAPI = await baseMapAPIPromise;
      const entityData = await baseMapAPI.getEntity(nodeId);
      setEntity(entityData);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to load BaseMap';
      setError(message);
      showErrorNotification(message);
    } finally {
      setLoading(false);
    }
  }, [nodeId, baseMapAPIPromise, showErrorNotification]);

  // Create new entity
  const create = useCallback(async (data: CreateBaseMapData): Promise<BaseMapEntity> => {
    try {
      setError(null);
      const baseMapAPI = await baseMapAPIPromise;
      const newEntity = await baseMapAPI.createEntity(nodeId, data);
      setEntity(newEntity);
      showNotification(`BaseMap "${newEntity.name}" created successfully`);
      return newEntity;
    } catch (err) {
      let message = 'Failed to create BaseMap';
      
      if (isBaseMapValidationError(err)) {
        message = `Validation error: ${err.message}`;
      } else if (err instanceof BaseMapDataValidationError) {
        message = `Data validation failed: ${err.validationErrors.map(e => e.message).join(', ')}`;
      } else if (isBaseMapApiError(err)) {
        message = `API error: ${err.message}`;
      } else if (err instanceof Error) {
        message = err.message;
      }
      
      setError(message);
      showErrorNotification(message);
      throw err;
    }
  }, [nodeId, baseMapAPIPromise, showNotification, showErrorNotification]);

  // Update entity
  const update = useCallback(async (data: UpdateBaseMapData): Promise<void> => {
    try {
      setError(null);
      const baseMapAPI = await baseMapAPIPromise;
      await baseMapAPI.updateEntity(nodeId, data);
      await loadEntity(); // Reload to get updated data
      showNotification('BaseMap updated successfully');
    } catch (err) {
      let message = 'Failed to update BaseMap';
      
      if (isBaseMapValidationError(err)) {
        message = `Validation error: ${err.message}`;
      } else if (err instanceof BaseMapDataValidationError) {
        message = `Data validation failed: ${err.validationErrors.map(e => e.message).join(', ')}`;
      } else if (isBaseMapEntityNotFoundError(err)) {
        message = 'BaseMap not found';
      } else if (isBaseMapApiError(err)) {
        message = `API error: ${err.message}`;
      } else if (err instanceof Error) {
        message = err.message;
      }
      
      setError(message);
      showErrorNotification(message);
      throw err;
    }
  }, [nodeId, baseMapAPIPromise, loadEntity, showNotification, showErrorNotification]);

  // Delete entity
  const remove = useCallback(async (): Promise<void> => {
    if (!entity) return;
    
    try {
      setError(null);
      const baseMapAPI = await baseMapAPIPromise;
      await baseMapAPI.deleteEntity(nodeId);
      setEntity(undefined);
      showNotification(`BaseMap "${entity.name}" deleted successfully`);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to delete BaseMap';
      setError(message);
      showErrorNotification(message);
      throw err;
    }
  }, [nodeId, entity, baseMapAPIPromise, showNotification, showErrorNotification]);

  // Reload entity data
  const reload = useCallback(async (): Promise<void> => {
    await loadEntity();
  }, [loadEntity]);

  // Load entity on mount and nodeId change
  useEffect(() => {
    loadEntity();
  }, [loadEntity]);

  return {
    entity,
    loading,
    error,
    create,
    update,
    remove,
    reload
  };
}