import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { DialogData } from '~/types/PluginDialog.types';

export type StepLike = {
  id: string;
  optional?: boolean;
  validate?: () => boolean | Promise<boolean>;
  onEnter?: () => void | Promise<void>;
  onLeave?: () => void | Promise<void>;
};

export interface EvaluatedSteps {
  enabled?: ReadonlyArray<boolean>;
  validated?: ReadonlyArray<boolean>;
}

export interface ControllerOptions<TData = DialogData> {
  steps: StepLike[];
  currentData?: TData;
  evaluateSubmit?: (data: TData) => boolean | Promise<boolean>;
  nonLinear?: boolean;
  loading?: boolean;
  activeStep?: number;
  onStepChange?: (next: number) => void;
  onStepTransition?: (from: number, to: number, data: TData) => boolean | Promise<boolean>;
  onSubmit: () => Promise<void> | void;
  evaluated?: EvaluatedSteps;
}

export interface Controller {
  currentStep: number;
  currentStepConfig?: StepLike;
  isFirstStep: boolean;
  isLastStep: boolean;
  stepErrors: Map<number, string>;
  setStepError: (index: number, msg?: string) => void;
  clearStepError: (index?: number) => void;
  completedSteps: Set<number>;
  handleStepChange: (next: number) => Promise<void>;
  handleNext: () => Promise<void>;
  handleBack: () => Promise<void>;
  handleStepClick: (index: number) => Promise<void>;
  handleSubmit: () => Promise<void>;
  canSubmit: boolean;
  validateCurrentStep: () => Promise<boolean>;
}

export function useMultiStepController<TData = DialogData>(opts: ControllerOptions<TData>): Controller {
  const {
    steps,
    currentData: data,
    evaluateSubmit,
    nonLinear = false,
    loading = false,
    activeStep,
    onStepChange,
    onStepTransition,
    onSubmit,
    evaluated,
  } = opts;

  const [internalActiveStep, setInternalActiveStep] = useState(0);
  const controlled = typeof activeStep === 'number';
  const currentStep = controlled ? (activeStep as number) : internalActiveStep;
  const currentStepConfig = steps[currentStep];
  const isFirstStep = currentStep === 0;
  const isLastStep = currentStep === steps.length - 1;

  const [stepErrors, setStepErrors] = useState<Map<number, string>>(new Map());
  const setStepError = useCallback((index: number, msg?: string) => {
    setStepErrors((prev) => {
      const next = new Map(prev);
      if (!msg) next.delete(index); else next.set(index, msg);
      return next;
    });
  }, []);
  const clearStepError = useCallback((index?: number) => {
    setStepErrors((prev) => {
      if (typeof index === 'number') {
        const next = new Map(prev); next.delete(index); return next;
      }
      return new Map();
    });
  }, []);

  const [completedSteps, setCompletedSteps] = useState<Set<number>>(new Set());
  const [externalSubmitEligible, setExternalSubmitEligible] = useState(true);

  // Keep external submit eligibility in sync
  useEffect(() => {
    if (!evaluateSubmit) { setExternalSubmitEligible(true); return; }
    let mounted = true;
    Promise.resolve(evaluateSubmit((data ?? {}) as TData))
      .then((ok) => { if (mounted) setExternalSubmitEligible(!!ok); })
      .catch(() => { if (mounted) setExternalSubmitEligible(false); });
    return () => { mounted = false; };
  }, [evaluateSubmit, data]);

  const canSubmit = useMemo(() => {
    const filled = evaluated?.validated;
    const requiredOk = Array.isArray(filled)
      ? steps.every((s, i) => s.optional ? true : !!filled[i])
      : steps.every((s, i) => (s.optional ? true : (i === currentStep ? !stepErrors.has(i) : completedSteps.has(i))));
    return requiredOk && !loading && externalSubmitEligible;
  }, [evaluated?.validated, steps, currentStep, stepErrors, completedSteps, loading, externalSubmitEligible]);

  const validateCurrentStep = useCallback(async () => {
    const validator = currentStepConfig?.validate;
    if (typeof validator !== 'function') { clearStepError(currentStep); return true; }
    try {
      const ok = await Promise.resolve(validator());
      if (!ok) setStepError(currentStep, ''); else clearStepError(currentStep);
      return !!ok;
    } catch (e) {
      setStepError(currentStep, (e as Error)?.message || 'Validation failed');
      return false;
    }
  }, [currentStep, currentStepConfig, setStepError, clearStepError]);

  const doStepChange = useCallback(async (next: number) => {
    if (typeof onStepTransition === 'function') {
      const ok = await Promise.resolve(onStepTransition(currentStep, next, (data ?? {}) as TData));
      if (!ok) return;
    }
    await currentStepConfig?.onLeave?.();
    if (typeof onStepChange === 'function') onStepChange(next); else setInternalActiveStep(next);
    const nextCfg = steps[next];
    await nextCfg?.onEnter?.();
  }, [currentStep, currentStepConfig, onStepChange, onStepTransition, steps]);

  const handleStepChange = useCallback(async (next: number) => { await doStepChange(next); }, [doStepChange]);

  const handleNext = useCallback(async () => {
    if (loading || isLastStep) return;
    const ok = await validateCurrentStep();
    if (!ok) return;
    setCompletedSteps((prev) => new Set(prev).add(currentStep));
    await doStepChange(currentStep + 1);
  }, [loading, isLastStep, validateCurrentStep, currentStep, doStepChange]);

  const handleBack = useCallback(async () => {
    if (isFirstStep || loading) return;
    await doStepChange(currentStep - 1);
  }, [isFirstStep, loading, currentStep, doStepChange]);

  const handleStepClick = useCallback(async (index: number) => {
    if (!nonLinear || index === currentStep) return;
    let canNav: boolean;
    if (Array.isArray(evaluated?.enabled) && typeof evaluated!.enabled![index] === 'boolean') {
      canNav = !!evaluated!.enabled![index];
    } else {
      canNav = completedSteps.has(index) || index === currentStep + 1;
    }
    if (index > currentStep) {
      const ok = await validateCurrentStep();
      if (!ok) return;
      setCompletedSteps((prev) => new Set(prev).add(currentStep));
    }
    if (canNav) await doStepChange(index);
  }, [nonLinear, evaluated?.enabled, completedSteps, currentStep, validateCurrentStep, doStepChange]);

  const isSubmittingRef = useRef(false);
  const handleSubmit = useCallback(async () => {
    if (isSubmittingRef.current) return;
    const ok = await validateCurrentStep();
    if (!ok) return;
    // ensure required steps complete
    const allRequired = steps.every((s, i) => s.optional ? true : (i === currentStep ? true : completedSteps.has(i)));
    if (!allRequired || !canSubmit) return;
    try {
      isSubmittingRef.current = true;
      await Promise.resolve(onSubmit());
    } finally {
      isSubmittingRef.current = false;
    }
  }, [validateCurrentStep, steps, currentStep, completedSteps, canSubmit, onSubmit]);

  return {
    currentStep,
    currentStepConfig,
    isFirstStep,
    isLastStep,
    stepErrors,
    setStepError,
    clearStepError,
    completedSteps,
    handleStepChange,
    handleNext,
    handleBack,
    handleStepClick,
    handleSubmit,
    canSubmit,
    validateCurrentStep,
  };
}
