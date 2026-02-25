import type { composeStepConfigs, PluginStepConfig } from '@hierarchidb/plugin-base';
import type { DialogStep } from '@hierarchidb/ui-dialog';
import { useEffect, useMemo, useRef, useState } from 'react';
import {
  emptyGuards,
  evaluateStepGuards,
  evaluateValidationState,
} from '../controller/step-guards';

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
            prevGuardsRef.canStartBuild === guards.canStartBuild &&
            arraysEqual(prevGuardsRef.enabledSteps, guards.enabledSteps);
          if (sameFilled && sameGuards) return;
          prevFilledRef.length = filled.length;
          filled.forEach((v, i) => {
            prevFilledRef[i] = v;
          });
          prevGuardsRef.enabledSteps = guards.enabledSteps;
          prevGuardsRef.canSave = guards.canSave;
          prevGuardsRef.canProceedNext = guards.canProceedNext;
          prevGuardsRef.canGoBack = guards.canGoBack;
          prevGuardsRef.canStartBuild = guards.canStartBuild;
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
  }, [steps, composedConfigs.configs, composedConfigs.hostCanSubmit, activeStepIndex, dialogData]);

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
    () =>
      composedConfigs.configs.find(
        (cfg: PluginStepConfig | DialogStep) => cfg.id === steps[activeStepIndex]?.id
      ),
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
