/**
 * React hook for BaseMap validation
 */

import { useState, useCallback } from 'react';
import { NodeId } from '@hierarchidb/common-core';
import { 
  BaseMapValidationResult,
  CreateBaseMapData, 
  UpdateBaseMapData,
  validateCreateBaseMapDataStrict,
  validateUpdateBaseMapDataStrict,
  validatePerformance,
  ValidationResult as EnhancedValidationResult
} from '../../shared';
import { useBaseMapAPI } from './useBaseMapAPI';

export interface UseBaseMapValidationResult {
  validationResult: BaseMapValidationResult | null;
  validating: boolean;
  validateConfiguration: (nodeId: NodeId) => Promise<BaseMapValidationResult>;
  validateCreateData: (data: CreateBaseMapData) => EnhancedValidationResult;
  validateUpdateData: (data: UpdateBaseMapData) => EnhancedValidationResult;
  validatePerformanceIssues: (data: CreateBaseMapData | UpdateBaseMapData) => EnhancedValidationResult;
}

/**
 * Hook for BaseMap validation operations
 */
export function useBaseMapValidation(): UseBaseMapValidationResult {
  const [validationResult, setValidationResult] = useState<BaseMapValidationResult | null>(null);
  const [validating, setValidating] = useState(false);
  
  const baseMapAPIPromise = useBaseMapAPI();

  // Validate map configuration on server
  const validateConfiguration = useCallback(async (nodeId: NodeId): Promise<BaseMapValidationResult> => {
    setValidating(true);
    try {
      const baseMapAPI = await baseMapAPIPromise;
      const result = await baseMapAPI.validateMapConfiguration(nodeId);
      setValidationResult(result);
      return result;
    } catch (err) {
      const errorResult: BaseMapValidationResult = {
        isValid: false,
        errors: [{ 
          code: 'VALIDATION_ERROR', 
          message: err instanceof Error ? err.message : 'Validation failed' 
        }],
        warnings: [],
        configuration: {
          hasValidStyle: false,
          hasValidViewport: false,
          hasValidBounds: false,
          estimatedTileCount: 0,
          estimatedDataSize: 0
        }
      };
      setValidationResult(errorResult);
      return errorResult;
    } finally {
      setValidating(false);
    }
  }, [baseMapAPIPromise]);

  // Validate create data (client-side with enhanced validation)
  const validateCreateData = useCallback((data: CreateBaseMapData): EnhancedValidationResult => {
    return validateCreateBaseMapDataStrict(data);
  }, []);

  // Validate update data (client-side with enhanced validation)
  const validateUpdateData = useCallback((data: UpdateBaseMapData): EnhancedValidationResult => {
    return validateUpdateBaseMapDataStrict(data);
  }, []);

  // Validate performance issues
  const validatePerformanceIssues = useCallback((data: CreateBaseMapData | UpdateBaseMapData): EnhancedValidationResult => {
    // Cast to CreateBaseMapData for validation - UpdateBaseMapData has optional fields
    const dataToValidate = 'name' in data && data.name 
      ? data as CreateBaseMapData 
      : { ...data, name: 'Untitled' } as CreateBaseMapData;
    
    const errors = validatePerformance(dataToValidate);
    
    return {
      isValid: errors.filter(e => e.severity === 'error').length === 0,
      errors: errors.filter(e => e.severity === 'error'),
      warnings: errors.filter(e => e.severity === 'warning')
    };
  }, []);

  return {
    validationResult,
    validating,
    validateConfiguration,
    validateCreateData,
    validateUpdateData,
    validatePerformanceIssues
  };
}