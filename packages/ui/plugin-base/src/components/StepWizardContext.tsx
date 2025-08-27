/**
 * @file StepWizardContext.tsx
 * @description マルチステップウィザードのコンテキスト
 */

import React, { createContext, useContext, useReducer, useMemo } from 'react';
import type { DialogStepDefinition, ValidationResult } from '../services/DialogStepRegistry';

// ============================================================================
// 型定義
// ============================================================================

/**
 * ステップの状態
 */
export interface StepState {
  /** ステップ番号 */
  stepNumber: number;
  /** 完了済みか */
  isCompleted: boolean;
  /** 検証済みか */
  isValidated: boolean;
  /** エラーメッセージ */
  errors: string[];
  /** データ */
  data: Record<string, unknown>;
}

/**
 * ウィザード全体の状態
 */
export interface WizardState {
  /** 現在のステップ番号 */
  currentStep: number;
  /** 各ステップの状態 */
  steps: Map<number, StepState>;
  /** 全体のデータ */
  data: Record<string, unknown>;
  /** ウィザード完了済みか */
  isCompleted: boolean;
  /** ローディング中か */
  isLoading: boolean;
}

/**
 * ウィザードアクション
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
 * ウィザードコンテキスト値
 */
export interface WizardContextValue {
  /** 現在の状態 */
  state: WizardState;
  /** アクション */
  actions: {
    /** 次のステップへ */
    goToNext: () => void;
    /** 前のステップへ */
    goPrevious: () => void;
    /** 特定のステップへ */
    goToStep: (stepNumber: number) => void;
    /** ステップデータ更新 */
    updateStepData: (stepNumber: number, data: Record<string, unknown>) => void;
    /** ステップ検証 */
    validateStep: (stepNumber: number, result: ValidationResult) => void;
    /** ステップ完了 */
    completeStep: (stepNumber: number) => void;
    /** ウィザードリセット */
    reset: () => void;
    /** ウィザード完了 */
    complete: () => void;
  };
  /** ヘルパー */
  helpers: {
    /** 次へ進めるか */
    canGoNext: () => boolean;
    /** 前へ戻れるか */
    canGoPrevious: () => boolean;
    /** 特定のステップへ行けるか */
    canGoToStep: (stepNumber: number) => boolean;
    /** 現在のステップ取得 */
    getCurrentStep: () => StepState | undefined;
    /** 全データ取得 */
    getAllData: () => Record<string, unknown>;
  };
  /** ステップ定義 */
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
      
      // 全体データも更新
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
// ヘルパー関数
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
 * ウィザードコンテキストプロバイダー
 */
export interface WizardProviderProps {
  /** 子要素 */
  children: React.ReactNode;
  /** ステップ定義 */
  stepDefinitions: DialogStepDefinition[];
  /** 初期データ */
  initialData?: Record<string, unknown>;
}

export function WizardProvider({
  children,
  stepDefinitions,
  initialData = {},
}: WizardProviderProps) {
  const [state, dispatch] = useReducer(
    wizardReducer,
    (() => {
      const initialState = createInitialState(stepDefinitions);
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
    })()
  );

  // アクション
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

  // ヘルパー
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
      // 依存関係をチェック
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
    [state, actions, helpers, stepDefinitions]
  );

  return <WizardContext.Provider value={value}>{children}</WizardContext.Provider>;
}

/**
 * ウィザードコンテキストを使用するフック
 */
export function useWizard() {
  const context = useContext(WizardContext);
  if (!context) {
    throw new Error('useWizard must be used within a WizardProvider');
  }
  return context;
}