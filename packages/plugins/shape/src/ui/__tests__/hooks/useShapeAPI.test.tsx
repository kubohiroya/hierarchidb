/**
 * Shape API hook tests
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook } from '@testing-library/react';
import { useShapeAPI, useShapeAPIGetter } from '../../hooks/useShapeAPI';
import type { ShapeAPI } from '../../../shared';

// Mock @hierarchidb/ui-client
const mockWorkerAPI = {
  getPluginRegistryAPI: vi.fn()
};

const mockPluginRegistry = {
  getExtension: vi.fn()
};

const mockShapeAPI: ShapeAPI = {
  createEntity: vi.fn(),
  getEntity: vi.fn(),
  updateEntity: vi.fn(),
  deleteEntity: vi.fn(),
  getDataSourceConfigs: vi.fn(),
  getCountryMetadata: vi.fn(),
  generateUrlMetadata: vi.fn(),
  validateSelection: vi.fn(),
  calculateSelectionStats: vi.fn(),
  startBatchProcessing: vi.fn(),
  pauseBatchProcessing: vi.fn(),
  resumeBatchProcessing: vi.fn(),
  cancelBatchProcessing: vi.fn(),
  getBatchSession: vi.fn(),
  getBatchTasks: vi.fn(),
  getBatchProgress: vi.fn(),
  createWorkingCopy: vi.fn(),
  getWorkingCopy: vi.fn(),
  updateWorkingCopy: vi.fn(),
  commitWorkingCopy: vi.fn(),
  discardWorkingCopy: vi.fn(),
  getProcessedFeatureCount: vi.fn(),
  getVectorTileInfo: vi.fn(),
  getProcessingStatus: vi.fn(),
  cleanupProcessingData: vi.fn()
};

const mockClient = {
  getAPI: vi.fn(() => mockWorkerAPI)
};

vi.mock('@hierarchidb/ui-client', () => ({
  useWorkerAPIClient: () => mockClient
}));

describe('useShapeAPI', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockWorkerAPI.getPluginRegistryAPI.mockResolvedValue(mockPluginRegistry);
    mockPluginRegistry.getExtension.mockResolvedValue(mockShapeAPI);
  });

  it('should return Shape API instance', async () => {
    const { result } = renderHook(() => useShapeAPI());
    const api = await result.current;
    
    expect(api).toBe(mockShapeAPI);
    expect(mockWorkerAPI.getPluginRegistryAPI).toHaveBeenCalled();
    expect(mockPluginRegistry.getExtension).toHaveBeenCalledWith('shape');
  });

  it('should memoize the API instance', async () => {
    const { result, rerender } = renderHook(() => useShapeAPI());
    
    const api1 = await result.current;
    rerender();
    const api2 = await result.current;
    
    expect(api1).toBe(api2);
    expect(mockWorkerAPI.getPluginRegistryAPI).toHaveBeenCalledTimes(1);
  });
});

describe('useShapeAPIGetter', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockWorkerAPI.getPluginRegistryAPI.mockResolvedValue(mockPluginRegistry);
    mockPluginRegistry.getExtension.mockResolvedValue(mockShapeAPI);
  });

  it('should return a function that gets Shape API', async () => {
    const { result } = renderHook(() => useShapeAPIGetter());
    const getAPI = result.current;
    
    expect(typeof getAPI).toBe('function');
    
    const api = await getAPI();
    expect(api).toBe(mockShapeAPI);
    expect(mockPluginRegistry.getExtension).toHaveBeenCalledWith('shape');
  });

  it('should return the same function instance on re-renders', () => {
    const { result, rerender } = renderHook(() => useShapeAPIGetter());
    
    const getAPI1 = result.current;
    rerender();
    const getAPI2 = result.current;
    
    expect(getAPI1).toBe(getAPI2);
  });

  it('should allow multiple calls to the getter function', async () => {
    const { result } = renderHook(() => useShapeAPIGetter());
    const getAPI = result.current;
    
    const api1 = await getAPI();
    const api2 = await getAPI();
    
    expect(api1).toBe(mockShapeAPI);
    expect(api2).toBe(mockShapeAPI);
    expect(mockPluginRegistry.getExtension).toHaveBeenCalledTimes(2);
  });
});