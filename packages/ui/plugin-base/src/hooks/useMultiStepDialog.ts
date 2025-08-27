/**
 * @file useMultiStepDialog.ts
 * @description マルチステップダイアログ用のカスタムフック
 */

import { useState, useCallback, useRef, useEffect } from 'react';
import type { DialogStepDefinition, ValidationResult } from '../services/DialogStepRegistry';

// ============================================================================
// 型定義
// ============================================================================

/**
 * ステップデータの型
 */
export type StepData = Record<string, unknown>;

/**
 * ステップ間のデータ管理
 */
export interface StepDataManager {
  /** 現在のステップ番号 */
  currentStep: number;
  /** 各ステップのデータ */
  stepsData: Map<number, StepData>;
  /** 訪問済みステップ */
  visitedSteps: Set<number>;
  /** 完了済みステップ */
  completedSteps: Set<number>;
  /** 全体データ */
  aggregatedData: StepData;
}

/**
 * フックの戻り値
 */
export interface UseMultiStepDialogReturn {
  /** 現在のステップ */
  currentStep: number;
  /** ステップデータ管理 */
  dataManager: StepDataManager;
  /** ナビゲーション */
  navigation: {
    /** 次へ */
    goNext: () => void;
    /** 前へ */
    goPrevious: () => void;
    /** 特定ステップへ */
    goToStep: (stepNumber: number) => void;
    /** 最初へ */
    goToFirst: () => void;
    /** 最後へ */
    goToLast: () => void;
    /** 次へ進めるか */
    canGoNext: () => boolean;
    /** 前へ戻れるか */
    canGoPrevious: () => boolean;
    /** 特定ステップへ行けるか */
    canGoToStep: (stepNumber: number) => boolean;
  };
  /** データ操作 */
  data: {
    /** ステップデータ取得 */
    getStepData: (stepNumber: number) => StepData | undefined;
    /** ステップデータ更新 */
    updateStepData: (stepNumber: number, data: Partial<StepData>) => void;
    /** 全データ取得 */
    getAllData: () => StepData;
    /** データリセット */
    resetData: () => void;
    /** データマージ */
    mergeData: (data: StepData) => void;
  };
  /** バリデーション */
  validation: {
    /** ステップ検証 */
    validateStep: (stepNumber: number) => Promise<ValidationResult>;
    /** 全ステップ検証 */
    validateAll: () => Promise<Map<number, ValidationResult>>;
    /** エラー取得 */
    getErrors: (stepNumber: number) => string[];
    /** エラークリア */
    clearErrors: (stepNumber?: number) => void;
  };
  /** 状態管理 */
  state: {
    /** ローディング状態 */
    isLoading: boolean;
    /** エラー状態 */
    hasErrors: boolean;
    /** 完了状態 */
    isCompleted: boolean;
    /** ステップが完了済みか */
    isStepCompleted: (stepNumber: number) => boolean;
    /** ステップが訪問済みか */
    isStepVisited: (stepNumber: number) => boolean;
    /** 進捗率 */
    progress: number;
  };
  /** アクション */
  actions: {
    /** ローディング設定 */
    setLoading: (loading: boolean) => void;
    /** ステップ完了 */
    completeStep: (stepNumber: number) => void;
    /** リセット */
    reset: () => void;
    /** 完了 */
    complete: () => void;
  };
}

// ============================================================================
// カスタムフック
// ============================================================================

/**
 * マルチステップダイアログ用のカスタムフック
 */
export function useMultiStepDialog(
  stepDefinitions: DialogStepDefinition[],
  initialData: StepData = {}
): UseMultiStepDialogReturn {
  // ステップ番号のソート済み配列
  const sortedSteps = [...stepDefinitions].sort((a, b) => a.stepNumber - b.stepNumber);
  const stepNumbers = sortedSteps.map(s => s.stepNumber);
  
  // 状態管理
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
  
  // 集約データの計算
  const aggregatedData = useCallback((): StepData => {
    let result: StepData = {};
    stepsData.forEach((data) => {
      result = { ...result, ...data };
    });
    return result;
  }, [stepsData]);
  
  // ナビゲーション
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
      
      // 依存関係チェック
      if (stepDef.dependsOn) {
        return stepDef.dependsOn.every((dep: number) => completedSteps.has(dep));
      }
      
      return true;
    }, [completedSteps]),
  };
  
  // データ操作
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
  
  // バリデーション
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
  
  // 状態管理
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
  
  // アクション
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
  
  // データマネージャー
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