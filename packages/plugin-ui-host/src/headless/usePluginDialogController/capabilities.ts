import { useEffect, useMemo, useState } from 'react';
import { evaluateStepGuards, evaluateValidationState, emptyGuards } from '../controller/step-guards.js';
import type { PluginStepConfig, composeStepConfigs } from '@hierarchidb/plugin-base';
import type { DialogStep } from '@hierarchidb/ui-dialog';

interface Params<T extends object = object> {
  steps: DialogStep[];
  composedConfigs: ReturnType<typeof composeStepConfigs>;
  activeStepIndex: number;
  dialogData: Partial<T>;
}

export function useStepCapabilities<T extends object = object>({
  steps,
  composedConfigs,
  activeStepIndex,
  dialogData,
}: Params<T>) {
  const [evaluatedState, setEvaluatedState] = useState<{
    filled: boolean[];
    guards: Awaited<ReturnType<typeof evaluateStepGuards>>;
  }>({
    filled: [],
    guards: emptyGuards,
  });

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

  const enabledStepIndices = useMemo(() => {
    const flags = evaluatedState.guards.enabledSteps || [];
    return flags.reduce<number[]>((acc, value, idx) => {
      if (value) acc.push(idx);
      return acc;
    }, []);
  }, [evaluatedState.guards.enabledSteps]);

  const validatedStepIndices = useMemo(() => {
    const filled = evaluatedState.filled || [];
    return filled.reduce<number[]>((acc, value, idx) => {
      if (value) acc.push(idx);
      return acc;
    }, []);
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
