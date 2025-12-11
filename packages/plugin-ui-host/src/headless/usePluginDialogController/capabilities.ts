import { useEffect, useMemo, useRef, useState } from 'react';
import {
  evaluateStepGuards,
  evaluateValidationState,
  emptyGuards,
  isShallowEqualStepData,
} from '../controller/step-guards.js';
import type { PluginStepConfig, composeStepConfigs } from '@hierarchidb/plugin-base';
import type { DialogStep } from '@hierarchidb/ui-dialog';

interface Params<T extends Record<string, unknown> = Record<string, unknown>> {
  steps: DialogStep[];
  composedConfigs: ReturnType<typeof composeStepConfigs>;
  activeStepIndex: number;
  dialogData: Partial<T>;
}

export function useStepCapabilities<T extends Record<string, unknown> = Record<string, unknown>>({
  steps,
  composedConfigs,
  activeStepIndex,
  dialogData,
}: Params<T>) {
  const prevFilledRef = useState<boolean[]>([])[0];
  const prevGuardsRef = useState<Awaited<ReturnType<typeof evaluateStepGuards>>>(emptyGuards)[0];
  const prevDialogDataRef = useRef<Partial<T> | null>(null);
  const prevStepSigRef = useRef<string>('');
  const prevActiveStepRef = useRef<number>(-1);
  const [evaluatedState, setEvaluatedState] = useState<{
    filled: boolean[];
    guards: Awaited<ReturnType<typeof evaluateStepGuards>>;
  }>({
    filled: [],
    guards: emptyGuards,
  });

  const arraysEqual = (a?: boolean[], b?: boolean[]) => {
    if (a === b) return true;
    if (!a || !b) return false;
    if (a.length !== b.length) return false;
    for (let i = 0; i < a.length; i += 1) {
      if (a[i] !== b[i]) return false;
    }
    return true;
  };

  useEffect(() => {
    const stepSig = steps.map((s) => `${s.id}:${s.optional ? '1' : '0'}`).join('|');
    const dialogSame = isShallowEqualStepData(prevDialogDataRef.current as any, dialogData as any);
    if (
      dialogSame &&
      prevStepSigRef.current === stepSig &&
      prevActiveStepRef.current === activeStepIndex
    ) {
      return;
    }
    prevDialogDataRef.current = dialogData;
    prevStepSigRef.current = stepSig;
    prevActiveStepRef.current = activeStepIndex;

    let cancelled = false;
    const evaluate = async () => {
      try {
        const filled = await evaluateValidationState(steps);
        const guards = await evaluateStepGuards({
          steps,
          configs: composedConfigs.configs,
          filled,
          activeStepIndex,
          dialogData,
          hostCanSubmit: composedConfigs.hostCanSubmit,
        });
        if (!cancelled) {
          const sameFilled = arraysEqual(prevFilledRef, filled);
          const sameGuards =
            prevGuardsRef.canSave === guards.canSave &&
            prevGuardsRef.canProceedNext === guards.canProceedNext &&
            prevGuardsRef.canGoBack === guards.canGoBack &&
            prevGuardsRef.canStartBatch === guards.canStartBatch &&
            arraysEqual(
              prevGuardsRef.enabledSteps,
              guards.enabledSteps
            );
          if (sameFilled && sameGuards) return;
          prevFilledRef.length = filled.length;
          filled.forEach((v, i) => {
            prevFilledRef[i] = v;
          });
          prevGuardsRef.enabledSteps = guards.enabledSteps;
          prevGuardsRef.canSave = guards.canSave;
          prevGuardsRef.canProceedNext = guards.canProceedNext;
          prevGuardsRef.canGoBack = guards.canGoBack;
          prevGuardsRef.canStartBatch = guards.canStartBatch;
          setEvaluatedState({ filled, guards });
        }
      } catch (error) {
        console.warn('[PluginDialogShell] capability evaluation failed', error);
        if (!cancelled) {
          setEvaluatedState({ filled: [], guards: emptyGuards });
        }
      }
    };
    evaluate();
    return () => {
      cancelled = true;
    };
  }, [
    steps,
    composedConfigs.configs,
    composedConfigs.hostCanSubmit,
    activeStepIndex,
    dialogData,
  ]);

  const prevEnabledRef = useRef<number[] | null>(null);
  const enabledStepIndices = useMemo(() => {
    const flags = evaluatedState.guards.enabledSteps || [];
    const next = flags.reduce<number[]>((acc, value, idx) => {
      if (value) acc.push(idx);
      return acc;
    }, []);
    const prev = prevEnabledRef.current;
    if (prev && prev.length === next.length && prev.every((v, i) => v === next[i])) {
      return prev;
    }
    prevEnabledRef.current = next;
    return next;
  }, [evaluatedState.guards.enabledSteps]);

  const prevValidatedRef = useRef<number[] | null>(null);
  const validatedStepIndices = useMemo(() => {
    const filled = evaluatedState.filled || [];
    const next = filled.reduce<number[]>((acc, value, idx) => {
      if (value) acc.push(idx);
      return acc;
    }, []);
    const prev = prevValidatedRef.current;
    if (prev && prev.length === next.length && prev.every((v, i) => v === next[i])) {
      return prev;
    }
    prevValidatedRef.current = next;
    return next;
  }, [evaluatedState.filled]);

  const committableStepIndices = useMemo(
    () => (steps.length ? [steps.length - 1] : []),
    [steps.length]
  );

  const activeStepConfig = useMemo<PluginStepConfig | undefined>(
    () => composedConfigs.configs.find((cfg) => cfg.id === steps[activeStepIndex]?.id),
    [activeStepIndex, composedConfigs.configs, steps]
  );

  return {
    evaluatedState,
    enabledStepIndices,
    validatedStepIndices,
    committableStepIndices,
    activeStepConfig,
  };
}
