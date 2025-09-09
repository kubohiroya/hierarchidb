/**
  * @file useMultiStepDialog.ts
 * @description
  */

import { useCallback, useEffect, useRef, useState } from 'react';
import type { DialogStepDefinition, ValidationResult } from '../services/DialogStepRegistry';

// ============================================================================
// ============================================================================

/**
    */
export type StepData = Record<string, unknown>;

/**
    */
export interface StepDataManager {
  /**
      */
  currentStep: number;
  /**
      */
  stepsData: Map<number, StepData>;
  /**
      */
  visitedSteps: Set<number>;
  /**
      */
  completedSteps: Set<number>;
  /**
      */
  aggregatedData: StepData;
}

/**
    */
export interface UseMultiStepDialogReturn {
  /**
      */
  currentStep: number;
  /**
      */
  dataManager: StepDataManager;
  /**
      */
  navigation: {
    /**
          */
    goNext: () => void;
    /**
          */
    goPrevious: () => void;
    /**
          */
    goToStep: (stepNumber: number) => void;
    /**
          */
    goToFirst: () => void;
    /**
          */
    goToLast: () => void;
    /**
          */
    canGoNext: () => boolean;
    /**
          */
    canGoPrevious: () => boolean;
    /**
          */
    canGoToStep: (stepNumber: number) => boolean;
  };
  /**
      */
  data: {
    /**
          */
    getStepData: (stepNumber: number) => StepData | undefined;
    /**
          */
    updateStepData: (stepNumber: number, data: Partial<StepData>) => void;
    /**
          */
    getAllData: () => StepData;
    /**
          */
    resetData: () => void;
    /**
          */
    mergeData: (data: StepData) => void;
  };
  /**
      */
  validation: {
    /**
          */
    validateStep: (stepNumber: number) => Promise<ValidationResult>;
    /**
          */
    validateAll: () => Promise<Map<number, ValidationResult>>;
    /**
          */
    getErrors: (stepNumber: number) => string[];
    /**
          */
    clearErrors: (stepNumber?: number) => void;
  };
  /**
      */
  state: {
    /**
          */
    isLoading: boolean;
    /**
          */
    hasErrors: boolean;
    /**
          */
    isCompleted: boolean;
    /**
          */
    isStepCompleted: (stepNumber: number) => boolean;
    /**
          */
    isStepVisited: (stepNumber: number) => boolean;
    /**
          */
    progress: number;
  };
  /**
      */
  actions: {
    /**
          */
    setLoading: (loading: boolean) => void;
    /**
          */
    completeStep: (stepNumber: number) => void;
    /**
          */
    reset: () => void;
    /**
          */
    complete: () => void;
  };
}

// ============================================================================
// ============================================================================

/**
    */
export function useMultiStepDialog(
  stepDefinitions: DialogStepDefinition[],
  initialData: StepData = {},
): UseMultiStepDialogReturn {
  const sortedSteps = [...stepDefinitions].sort((a, b) => a.stepNumber - b.stepNumber);
  const stepNumbers = sortedSteps.map(s => s.stepNumber);

  const initialStep = stepNumbers[0] || 1;
  const [currentStep, setCurrentStep] = useState(initialStep);
  const [stepsData, setStepsData] = useState<Map<number, StepData>>(() => {
    const map = new Map();
    if (Object.keys(initialData).length > 0) {
      map.set(initialStep, initialData);
    }
    return map;
  });
  const [visitedSteps, setVisitedSteps] = useState<Set<number>>(new Set([initialStep]));
  const [completedSteps, setCompletedSteps] = useState<Set<number>>(new Set());
  const [errors, setErrors] = useState<Map<number, string[]>>(new Map());
  const [isLoading, setIsLoading] = useState(false);
  const [isCompleted, setIsCompleted] = useState(false);

  // Refs for callbacks
  const stepDefinitionsRef = useRef(stepDefinitions);
  useEffect(() => {
    stepDefinitionsRef.current = stepDefinitions;
  }, [stepDefinitions]);

  const aggregatedData = useCallback((): StepData => {
    let result: StepData = {};
    stepsData.forEach((data) => {
      result = { ...result, ...data };
    });
    return result;
  }, [stepsData]);

  const navigation = {
    goNext: useCallback(() => {
      const currentIndex = stepNumbers.indexOf(currentStep);
      if (currentIndex < stepNumbers.length - 1) {
        const nextStep = stepNumbers[currentIndex + 1];
        if (nextStep !== undefined) {
          setCurrentStep(nextStep);
          setVisitedSteps(prev => new Set([...prev, nextStep]));
        }
      }
    }, [currentStep, stepNumbers]),

    goPrevious: useCallback(() => {
      const currentIndex = stepNumbers.indexOf(currentStep);
      if (currentIndex > 0) {
        const prevStep = stepNumbers[currentIndex - 1];
        if (prevStep !== undefined) {
          setCurrentStep(prevStep);
        }
      }
    }, [currentStep, stepNumbers]),

    goToStep: useCallback((stepNumber: number) => {
      if (stepNumbers.includes(stepNumber)) {
        setCurrentStep(stepNumber);
        setVisitedSteps(prev => new Set([...prev, stepNumber]));
      }
    }, [stepNumbers]),

    goToFirst: useCallback(() => {
      const firstStep = stepNumbers[0];
      if (firstStep !== undefined) {
        setCurrentStep(firstStep);
        setVisitedSteps(new Set([firstStep]));
      }
    }, [stepNumbers]),

    goToLast: useCallback(() => {
      const lastStep = stepNumbers[stepNumbers.length - 1];
      if (lastStep !== undefined) {
        setCurrentStep(lastStep);
        setVisitedSteps(new Set(stepNumbers));
      }
    }, [stepNumbers]),

    canGoNext: useCallback(() => {
      const currentIndex = stepNumbers.indexOf(currentStep);
      return currentIndex < stepNumbers.length - 1 && !errors.has(currentStep);
    }, [currentStep, stepNumbers, errors]),

    canGoPrevious: useCallback(() => {
      const currentIndex = stepNumbers.indexOf(currentStep);
      return currentIndex > 0;
    }, [currentStep, stepNumbers]),

    canGoToStep: useCallback((stepNumber: number) => {
      const stepDef = stepDefinitionsRef.current.find(s => s.stepNumber === stepNumber);
      if (!stepDef) return false;

      if (stepDef.dependsOn) {
        return stepDef.dependsOn.every((dep: number) => completedSteps.has(dep));
      }

      return true;
    }, [completedSteps]),
  };

  const data = {
    getStepData: useCallback((stepNumber: number) => {
      return stepsData.get(stepNumber);
    }, [stepsData]),

    updateStepData: useCallback((stepNumber: number, data: Partial<StepData>) => {
      setStepsData(prev => {
        const newMap = new Map(prev);
        const existing = newMap.get(stepNumber) || {};
        newMap.set(stepNumber, { ...existing, ...data });
        return newMap;
      });
    }, []),

    getAllData: useCallback(() => {
      return aggregatedData();
    }, [aggregatedData]),

    resetData: useCallback(() => {
      setStepsData(new Map());
      setErrors(new Map());
    }, []),

    mergeData: useCallback((data: StepData) => {
      setStepsData(prev => {
        const newMap = new Map(prev);
        const existing = newMap.get(currentStep) || {};
        newMap.set(currentStep, { ...existing, ...data });
        return newMap;
      });
    }, [currentStep]),
  };

  const validateStep = useCallback(async (stepNumber: number): Promise<ValidationResult> => {
    const stepDef = stepDefinitionsRef.current.find(s => s.stepNumber === stepNumber);
    if (!stepDef?.validation) {
      return { isValid: true, errors: [] };
    }

    const stepData = stepsData.get(stepNumber) || {};
    const result = await stepDef.validation.validate(stepData);

    if (!result.isValid) {
      setErrors(prev => new Map(prev).set(stepNumber, result.errors));
    } else {
      setErrors(prev => {
        const newMap = new Map(prev);
        newMap.delete(stepNumber);
        return newMap;
      });
    }

    return result;
  }, [stepsData]);

  const validation = {
    validateStep,

    validateAll: useCallback(async () => {
      const results = new Map<number, ValidationResult>();

      for (const stepDef of stepDefinitionsRef.current) {
        if (stepDef.validation) {
          const result = await validateStep(stepDef.stepNumber);
          results.set(stepDef.stepNumber, result);
        }
      }

      return results;
    }, [validateStep]),

    getErrors: useCallback((stepNumber: number) => {
      return errors.get(stepNumber) || [];
    }, [errors]),

    clearErrors: useCallback((stepNumber?: number) => {
      if (stepNumber !== undefined) {
        setErrors(prev => {
          const newMap = new Map(prev);
          newMap.delete(stepNumber);
          return newMap;
        });
      } else {
        setErrors(new Map());
      }
    }, []),
  };

  const state = {
    isLoading,
    hasErrors: errors.size > 0,
    isCompleted,
    isStepCompleted: useCallback((stepNumber: number) => {
      return completedSteps.has(stepNumber);
    }, [completedSteps]),
    isStepVisited: useCallback((stepNumber: number) => {
      return visitedSteps.has(stepNumber);
    }, [visitedSteps]),
    progress: (completedSteps.size / stepNumbers.length) * 100,
  };

  const actions = {
    setLoading: setIsLoading,
    completeStep: useCallback((stepNumber: number) => {
      setCompletedSteps(prev => new Set([...prev, stepNumber]));
    }, []),
    reset: useCallback(() => {
      const firstStep = stepNumbers[0] || 1;
      setCurrentStep(firstStep);
      setStepsData(new Map());
      setVisitedSteps(new Set([firstStep]));
      setCompletedSteps(new Set());
      setErrors(new Map());
      setIsLoading(false);
      setIsCompleted(false);
    }, [stepNumbers]),
    complete: useCallback(() => {
      setIsCompleted(true);
      setCompletedSteps(new Set(stepNumbers));
    }, [stepNumbers]),
  };

  const dataManager: StepDataManager = {
    currentStep,
    stepsData,
    visitedSteps,
    completedSteps,
    aggregatedData: aggregatedData(),
  };

  return {
    currentStep,
    dataManager,
    navigation,
    data,
    validation,
    state,
    actions,
  };
}