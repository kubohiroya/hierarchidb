/**
 * Step Capabilities Hook
 * Manages step capabilities evaluation and updates
 */

import { useState, useEffect, useCallback, useRef } from 'react';
import { NodeId } from '@hierarchidb/common-type';
import { StepCapabilitiesState } from '../services/WorkingCopyService';
import { useWorkerAPI } from './useWorkerAPI';
import { DialogStep } from '@hierarchidb/ui-dialog';

interface UseStepCapabilitiesOptions {
  nodeId: NodeId;
  steps: DialogStep[];
  currentStep: number;
  data: any;
}

interface UseStepCapabilitiesResult {
  capabilities: StepCapabilitiesState;
  isEvaluating: boolean;
  refreshCapabilities: () => Promise<void>;
}

/**
 * Hook for managing step capabilities
 */
export function useStepCapabilities({
  nodeId,
  steps,
  currentStep,
  data,
}: UseStepCapabilitiesOptions): UseStepCapabilitiesResult {
  const { api } = useWorkerAPI();
  const [capabilities, setCapabilities] = useState<StepCapabilitiesState>({
    canNavigateToSteps: new Map(),
    canProceedToNext: true,
    canBackToPrevious: true,
    canSave: true,
    canStartBatch: false,
  });
  const [isEvaluating, setIsEvaluating] = useState(false);
  const evaluationTimeoutRef = useRef<NodeJS.Timeout>();

  /**
   * Evaluate capabilities for current state
   */
  const evaluateCapabilities = useCallback(async () => {
    if (!api || !steps[currentStep]) return;

    setIsEvaluating(true);
    
    try {
      const currentStepConfig = steps[currentStep];
      
      // Evaluate current step capabilities
      const promises: Promise<any>[] = [];
      
      // Check if can proceed to next
      if (currentStepConfig.capabilities?.canProceedToNext) {
        promises.push(
          Promise.resolve(currentStepConfig.capabilities.canProceedToNext(data))
            .then(result => ({ type: 'canProceedToNext', value: result }))
        );
      }
      
      // Check if can go back
      if (currentStepConfig.capabilities?.canBackToPrevious) {
        promises.push(
          Promise.resolve(currentStepConfig.capabilities.canBackToPrevious(data))
            .then(result => ({ type: 'canBackToPrevious', value: result }))
        );
      }
      
      // Check if can save
      if (currentStepConfig.capabilities?.canSave) {
        promises.push(
          Promise.resolve(currentStepConfig.capabilities.canSave(data))
            .then(result => ({ type: 'canSave', value: result }))
        );
      }
      
      // Check if can start batch
      if (currentStepConfig.capabilities?.canStartBatch) {
        promises.push(
          Promise.resolve(currentStepConfig.capabilities.canStartBatch(data))
            .then(result => ({ type: 'canStartBatch', value: result }))
        );
      }
      
      // Check navigation to other steps
      const navigationChecks = steps.map((step, index) => {
        if (step.capabilities?.canNavigateTo) {
          return Promise.resolve(step.capabilities.canNavigateTo(currentStep, data))
            .then(result => ({ stepIndex: index, canNavigate: result }));
        }
        return Promise.resolve({ stepIndex: index, canNavigate: index <= currentStep + 1 });
      });
      
      promises.push(...navigationChecks);
      
      // Wait for all evaluations
      const results = await Promise.all(promises);
      
      // Build capabilities state
      const newCapabilities: StepCapabilitiesState = {
        canNavigateToSteps: new Map(),
        canProceedToNext: true,
        canBackToPrevious: true,
        canSave: true,
        canStartBatch: false,
      };
      
      results.forEach(result => {
        if ('type' in result) {
          switch (result.type) {
            case 'canProceedToNext':
              newCapabilities.canProceedToNext = result.value;
              break;
            case 'canBackToPrevious':
              newCapabilities.canBackToPrevious = result.value;
              break;
            case 'canSave':
              newCapabilities.canSave = result.value;
              break;
            case 'canStartBatch':
              newCapabilities.canStartBatch = result.value;
              break;
          }
        } else if ('stepIndex' in result) {
          newCapabilities.canNavigateToSteps.set(result.stepIndex, result.canNavigate);
        }
      });
      
      setCapabilities(newCapabilities);
    } catch (error) {
      console.error('Failed to evaluate capabilities:', error);
    } finally {
      setIsEvaluating(false);
    }
  }, [api, steps, currentStep, data]);

  /**
   * Debounced evaluation
   */
  const scheduleEvaluation = useCallback(() => {
    // Clear existing timeout
    if (evaluationTimeoutRef.current) {
      clearTimeout(evaluationTimeoutRef.current);
    }
    
    // Schedule new evaluation
    evaluationTimeoutRef.current = setTimeout(() => {
      evaluateCapabilities();
    }, 300); // 300ms debounce
  }, [evaluateCapabilities]);

  // Evaluate when data or step changes
  useEffect(() => {
    scheduleEvaluation();
    
    return () => {
      if (evaluationTimeoutRef.current) {
        clearTimeout(evaluationTimeoutRef.current);
      }
    };
  }, [data, currentStep, scheduleEvaluation]);

  // Manual refresh
  const refreshCapabilities = useCallback(async () => {
    await evaluateCapabilities();
  }, [evaluateCapabilities]);

  return {
    capabilities,
    isEvaluating,
    refreshCapabilities,
  };
}