import { useCallback, useEffect, useRef, useState } from 'react';
import type { NodeId } from '@hierarchidb/common-types';
import type { StepCapabilitiesState } from '@hierarchidb/plugin-service-sdk';
import { useWorkerAPI } from './useWorkerAPI.js';
import type { DialogStep } from '@hierarchidb/ui-dialog';

interface UseStepCapabilitiesOptions {
  nodeId: NodeId;
  steps: DialogStep[];
  currentStep: number;
  data: any;
}

export interface UseStepCapabilitiesResult {
  capabilities: StepCapabilitiesState;
  isEvaluating: boolean;
  refreshCapabilities: () => Promise<void>;
}

export function useStepCapabilities({
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
  const evaluationTimeoutRef = useRef<ReturnType<typeof setTimeout>>();

  const evaluateCapabilities = useCallback(async () => {
    if (!api) return;
    const currentStepConfig = steps[currentStep];
    if (!currentStepConfig) return;

    setIsEvaluating(true);

    try {
      const promises: Promise<any>[] = [];

      if (currentStepConfig.capabilities?.canProceedToNext) {
        promises.push(
          Promise.resolve(currentStepConfig.capabilities.canProceedToNext(data))
            .then(result => ({ type: 'canProceedToNext', value: result })),
        );
      }

      if (currentStepConfig.capabilities?.canBackToPrevious) {
        promises.push(
          Promise.resolve(currentStepConfig.capabilities.canBackToPrevious(data))
            .then(result => ({ type: 'canBackToPrevious', value: result })),
        );
      }

      if (currentStepConfig.capabilities?.canSave) {
        promises.push(
          Promise.resolve(currentStepConfig.capabilities.canSave(data))
            .then(result => ({ type: 'canSave', value: result })),
        );
      }

      if (currentStepConfig.capabilities?.canStartBatch) {
        promises.push(
          Promise.resolve(currentStepConfig.capabilities.canStartBatch(data))
            .then(result => ({ type: 'canStartBatch', value: result })),
        );
      }

      const navigationChecks = steps.map((step, index) => {
        if (step.capabilities?.canNavigateTo) {
          return Promise.resolve(step.capabilities.canNavigateTo(currentStep, data))
            .then(result => ({ stepIndex: index, canNavigate: result }));
        }
        return Promise.resolve({ stepIndex: index, canNavigate: index <= currentStep + 1 });
      });

      promises.push(...navigationChecks);

      const results = await Promise.all(promises);

      const newCapabilities: StepCapabilitiesState = {
        canNavigateToSteps: new Map(),
        canProceedToNext: true,
        canBackToPrevious: true,
        canSave: true,
        canStartBatch: false,
      } satisfies StepCapabilitiesState;

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

  const scheduleEvaluation = useCallback(() => {
    if (evaluationTimeoutRef.current) {
      clearTimeout(evaluationTimeoutRef.current);
    }

    evaluationTimeoutRef.current = setTimeout(() => {
      evaluateCapabilities();
    }, 300);
  }, [evaluateCapabilities]);

  useEffect(() => {
    scheduleEvaluation();

    return () => {
      if (evaluationTimeoutRef.current) {
        clearTimeout(evaluationTimeoutRef.current);
      }
    };
  }, [data, currentStep, scheduleEvaluation]);

  const refreshCapabilities = useCallback(async () => {
    await evaluateCapabilities();
  }, [evaluateCapabilities]);

  return {
    capabilities,
    isEvaluating,
    refreshCapabilities,
  } satisfies UseStepCapabilitiesResult;
}

