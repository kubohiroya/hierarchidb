/**
  * @file StepWizardContext.tsx
 * @description
  */

import { createContext, useContext, useMemo, useReducer } from 'react';
import type { DialogStepDefinition, ValidationResult } from '../services/DialogStepRegistry';

// ============================================================================
// ============================================================================

/**
    */
export interface StepState {
  /**
      */
  stepNumber: number;
  /**
      */
  isCompleted: boolean;
  /**
      */
  isValidated: boolean;
  /**
      */
  errors: string[];
  /**
      */
  data: Record<string, unknown>;
}

/**
    */
export interface WizardState {
  /**
      */
  currentStep: number;
  /**
      */
  steps: Map<number, StepState>;
  /**
      */
  data: Record<string, unknown>;
  /**
      */
  isCompleted: boolean;
  /**
      */
  isLoading: boolean;
}

/**
    */
export type WizardAction =
  | { type: 'SET_CURRENT_STEP'; payload: number }
  | { type: 'UPDATE_STEP_DATA'; payload: { stepNumber: number; data: Record<string, unknown> } }
  | { type: 'VALIDATE_STEP'; payload: { stepNumber: number; isValid: boolean; errors?: string[] } }
  | { type: 'COMPLETE_STEP'; payload: number }
  | { type: 'SET_LOADING'; payload: boolean }
  | { type: 'RESET_WIZARD' }
  | { type: 'COMPLETE_WIZARD' };

/**
    */
export interface WizardContextValue {
  /**
      */
  state: WizardState;
  /**
      */
  actions: {
    /**
          */
    goToNext: () => void;
    /**
          */
    goPrevious: () => void;
    /**
          */
    goToStep: (stepNumber: number) => void;
    /**
          */
    updateStepData: (stepNumber: number, data: Record<string, unknown>) => void;
    /**
          */
    validateStep: (stepNumber: number, result: ValidationResult) => void;
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
  /**
      */
  helpers: {
    /**
          */
    canGoNext: () => boolean;
    /**
          */
    canGoPrevious: () => boolean;
    /**
          */
    canGoToStep: (stepNumber: number) => boolean;
    /**
          */
    getCurrentStep: () => StepState | undefined;
    /**
          */
    getAllData: () => Record<string, unknown>;
  };
  /**
      */
  stepDefinitions: DialogStepDefinition[];
}

// ============================================================================
// Reducer
// ============================================================================

function wizardReducer(state: WizardState, action: WizardAction): WizardState {
  switch (action.type) {
    case 'SET_CURRENT_STEP':
      return {
        ...state,
        currentStep: action.payload,
      };

    case 'UPDATE_STEP_DATA': {
      const { stepNumber, data } = action.payload;
      const step = state.steps.get(stepNumber) || createEmptyStep(stepNumber);
      const updatedStep = { ...step, data: { ...step.data, ...data } };
      const newSteps = new Map(state.steps);
      newSteps.set(stepNumber, updatedStep);

      const allData = { ...state.data, ...data };

      return {
        ...state,
        steps: newSteps,
        data: allData,
      };
    }

    case 'VALIDATE_STEP': {
      const { stepNumber, isValid, errors = [] } = action.payload;
      const step = state.steps.get(stepNumber) || createEmptyStep(stepNumber);
      const updatedStep = {
        ...step,
        isValidated: true,
        errors: isValid ? [] : errors,
      };
      const newSteps = new Map(state.steps);
      newSteps.set(stepNumber, updatedStep);

      return {
        ...state,
        steps: newSteps,
      };
    }

    case 'COMPLETE_STEP': {
      const stepNumber = action.payload;
      const step = state.steps.get(stepNumber) || createEmptyStep(stepNumber);
      const updatedStep = { ...step, isCompleted: true };
      const newSteps = new Map(state.steps);
      newSteps.set(stepNumber, updatedStep);

      return {
        ...state,
        steps: newSteps,
      };
    }

    case 'SET_LOADING':
      return {
        ...state,
        isLoading: action.payload,
      };

    case 'RESET_WIZARD':
      return createInitialState([]);

    case 'COMPLETE_WIZARD':
      return {
        ...state,
        isCompleted: true,
      };

    default:
      return state;
  }
}

// ============================================================================
// ============================================================================

function createEmptyStep(stepNumber: number): StepState {
  return {
    stepNumber,
    isCompleted: false,
    isValidated: false,
    errors: [],
    data: {},
  };
}

function createInitialState(stepDefinitions: DialogStepDefinition[]): WizardState {
  const steps = new Map<number, StepState>();
  stepDefinitions.forEach((def) => {
    steps.set(def.stepNumber, createEmptyStep(def.stepNumber));
  });

  return {
    currentStep: stepDefinitions[0]?.stepNumber || 1,
    steps,
    data: {},
    isCompleted: false,
    isLoading: false,
  };
}

// ============================================================================
// Context
// ============================================================================

const WizardContext = createContext<WizardContextValue | undefined>(undefined);

/**
    */
export interface WizardProviderProps {
  /**
      */
  children: React.ReactNode;
  /**
      */
  stepDefinitions: DialogStepDefinition[];
  /**
      */
  initialData?: Record<string, unknown>;
  /**
      */
  initialStep?: number;
  /**
      */
  onStepChange?: (step: number) => void;
}

export function WizardProvider({
                                 children,
                                 stepDefinitions,
                                 initialData = {},
                                 initialStep,
                                 onStepChange,
                               }: WizardProviderProps) {
  const [state, dispatch] = useReducer(
    wizardReducer,
    (() => {
      const initialState = createInitialState(stepDefinitions);

      if (initialStep !== undefined && stepDefinitions.some(s => s.stepNumber === initialStep)) {
        initialState.currentStep = initialStep;
      }

      // Set initial data for the first step
      if (stepDefinitions.length > 0 && Object.keys(initialData).length > 0) {
        const firstStepNumber = stepDefinitions[0]!.stepNumber;
        const firstStep = initialState.steps.get(firstStepNumber);
        if (firstStep) {
          const updatedFirstStep = { ...firstStep, data: initialData };
          initialState.steps.set(firstStepNumber, updatedFirstStep);
        }
      }
      return { ...initialState, data: initialData };
    })(),
  );

  const actions = useMemo(() => ({
    goToNext: () => {
      const sortedSteps = [...stepDefinitions].sort((a, b) => a.stepNumber - b.stepNumber);
      const currentIndex = sortedSteps.findIndex(s => s.stepNumber === state.currentStep);
      if (currentIndex < sortedSteps.length - 1) {
        const nextStep = sortedSteps[currentIndex + 1];
        if (nextStep) {
          dispatch({ type: 'SET_CURRENT_STEP', payload: nextStep.stepNumber });
        }
      }
    },

    goPrevious: () => {
      const sortedSteps = [...stepDefinitions].sort((a, b) => a.stepNumber - b.stepNumber);
      const currentIndex = sortedSteps.findIndex(s => s.stepNumber === state.currentStep);
      if (currentIndex > 0) {
        const prevStep = sortedSteps[currentIndex - 1];
        if (prevStep) {
          dispatch({ type: 'SET_CURRENT_STEP', payload: prevStep.stepNumber });
        }
      }
    },

    goToStep: (stepNumber: number) => {
      dispatch({ type: 'SET_CURRENT_STEP', payload: stepNumber });
      if (onStepChange) {
        onStepChange(stepNumber);
      }
    },

    updateStepData: (stepNumber: number, data: Record<string, unknown>) => {
      dispatch({ type: 'UPDATE_STEP_DATA', payload: { stepNumber, data } });
    },

    validateStep: (stepNumber: number, result: ValidationResult) => {
      dispatch({
        type: 'VALIDATE_STEP',
        payload: { stepNumber, isValid: result.isValid, errors: result.errors },
      });
    },

    completeStep: (stepNumber: number) => {
      dispatch({ type: 'COMPLETE_STEP', payload: stepNumber });
    },

    reset: () => {
      dispatch({ type: 'RESET_WIZARD' });
    },

    complete: () => {
      dispatch({ type: 'COMPLETE_WIZARD' });
    },
  }), [state.currentStep, stepDefinitions]);

  const helpers = useMemo(() => ({
    canGoNext: () => {
      const currentStepState = state.steps.get(state.currentStep);
      return currentStepState?.isValidated === true && currentStepState.errors.length === 0;
    },

    canGoPrevious: () => {
      const sortedSteps = [...stepDefinitions].sort((a, b) => a.stepNumber - b.stepNumber);
      const currentIndex = sortedSteps.findIndex(s => s.stepNumber === state.currentStep);
      return currentIndex > 0;
    },

    canGoToStep: (stepNumber: number) => {
      const targetStep = stepDefinitions.find(s => s.stepNumber === stepNumber);
      if (!targetStep) return false;

      if (targetStep.dependsOn) {
        return targetStep.dependsOn.every((depNum: number) => {
          const depStep = state.steps.get(depNum);
          return depStep?.isCompleted === true;
        });
      }

      return true;
    },

    getCurrentStep: () => {
      return state.steps.get(state.currentStep);
    },

    getAllData: () => {
      return state.data;
    },
  }), [state, stepDefinitions]);

  const value = useMemo(
    () => ({ state, actions, helpers, stepDefinitions }),
    [state, actions, helpers, stepDefinitions],
  );

  return <WizardContext.Provider value={value}>{children}</WizardContext.Provider>;
}

/**
    */
export function useWizard() {
  const context = useContext(WizardContext);
  if (!context) {
    throw new Error('useWizard must be used within a WizardProvider');
  }
  return context;
}