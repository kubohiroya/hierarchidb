/**
 * useProjectAPI hook tests
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { renderHook } from '@testing-library/react';
import { useProjectAPI, useProjectAPIGetter } from '../../hooks/useProjectAPI';
import type { ProjectAPI } from '../../../shared';

// Mock useWorkerAPIClient
const mockWorkerAPIClient = {
  getAPI: vi.fn()
};

const mockWorkerAPI = {
  getPluginRegistryAPI: vi.fn()
};

const mockPluginRegistry = {
  getExtension: vi.fn()
};

const mockProjectAPI: ProjectAPI = {
  createEntity: vi.fn(),
  getEntity: vi.fn(),
  updateEntity: vi.fn(),
  deleteEntity: vi.fn(),
  addResourceReference: vi.fn(),
  removeResourceReference: vi.fn(),
  getResourceReferences: vi.fn(),
  configureLayer: vi.fn(),
  getLayerConfiguration: vi.fn(),
  removeLayerConfiguration: vi.fn(),
  aggregateProject: vi.fn(),
  getAggregationStatus: vi.fn(),
  getProjectStatistics: vi.fn()
};

vi.mock('@hierarchidb/ui-client', () => ({
  useWorkerAPIClient: () => mockWorkerAPIClient
}));

describe('useProjectAPI hooks', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    
    mockWorkerAPIClient.getAPI.mockReturnValue(mockWorkerAPI);
    mockWorkerAPI.getPluginRegistryAPI.mockResolvedValue(mockPluginRegistry);
    mockPluginRegistry.getExtension.mockResolvedValue(mockProjectAPI);
  });

  describe('useProjectAPI', () => {
    it('should return a Promise that resolves to ProjectAPI', async () => {
      const { result } = renderHook(() => useProjectAPI());

      // The hook returns a Promise
      expect(result.current).toBeInstanceOf(Promise);

      // Resolve the promise to get the API
      const api = await result.current;
      expect(api).toBe(mockProjectAPI);

      // Verify the call chain
      expect(mockWorkerAPIClient.getAPI).toHaveBeenCalled();
      expect(mockWorkerAPI.getPluginRegistryAPI).toHaveBeenCalled();
      expect(mockPluginRegistry.getExtension).toHaveBeenCalledWith('project');
    });

    it('should memoize the result', () => {
      const { result, rerender } = renderHook(() => useProjectAPI());

      const promise1 = result.current;
      
      // Rerender without changing dependencies
      rerender();
      
      const promise2 = result.current;
      
      // Should be the same promise instance (memoized)
      expect(promise1).toBe(promise2);
    });
  });

  describe('useProjectAPIGetter', () => {
    it('should return a function that gets ProjectAPI', async () => {
      const { result } = renderHook(() => useProjectAPIGetter());

      // Should return a function
      expect(typeof result.current).toBe('function');

      // Call the function to get the API
      const api = await result.current();
      expect(api).toBe(mockProjectAPI);

      // Verify the call chain
      expect(mockWorkerAPIClient.getAPI).toHaveBeenCalled();
      expect(mockWorkerAPI.getPluginRegistryAPI).toHaveBeenCalled();
      expect(mockPluginRegistry.getExtension).toHaveBeenCalledWith('project');
    });

    it('should memoize the getter function', () => {
      const { result, rerender } = renderHook(() => useProjectAPIGetter());

      const getter1 = result.current;
      
      // Rerender without changing dependencies
      rerender();
      
      const getter2 = result.current;
      
      // Should be the same function instance (memoized)
      expect(getter1).toBe(getter2);
    });

    it('should be suitable for use in event handlers', async () => {
      const { result } = renderHook(() => useProjectAPIGetter());
      const getProjectAPI = result.current;

      // Simulate multiple calls in event handlers
      const api1 = await getProjectAPI();
      const api2 = await getProjectAPI();

      expect(api1).toBe(mockProjectAPI);
      expect(api2).toBe(mockProjectAPI);
    });
  });

  describe('error handling', () => {
    it('should handle API access errors', async () => {
      const error = new Error('Plugin API not found');
      mockPluginRegistry.getExtension.mockRejectedValue(error);

      const { result } = renderHook(() => useProjectAPI());

      await expect(result.current).rejects.toThrow('Plugin API not found');
    });

    it('should handle worker API errors', async () => {
      const error = new Error('Worker API not available');
      mockWorkerAPI.getPluginRegistryAPI.mockRejectedValue(error);

      const { result } = renderHook(() => useProjectAPI());

      await expect(result.current).rejects.toThrow('Worker API not available');
    });
  });
});