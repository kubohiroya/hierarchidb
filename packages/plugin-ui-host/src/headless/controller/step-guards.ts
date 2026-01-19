import type { PluginStepConfig, StepData } from '@hierarchidb/plugin-base';
import type { DialogStep } from '@hierarchidb/ui-dialog';
import type { BasicInfoMeta } from '../usePluginDialogController/data-types.js';
import type { StepGuardState } from './types.js';

export const emptyGuards: StepGuardState = {
  enabledSteps: [],
  canSave: false,
  canProceedNext: false,
  canGoBack: false,
  canStartBatch: false,
};

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null;

const isPlainObject = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

const shallowEqualStepData = (a?: StepData, b?: StepData): boolean => {
  if (a === b) return true;
  if (!isRecord(a) || !isRecord(b)) return false;

  const stack: Array<{ left: unknown; right: unknown }> = [{ left: a, right: b }];

  while (stack.length > 0) {
    const { left, right } = stack.pop()!;
    if (left === right) continue;

    const leftIsArray = Array.isArray(left);
    const rightIsArray = Array.isArray(right);
    if (leftIsArray || rightIsArray) {
      if (!leftIsArray || !rightIsArray) return false;
      const arrA = left as unknown[];
      const arrB = right as unknown[];
      if (arrA.length !== arrB.length) return false;
      for (let i = 0; i < arrA.length; i += 1) {
        stack.push({ left: arrA[i], right: arrB[i] });
      }
      continue;
    }

    const leftIsObj = isPlainObject(left);
    const rightIsObj = isPlainObject(right);
    if (leftIsObj || rightIsObj) {
      if (!leftIsObj || !rightIsObj) return false;
      const aKeys = Object.keys(left);
      const bKeys = Object.keys(right);
      if (aKeys.length !== bKeys.length) return false;
      for (const key of aKeys) {
        if (!Object.hasOwn(right, key)) return false;
        stack.push({
          left: (left as Record<string, unknown>)[key],
          right: (right as Record<string, unknown>)[key],
        });
      }
      continue;
    }

    // Primitive and function/Date/etc. default comparison
    if (left !== right) return false;
  }

  return true;
};

const toRecord = (
  value: StepData | Record<string, unknown> | null | undefined | object
): StepData | undefined => (isRecord(value) ? (value as StepData) : undefined);

export const BASIC_INFO_META_KEY = '__basicInfoValidation';

export const buildStepWorkingData = (
  draftData: StepData | undefined,
  basicInfo?: import('@hierarchidb/common-types').TreeNodeMetadata | null,
  _basicInfoMeta?: BasicInfoMeta
): StepData => {
  const baseSource = toRecord(basicInfo) ?? {};
  const base = basicInfo ? extractBasicInfoFields(baseSource as Record<string, unknown>) : {};
  return draftData ? { ...base, ...draftData } : base;
};

export async function evaluateValidationState(steps: DialogStep[]): Promise<boolean[]> {
  if (!steps.length) return [];
  const results = await Promise.all(
    steps.map(async (step) => {
      if (typeof step?.validate === 'function') {
        try {
          const outcome = await Promise.resolve(step.validate());
          return Boolean(outcome);
        } catch {
          return false;
        }
      }
      return true;
    })
  );
  return results;
}

function createStepConfigMap(
  configs: ReadonlyArray<PluginStepConfig>
): Map<string, PluginStepConfig> {
  return new Map(configs.map((cfg) => [cfg.id, cfg]));
}

function sequentiallyReachable(index: number, steps: DialogStep[], filled: boolean[]): boolean {
  if (index <= 0) return true;
  for (let i = 0; i < index; i++) {
    const step = steps[i];
    if (!step?.optional && !filled[i]) {
      return false;
    }
  }
  return true;
}

export async function evaluateStepGuards({
  steps,
  configs,
  filled,
  activeStepIndex,
  dialogData,
  hostCanSubmit,
}: {
  steps: DialogStep[];
  configs: ReadonlyArray<PluginStepConfig>;
  filled: boolean[];
  activeStepIndex: number;
  dialogData: StepData;
  hostCanSubmit?: (data: StepData) => boolean | Promise<boolean>;
}): Promise<StepGuardState> {
  if (!steps.length) {
    return emptyGuards;
  }

  const configMap = createStepConfigMap(configs);
  const enabledSteps: boolean[] = new Array(steps.length).fill(false);

  const activeStep = steps[activeStepIndex];
  const activeConfig = activeStep ? configMap.get(activeStep.id) : undefined;

  const callBoolean = async <T extends boolean>(
    fn: ((payload: StepData) => T | Promise<T>) | undefined,
    fallback: boolean
  ): Promise<boolean> => {
    if (!fn) return fallback;
    try {
      const result = await Promise.resolve(fn(dialogData));
      return Boolean(result);
    } catch {
      return false;
    }
  };

  const checkNavigate = async (targetIndex: number): Promise<boolean> => {
    if (targetIndex === activeStepIndex) return true;
    if (targetIndex < 0 || targetIndex >= steps.length) return false;
    const targetStep = steps[targetIndex];
    const targetConfig = targetStep ? configMap.get(targetStep.id) : undefined;
    if (targetConfig?.capabilities?.canNavigateTo) {
      try {
        const res = await Promise.resolve(
          targetConfig.capabilities.canNavigateTo(activeStepIndex, dialogData)
        );
        return Boolean(res);
      } catch {
        return false;
      }
    }
    return sequentiallyReachable(targetIndex, steps, filled);
  };

  const allRequiredFilled = steps.every((step, idx) => step?.optional || filled[idx]);

  const canSave = await (async () => {
    if (activeConfig?.capabilities?.canSave) {
      return callBoolean(activeConfig.capabilities.canSave, false);
    }
    if (hostCanSubmit) {
      try {
        const hostResult = await Promise.resolve(hostCanSubmit(dialogData));
        return Boolean(hostResult);
      } catch {
        return false;
      }
    }
    return allRequiredFilled;
  })();

  const nextIndex = activeStepIndex + 1;
  const defaultCanProceed = Boolean(filled?.[activeStepIndex] ?? false);
  const canProceedNext = await callBoolean(
    activeConfig?.capabilities?.canProceedToNext,
    defaultCanProceed
  );

  const prevIndex = activeStepIndex - 1;
  const defaultCanBack = prevIndex >= 0 ? await checkNavigate(prevIndex) : false;
  const canGoBack = await callBoolean(
    activeConfig?.capabilities?.canBackToPrevious,
    defaultCanBack
  );

  const canStartBatch = await callBoolean(activeConfig?.capabilities?.canStartBatch, false);

  for (let idx = 0; idx < enabledSteps.length; idx++) {
    let allowed = await checkNavigate(idx);
    if (idx === prevIndex) {
      allowed = allowed && canGoBack;
    }
    if (idx === nextIndex) {
      allowed = allowed && canProceedNext;
    }
    enabledSteps[idx] = allowed;
  }

  enabledSteps[activeStepIndex] = true;

  return {
    enabledSteps,
    canSave,
    canProceedNext,
    canGoBack,
    canStartBatch,
  };
}

export const mergeDialogData = (
  _basic: import('@hierarchidb/common-types').TreeNodeMetadata,
  workingData: StepData | null | undefined
): StepData => {
  return workingData ? { ...workingData } : {};
};

export const isShallowEqualStepData = shallowEqualStepData;

export const extractBasicInfoFields = (
  data?: Record<string, unknown>
): {
  name: string;
  description: string;
  tags: string[];
} => {
  const nameSource = typeof data?.name === 'string' ? data.name : '';
  const descriptionSource = typeof data?.description === 'string' ? data.description : '';
  return {
    name: nameSource,
    description: descriptionSource,
    tags: Array.isArray(data?.tags)
      ? data.tags.filter((t): t is string => typeof t === 'string')
      : [],
  };
};

export { toRecord };
