/**
 * usePluginDialogController – core state machine for plugin console.
 *
 * Coordinates worker access, step composition, navigation rules, and
 * capability evaluation so the headless dialog shell can render plugin-loader with
 * consistent Next/Save guards derived from plugin-provided services.
 */

import type { DialogStateAPI, DialogStateSubscriptionId, WorkerAPI } from '@hierarchidb/common-api';
import type {
  DialogStateSubscribeInput,
  MultiStepDialogState,
  NodeId,
  TagEntity,
  TreeId,
} from '@hierarchidb/common-types';
import {
  composeStepConfigs,
  getPeerDialogPosition,
  getPeerDialogSize,
  getPeerDisplayMode,
  HostProfileRegistry,
  type PeerDisplayMode,
  type PluginStepConfig,
  PluginStepRegistry,
  setPeerDialogPosition,
  setPeerDialogSize,
  setPeerDisplayMode,
  useDialogUrlSync,
} from '@hierarchidb/plugin-base';
import {
  getIconComponent,
  getPresentation,
  hydratePresentationDefinitionsFromGlobal,
} from '@hierarchidb/plugin-presentation';
import { useDialogWorkingCopy, type WorkingCopyData } from '@hierarchidb/plugin-ui-sdk';
import { getWorkerClientHook, type WorkerClientRef } from '@hierarchidb/runtime-client';
import type {
  DialogDisplayMode,
  DialogStep,
  MultiDialogPosition,
  MultiDialogSize,
} from '@hierarchidb/ui-dialog';
import {
  FRAME_CONSTANTS,
  getPresetSize,
  getViewportSize,
  type HeadlessContentRenderProps,
  type HeadlessMultiStepDialogProps,
  initialPosition,
  normalizeDialogState,
  positionsEqual,
  type StepComponentDescriptor,
  type StepComponentProps,
  type StepNavigationEvent,
  sizesEqual,
} from '@hierarchidb/ui-dialog';
import { Box } from '@mui/material';
import { useNavigate } from '@tanstack/react-router';
import { proxy, type Remote, releaseProxy } from 'comlink';
import type React from 'react';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { resolveDefaultNodeName } from '@hierarchidb/runtime-worker';
import { BasicInfoStep } from '../components/steps/BasicInfoStep.js';
import { PluginDialogFooter, PluginDialogHeader } from './components/index.js';
import type { PluginDialogFooterPrimaryButtonOptions } from './components/PluginDialogFooter.js';

export interface PluginDialogControllerOptions {
  mode: 'create' | 'edit';
  nodeType: string;
  nodeId: NodeId;
  pageNodeId: NodeId;
  treeId: TreeId;
  open: boolean;
  initialStep?: number;
  onClose: () => void;
  onSuccess?: (nodeId: NodeId) => void;
  footerOptions?: PluginDialogFooterOptions;
}

export interface PluginDialogFooterOptions {
  primaryButtons?: PluginDialogFooterPrimaryButtonOptions;
  saveDraftLabel?: string;
}

type StepData = Record<string, unknown>;

export interface PluginDialogControllerState {
  headlessProps: HeadlessMultiStepDialogProps<StepData>;
  stepDescriptors: ReadonlyArray<StepComponentDescriptor<StepData>>;
  loading: boolean;
  error: unknown;
  icon?: React.ReactNode;
  presentation?: {
    label: string;
    description?: string;
  };
  hasUnsavedChanges: boolean;
  dialogState?: MultiStepDialogState | null;
}

const DEFAULT_SIZE: MultiDialogSize = { width: 960, height: 640 };
const DEFAULT_VIEWPORT = { width: 1280, height: 720 } as const;
const DEFAULT_POSITION: MultiDialogPosition = initialPosition(DEFAULT_SIZE, DEFAULT_VIEWPORT);

const clampIndex = (index: number, length: number) => {
  if (length <= 0) return 0;
  return Math.min(Math.max(index, 0), length - 1);
};

const toRecord = (value: unknown): Record<string, unknown> | undefined =>
  typeof value === 'object' && value !== null ? (value as Record<string, unknown>) : undefined;

const toStringArray = (value: unknown): string[] =>
  Array.isArray(value) ? value.filter((item): item is string => typeof item === 'string') : [];

type BasicInfoState = { name: string; description: string; tags: string[] };

type StepGuardState = {
  enabledSteps: boolean[];
  canSave: boolean;
  canProceedNext: boolean;
  canGoBack: boolean;
  canStartBatch: boolean;
};

const emptyGuards: StepGuardState = {
  enabledSteps: [],
  canSave: false,
  canProceedNext: false,
  canGoBack: false,
  canStartBatch: false,
};

type StepAdapterProps = {
  cfg: PluginStepConfig;
  mode: 'create' | 'edit';
  nodeId: string;
  parentId: string;
  workingData: Record<string, unknown> | undefined;
  updateWorkingCopy: (patch: Partial<WorkingCopyData>) => void;
};

const StepAdapterComponent: React.FC<StepAdapterProps> = ({
  cfg,
  mode,
  nodeId,
  parentId,
  workingData,
  updateWorkingCopy,
}) => {
  const [, setValid] = useState<boolean | undefined>();
  const [, setError] = useState<string | null>(null);

  useEffect(() => {
    if (typeof cfg.validate === 'function') {
      Promise.resolve(cfg.validate())
        .then((res) => setValid(Boolean(res)))
        .catch(() => setValid(false));
    }
  }, [cfg]);

  return (
    <>
      {cfg.componentFactory({
        mode,
        nodeId,
        parentId,
        data: workingData,
        onChange: (data: unknown) => updateWorkingCopy({ data: data as Record<string, unknown> }),
        setValid,
        setError,
      })}
    </>
  );
};

const PlaceholderStep: React.FC<StepComponentProps<StepData>> = () => null;

function mergeDialogData(
  basic: BasicInfoState,
  workingData: Record<string, unknown> | null | undefined
): Record<string, unknown> {
  const merged: Record<string, unknown> = workingData ? { ...workingData } : {};
  merged.name = basic.name;
  merged.description = basic.description;
  merged.tags = basic.tags;
  return merged;
}

async function evaluateValidationState(steps: DialogStep[]): Promise<boolean[]> {
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

async function evaluateStepGuards({
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
  dialogData: Record<string, unknown>;
  hostCanSubmit?: (data: unknown) => boolean | Promise<boolean>;
}): Promise<StepGuardState> {
  if (!steps.length) {
    return emptyGuards;
  }

  const configMap = createStepConfigMap(configs);
  const enabledSteps: boolean[] = new Array(steps.length).fill(false);

  const activeStep = steps[activeStepIndex];
  const activeConfig = activeStep ? configMap.get(activeStep.id) : undefined;

  const callBoolean = async <T extends boolean>(
    fn: ((...args: unknown[]) => T | Promise<T>) | undefined,
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
  const defaultCanProceed = nextIndex < steps.length ? await checkNavigate(nextIndex) : false;
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

  // Ensure the active step is always considered enabled for context consumers.
  enabledSteps[activeStepIndex] = true;

  return {
    enabledSteps,
    canSave,
    canProceedNext,
    canGoBack,
    canStartBatch,
  };
}

type DialogStateApiSubset = Partial<
  Pick<DialogStateAPI, 'subscribeState' | 'unsubscribeState' | 'getState'>
>;

type DialogStateSubscriptionLogger = Pick<Console, 'warn'> | undefined;

export interface DialogStateSubscriptionDeps {
  createCallback?: (handler: (state: MultiStepDialogState | null) => void) => unknown;
  releaseCallback?: (callback: unknown) => void;
}

export interface SubscribeDialogStateOptions {
  api: DialogStateApiSubset | null;
  params: DialogStateSubscribeInput;
  onSnapshot: (state: MultiStepDialogState | null) => void;
  logger?: DialogStateSubscriptionLogger;
  deps?: DialogStateSubscriptionDeps;
}

const defaultWarn = (...args: unknown[]) => {
  if (typeof console !== 'undefined' && typeof console.warn === 'function') {
    console.warn(...args);
  }
};

export async function subscribeDialogState({
  api,
  params,
  onSnapshot,
  logger,
  deps,
}: SubscribeDialogStateOptions): Promise<() => void> {
  const warn = logger?.warn?.bind(logger) ?? defaultWarn;

  if (!api) {
    const error = new Error('[PluginDialogShell] DialogStateAPI unavailable; cannot subscribe');
    warn(error.message);
    throw error;
  }

  const subscribeFn =
    typeof api.subscribeState === 'function' ? api.subscribeState.bind(api) : null;
  const unsubscribeFn =
    typeof api.unsubscribeState === 'function' ? api.unsubscribeState.bind(api) : null;
  const getStateFn = typeof api.getState === 'function' ? api.getState.bind(api) : null;

  const createCallback =
    deps?.createCallback ??
    ((handler: (state: MultiStepDialogState | null) => void) => proxy(handler));
  const releaseCallback =
    deps?.releaseCallback ??
    ((callback: unknown) => {
      if (!callback) return;
      try {
        const releaser = (callback as { [releaseProxy]?: () => void })[releaseProxy];
        if (typeof releaser === 'function') {
          releaser.call(callback);
        }
      } catch {
        // Ignore release errors – callback may not be a proxied function in test environments
      }
    });

  if (!subscribeFn || !unsubscribeFn) {
    if (typeof console !== 'undefined' && typeof console.error === 'function') {
      console.error('[PluginDialogShell] subscribeState/unsubscribeState missing', {
        typeofSubscribe: typeof api?.subscribeState,
        typeofUnsubscribe: typeof api?.unsubscribeState,
        keys: api ? Object.keys(api as unknown as Record<string, unknown>) : [],
      });
    }
    const error = new Error(
      '[PluginDialogShell] DialogStateAPI must implement subscribeState/unsubscribeState'
    );
    warn(error.message, params);
    throw error;
  }

  const callback = createCallback((snapshot: MultiStepDialogState | null) => {
    onSnapshot(snapshot ?? null);
  });

  let cleanedUp = false;
  let subscriptionId: DialogStateSubscriptionId | null = null;

  const cleanup = () => {
    if (cleanedUp) return;
    cleanedUp = true;
    releaseCallback(callback);
    if (subscriptionId !== null) {
      Promise.resolve(unsubscribeFn(subscriptionId)).catch(() => {});
    }
  };

  try {
    subscriptionId = await subscribeFn(
      params,
      callback as (state: MultiStepDialogState | null) => void
    );
    if (getStateFn) {
      try {
        const snapshot = await getStateFn(params);
        onSnapshot(snapshot ?? null);
      } catch (snapshotError) {
        warn('[PluginDialogShell] failed to fetch initial dialog state snapshot', snapshotError);
      }
    }

    return cleanup;
  } catch (error) {
    cleanup();
    warn('[PluginDialogShell] dialog state subscription failed', error);
    throw error;
  }
}

export function usePluginDialogController(
  options: PluginDialogControllerOptions
): PluginDialogControllerState {
  const {
    mode,
    nodeType,
    nodeId,
    treeId,
    pageNodeId,
    open,
    initialStep = 0,
    onClose,
    onSuccess,
    footerOptions,
  } = options;

  const navigate = useNavigate();
  const stepRegistry = PluginStepRegistry.getInstance();
  const hostRegistry = HostProfileRegistry.getInstance();

  const useClientHook = getWorkerClientHook<WorkerClientRef | null>() ?? (() => null);
  const ref = useClientHook();
  const client: Remote<WorkerAPI> | null = useMemo(() => ref?.client ?? null, [ref]);

  const [dialogStateApi, setDialogStateApi] = useState<DialogStateAPI | null>(null);
  const [workerDialogState, setWorkerDialogState] = useState<MultiStepDialogState | null>(null);
  const [dialogStateError, setDialogStateError] = useState<unknown>(null);

  useEffect(() => {
    let cancelled = false;
    if (!client) {
      setDialogStateApi(null);
      setWorkerDialogState(null);
      setDialogStateError(null);
      return () => {
        cancelled = true;
      };
    }

    (async () => {
      try {
        const api = await client.getDialogStateAPI();
        if (typeof console !== 'undefined' && typeof console.debug === 'function') {
          console.debug('[PluginDialogShell] dialogStateAPI snapshot', {
            apiType: typeof api,
            publishType: typeof api?.publishState,
            subscribeType: typeof api?.subscribeState,
            unsubscribeType: typeof api?.unsubscribeState,
            keys: api ? Object.keys(api as unknown as Record<string, unknown>) : [],
          });
        }
        if (cancelled) {
          return;
        }

        const hasMethod = (method: keyof DialogStateAPI) => typeof api?.[method] === 'function';
        const missingRequiredMethod =
          !hasMethod('publishState') ||
          !hasMethod('getState') ||
          !hasMethod('subscribeState') ||
          !hasMethod('unsubscribeState');

        if (missingRequiredMethod) {
          const details = {
            publishStateType: typeof api?.publishState,
            getStateType: typeof api?.getState,
            subscribeStateType: typeof api?.subscribeState,
            unsubscribeStateType: typeof api?.unsubscribeState,
            keys: Object.keys(api ?? {}),
          };
          const error = new Error('[PluginDialogShell] DialogStateAPI is missing required methods');
          if (typeof console !== 'undefined' && typeof console.error === 'function') {
            console.error(error.message, details);
          }
          setDialogStateApi(null);
          setDialogStateError(error);
          return;
        }

        const wrappedApi: DialogStateAPI = {
          publishState: async (input) => api.publishState(input),
          getState: async (input) => api.getState(input),
          subscribeState: async (input, callback) => api.subscribeState(input, callback),
          unsubscribeState: async (subscriptionId) => api.unsubscribeState(subscriptionId),
        };

        setDialogStateError(null);
        setDialogStateApi(wrappedApi);
      } catch (error) {
        if (typeof console !== 'undefined' && typeof console.error === 'function') {
          console.error('[PluginDialogShell] failed to acquire DialogStateAPI', error);
        }
        if (!cancelled) {
          setDialogStateApi(null);
          setDialogStateError(error);
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [client]);

  const {
    workingCopy,
    hasUnsavedChanges,
    updateWorkingCopy,
    saveWorkingCopy,
    saveDraft,
    discardWorkingCopy,
    loading,
    error,
  } = useDialogWorkingCopy({
    mode,
    nodeType,
    nodeId,
    parentId: pageNodeId,
    treeId,
    workerClient: ref ?? null,
  });

  useEffect(() => {
    if (!nodeType || !nodeId) {
      setWorkerDialogState(null);
      return;
    }

    if (!dialogStateApi) {
      setWorkerDialogState(null);
      return;
    }

    let disposed = false;
    let cleanup: (() => void) | null = null;

    (async () => {
      try {
        const release = await subscribeDialogState({
          api: dialogStateApi,
          params: { nodeType, nodeId } as DialogStateSubscribeInput,
          onSnapshot: (snapshot) => {
            if (!disposed) {
              setWorkerDialogState(snapshot ?? null);
            }
          },
          logger: typeof console !== 'undefined' ? console : undefined,
        });

        if (!disposed) {
          setDialogStateError(null);
        }

        if (disposed) {
          release();
        } else {
          cleanup = release;
        }
      } catch (error) {
        if (typeof console !== 'undefined' && typeof console.error === 'function') {
          console.error(
            '[PluginDialogShell] failed to establish dialog state subscription bridge',
            error
          );
        }
        if (!disposed) {
          setWorkerDialogState(null);
          setDialogStateError(error);
        }
      }
    })();

    return () => {
      disposed = true;
      setWorkerDialogState(null);
      if (cleanup) {
        cleanup();
        cleanup = null;
      }
    };
  }, [dialogStateApi, nodeType, nodeId]);

  const {
    step: urlStep,
    setStep: setUrlStep,
    mode: urlMode,
    setMode: setUrlMode,
  } = useDialogUrlSync({
    defaults: { step: initialStep, mode: 'normal' },
    debounce: { map: 0 },
    history: { step: 'replace' },
  });

  const [activeStepIndex, setActiveStepIndex] = useState(initialStep);
  useEffect(() => {
    if (typeof urlStep === 'number') {
      setActiveStepIndex(clampIndex(urlStep, Number.POSITIVE_INFINITY));
    }
  }, [urlStep]);

  const [displayMode, setDisplayModeState] = useState<DialogDisplayMode>('normal');
  const [dialogSize, setDialogSize] = useState<MultiDialogSize>(DEFAULT_SIZE);
  const [dialogPosition, setDialogPosition] = useState<MultiDialogPosition>(DEFAULT_POSITION);

  const dialogSizeRef = useRef(dialogSize);
  const dialogPositionRef = useRef(dialogPosition);
  const positionPersistTimeoutRef = useRef<number | null>(null);

  useEffect(() => {
    dialogSizeRef.current = dialogSize;
  }, [dialogSize]);

  useEffect(() => {
    dialogPositionRef.current = dialogPosition;
  }, [dialogPosition]);

  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        const [dm, pos, sz] = await Promise.all([
          getPeerDisplayMode(nodeType, String(nodeId)),
          getPeerDialogPosition(nodeType, String(nodeId)),
          getPeerDialogSize(nodeType, String(nodeId)),
        ]);
        if (!mounted) return;
        if (dm) {
          setDisplayModeState(dm as DialogDisplayMode);
          setUrlMode(dm === 'full-screen' ? 'full' : 'normal');
        }
        if (pos) {
          setDialogPosition(pos);
          dialogPositionRef.current = pos;
        }
        if (sz) {
          setDialogSize(sz);
          dialogSizeRef.current = sz;
        }
      } catch (err) {
        console.warn('[PluginDialogShell] restore frame state failed', err);
      }
    })();
    return () => {
      mounted = false;
    };
  }, [nodeType, nodeId, setUrlMode]);

  const persistDisplayMode = useCallback(
    (value: DialogDisplayMode) => {
      setDisplayModeState(value);
      setPeerDisplayMode(nodeType, String(nodeId), value as PeerDisplayMode).catch(() => void 0);
      setUrlMode(value === 'full-screen' ? 'full' : 'normal');
    },
    [nodeType, nodeId, setUrlMode]
  );

  useEffect(
    () => () => {
      if (positionPersistTimeoutRef.current !== null && typeof window !== 'undefined') {
        window.clearTimeout(positionPersistTimeoutRef.current);
        positionPersistTimeoutRef.current = null;
      }
    },
    []
  );

  const persistPosition = useCallback(
    (next: MultiDialogPosition) => {
      setDialogPosition(next);
      dialogPositionRef.current = next;

      if (typeof window !== 'undefined') {
        if (positionPersistTimeoutRef.current !== null) {
          window.clearTimeout(positionPersistTimeoutRef.current);
        }
        positionPersistTimeoutRef.current = window.setTimeout(() => {
          positionPersistTimeoutRef.current = null;
          setPeerDialogPosition(nodeType, String(nodeId), next).catch(() => void 0);
        }, 16); // ~1 frame debounce
      } else {
        setPeerDialogPosition(nodeType, String(nodeId), next).catch(() => void 0);
      }
    },
    [nodeType, nodeId]
  );

  const persistSize = useCallback(
    (next: MultiDialogSize) => {
      setDialogSize(next);
      dialogSizeRef.current = next;
      setPeerDialogSize(nodeType, String(nodeId), next).catch(() => void 0);
    },
    [nodeType, nodeId]
  );

  const transitionDisplayMode = useCallback(
    async (mode: DialogDisplayMode) => {
      const viewport = getViewportSize();

      const applyNormalizedState = (size: MultiDialogSize, position: MultiDialogPosition) => {
        dialogSizeRef.current = size;
        dialogPositionRef.current = position;
        persistSize(size);
        persistPosition(position);
      };

      if (mode === 'full-screen') {
        const fullSize: MultiDialogSize = {
          width: Math.max(viewport.width, FRAME_CONSTANTS.MIN_DIALOG_WIDTH),
          height: Math.max(viewport.height, FRAME_CONSTANTS.MIN_DIALOG_HEIGHT),
        };
        applyNormalizedState(fullSize, { x: 0, y: 0 });
      } else if (mode === 'maximize') {
        const size = getPresetSize('maximize', viewport);
        const position: MultiDialogPosition = {
          x: FRAME_CONSTANTS.NON_STANDARD_MARGIN,
          y: FRAME_CONSTANTS.NON_STANDARD_MARGIN,
        };
        const normalized = normalizeDialogState(size, position, viewport, {
          enforceTopLeftMargin: false,
          minPosition: FRAME_CONSTANTS.NON_STANDARD_MARGIN,
          clampSizeToViewport: true,
        });
        applyNormalizedState(normalized.size, normalized.position);
      } else {
        const size = getPresetSize('normal', viewport);
        const position = initialPosition(size, viewport);
        const normalized = normalizeDialogState(size, position, viewport, {
          enforceTopLeftMargin: true,
        });
        applyNormalizedState(normalized.size, normalized.position);
      }

      setDisplayModeState(mode);
      persistDisplayMode(mode);
    },
    [persistDisplayMode, persistPosition, persistSize]
  );

  useEffect(() => {
    const modeKey = urlMode as string;
    if (modeKey === 'full') {
      void transitionDisplayMode('full-screen');
    } else if (displayMode === 'full-screen' && modeKey !== 'full') {
      void transitionDisplayMode('normal');
    }
  }, [urlMode, displayMode, transitionDisplayMode]);

  useEffect(() => {
    if (typeof window === 'undefined') return;

    let rafId: number | null = null;

    const normalize = () => {
      rafId = null;
      const viewport = getViewportSize();
      let targetSize = dialogSizeRef.current;
      let targetPosition = dialogPositionRef.current;
      let options = {
        enforceTopLeftMargin: displayMode === 'normal',
        minPosition: displayMode === 'normal' ? 0 : FRAME_CONSTANTS.NON_STANDARD_MARGIN,
        clampSizeToViewport: true,
      };

      if (displayMode === 'full-screen') {
        targetSize = {
          width: Math.max(viewport.width, FRAME_CONSTANTS.MIN_DIALOG_WIDTH),
          height: Math.max(viewport.height, FRAME_CONSTANTS.MIN_DIALOG_HEIGHT),
        };
        targetPosition = { x: 0, y: 0 };
        options = {
          enforceTopLeftMargin: false,
          minPosition: 0,
          clampSizeToViewport: false,
        };
      } else if (displayMode === 'maximize') {
        targetSize = getPresetSize('maximize', viewport);
        targetPosition = {
          x: FRAME_CONSTANTS.NON_STANDARD_MARGIN,
          y: FRAME_CONSTANTS.NON_STANDARD_MARGIN,
        };
        options = {
          enforceTopLeftMargin: false,
          minPosition: FRAME_CONSTANTS.NON_STANDARD_MARGIN,
          clampSizeToViewport: true,
        };
      }

      const normalized = normalizeDialogState(targetSize, targetPosition, viewport, options);
      if (!sizesEqual(dialogSizeRef.current, normalized.size)) {
        dialogSizeRef.current = normalized.size;
        persistSize(normalized.size);
      }
      if (!positionsEqual(dialogPositionRef.current, normalized.position)) {
        dialogPositionRef.current = normalized.position;
        persistPosition(normalized.position);
      }
    };

    const schedule = () => {
      if (rafId !== null) return;
      rafId = window.requestAnimationFrame(normalize);
    };

    window.addEventListener('resize', schedule, { passive: true });
    schedule();

    return () => {
      window.removeEventListener('resize', schedule);
      if (rafId !== null) {
        window.cancelAnimationFrame(rafId);
        rafId = null;
      }
    };
  }, [displayMode, persistPosition, persistSize]);

  const [basicInfo, setBasicInfo] = useState({ name: '', description: '', tags: [] as string[] });
  useEffect(() => {
    if (mode === 'create') {
      const fallbackName = resolveDefaultNodeName(nodeType);
      setBasicInfo((prev) => ({
        name: prev.name || fallbackName,
        description: prev.description,
        tags: prev.tags,
      }));
    }
  }, [mode, nodeType]);

  useEffect(() => {
    if (workingCopy) {
      const tagsValue = workingCopy.data?.tags;
      const tags = toStringArray(tagsValue);
      setBasicInfo({
        name: workingCopy.name ?? '',
        description: workingCopy.description ?? '',
        tags,
      });
    }
  }, [workingCopy]);

  const [tagSuggestions, setTagSuggestions] = useState<string[]>(() => []);

  useEffect(() => {
    let disposed = false;
    (async () => {
      try {
        if (!client) return;
        const tagAPI = await client.getTagAPI();
        const all = await tagAPI.getAllTags();
        if (!disposed)
          setTagSuggestions(
            all
              .map((t: TagEntity) => t.name)
              .filter((name: string): name is string => typeof name === 'string')
          );
        if (mode === 'edit' && nodeId) {
          const nodeTags = await tagAPI.getTagsForNode(nodeId);
          const names = (nodeTags || [])
            .map((t: TagEntity) => t.name)
            .filter((name: string): name is string => typeof name === 'string');
          if (!disposed && names.length)
            setBasicInfo((prev) => ({ ...prev, tags: prev.tags.length ? prev.tags : names }));
        }
      } catch (err) {
        console.warn('[PluginDialogShell] load tag suggestions failed', err);
      }
    })();
    return () => {
      disposed = true;
    };
  }, [client, nodeId, mode]);

  useEffect(() => {
    let disposed = false;
    (async () => {
      try {
        if (!client || !nodeId) return;
        const query = await client.getQueryAPI();
        const node = await query.getNode(nodeId);
        if (!node || disposed) return;
        const nodeData = toRecord((node as unknown as { data?: unknown }).data);
        const nodeTags = toStringArray(nodeData?.tags);
        setBasicInfo((prev) => ({
          name: prev.name || node.name || '',
          description: prev.description || node.description || '',
          tags: prev.tags.length ? prev.tags : nodeTags,
        }));
      } catch (err) {
        console.warn('[PluginDialogShell] prefill from QueryAPI failed', err);
      }
    })();
    return () => {
      disposed = true;
    };
  }, [client, nodeId]);

  const [regTick, setRegTick] = useState(0);
  const [hostTick, setHostTick] = useState(0);
  useEffect(() => {
    const unsubA = stepRegistry.subscribe?.(() => setRegTick((v) => v + 1));
    const unsubB = hostRegistry?.subscribe?.(() => setHostTick((v) => v + 1));
    return () => {
      unsubA?.();
      unsubB?.();
    };
  }, [stepRegistry, hostRegistry]);

  const composedConfigs = useMemo(() => {
    void regTick;
    void hostTick;
    return composeStepConfigs(nodeType, mode);
  }, [nodeType, mode, regTick, hostTick]);

  useEffect(() => {
    if (!composedConfigs.hasHostBase) return;
    if (!workingCopy?.data) return;
    const dataRecord = toRecord(workingCopy.data);
    if (!dataRecord) return;

    const nameFromData = typeof dataRecord.name === 'string' ? dataRecord.name : undefined;
    const descriptionFromData =
      typeof dataRecord.description === 'string' ? dataRecord.description : undefined;
    const tagsFromData = dataRecord.tags;

    setBasicInfo((prev) => {
      const nextName = nameFromData ?? prev.name;
      const nextDescription = descriptionFromData ?? prev.description;
      const nextTags = tagsFromData !== undefined ? toStringArray(tagsFromData) : prev.tags;
      const tagsEqual =
        prev.tags.length === nextTags.length && prev.tags.every((tag, idx) => tag === nextTags[idx]);
      if (prev.name === nextName && prev.description === nextDescription && tagsEqual) {
        return prev;
      }
      return {
        name: nextName,
        description: nextDescription,
        tags: nextTags,
      };
    });
  }, [composedConfigs.hasHostBase, workingCopy?.data]);

  const pluginConfigSteps = useMemo(() => {
    void regTick;
    if (mode === 'create') return stepRegistry.getCreateSteps(nodeType);
    if (mode === 'edit')
      return stepRegistry.getEditSteps(nodeType, String(nodeId), workingCopy?.data);
    return [];
  }, [mode, nodeType, nodeId, workingCopy?.data, stepRegistry, regTick]);

  const renderStep = useCallback(
    (cfg: PluginStepConfig) => (
      <StepAdapterComponent
        cfg={cfg}
        mode={mode}
        nodeId={String(nodeId)}
        parentId={String(pageNodeId)}
        workingData={workingCopy?.data}
        updateWorkingCopy={updateWorkingCopy}
      />
    ),
    [mode, nodeId, pageNodeId, updateWorkingCopy, workingCopy?.data]
  );

  const steps: DialogStep[] = useMemo(() => {
    const result: DialogStep[] = [];

    if (!composedConfigs.hasHostBase) {
      result.push({
        id: 'basic-info',
        label: 'Basic Information',
        component: (
          <BasicInfoStep
            name={basicInfo.name}
            description={basicInfo.description}
            tags={basicInfo.tags}
            tagSuggestions={tagSuggestions}
            onChange={(data) =>
              setBasicInfo({
                name: data.name,
                description: data.description ?? '',
                tags: data.tags ?? [],
              })
            }
            mode={mode}
          />
        ),
        validate: () => basicInfo.name.trim().length > 0,
      });
    }

    if (composedConfigs.configs.length) {
      composedConfigs.configs.forEach((cfg) => {
        const validateFn = cfg.validate;
        result.push({
          id: cfg.id,
          label: cfg.label ?? cfg.id,
          optional: !!cfg.optional,
          validate: validateFn ? () => validateFn(workingCopy?.data) : undefined,
          component: renderStep(cfg),
        });
      });
      return result;
    }

    return result.concat(pluginConfigSteps);
  }, [
    composedConfigs,
    basicInfo,
    tagSuggestions,
    mode,
    renderStep,
    pluginConfigSteps,
    workingCopy?.data,
  ]);

  useEffect(() => {
    hydratePresentationDefinitionsFromGlobal();
  }, []);

  const presentation = useMemo(() => getPresentation(nodeType), [nodeType]);
  const icon = useMemo(() => getIconComponent(nodeType), [nodeType]);

  const dialogTitle = useMemo(() => {
    const label = presentation?.label || nodeType;
    const modeLabel = mode === 'create' ? 'Create' : 'Edit';
    return `${modeLabel} ${label}`;
  }, [presentation?.label, nodeType, mode]);

  const headerSubtitle = useMemo(() => {
    if (mode === 'edit') {
      const desc = presentation?.description?.trim();
      if (desc) {
        return desc;
      }
    }
    return undefined;
  }, [mode, presentation?.description]);

  const [evaluatedState, setEvaluatedState] = useState<{
    filled: boolean[];
    guards: StepGuardState;
  }>({
    filled: [],
    guards: emptyGuards,
  });

  useEffect(() => {
    let cancelled = false;
    const evaluate = async () => {
      try {
        const filled = await evaluateValidationState(steps);
        const dialogData = mergeDialogData(
          basicInfo,
          workingCopy?.data as Record<string, unknown> | undefined
        );
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
    basicInfo,
    workingCopy?.data,
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

  useEffect(() => {
    if (!dialogStateApi) return;
    if (!nodeType || !nodeId) return;
    if (!steps.length) return;
    if (!open) return;

    const enabledSet = new Set(enabledStepIndices);
    const validatedSet = new Set(validatedStepIndices);

    const stepStatuses = steps.map((step, idx) => ({
      id: step.id,
      title: step.label ?? step.id,
      enabled: enabledSet.has(idx) || idx === activeStepIndex,
      completed: validatedSet.has(idx),
      error: undefined as string | null | undefined,
    }));

    const snapshot: MultiStepDialogState = {
      nodeId,
      activeStepIndex,
      steps: stepStatuses,
      canProceedNext: evaluatedState.guards.canProceedNext,
      canGoBack: evaluatedState.guards.canGoBack,
      canSave: evaluatedState.guards.canSave,
      canStartBatch: evaluatedState.guards.canStartBatch,
      validationErrors: undefined,
      updatedAt: Date.now(),
      metadata: {
        title: dialogTitle,
        subtitle: headerSubtitle,
        committableStepIndices,
      },
    };

    const publishState = dialogStateApi.publishState;

    publishState({ nodeType, nodeId, state: snapshot }).catch((error) => {
      if (typeof console !== 'undefined' && typeof console.error === 'function') {
        console.error('[PluginDialogShell] failed to publish dialog state', error);
      }
      setDialogStateError(error);
    });
  }, [
    dialogStateApi,
    nodeType,
    nodeId,
    steps,
    activeStepIndex,
    enabledStepIndices,
    validatedStepIndices,
    evaluatedState.guards.canProceedNext,
    evaluatedState.guards.canGoBack,
    evaluatedState.guards.canSave,
    evaluatedState.guards.canStartBatch,
    dialogTitle,
    headerSubtitle,
    committableStepIndices,
    open,
  ]);

  useEffect(() => {
    if (!dialogStateApi) return;
    if (!nodeType || !nodeId) return;
    if (open) return;

    const publishState = dialogStateApi.publishState;
    publishState({ nodeType, nodeId, state: null }).catch(() => {});
  }, [dialogStateApi, nodeType, nodeId, open]);

  useEffect(
    () => () => {
      if (!dialogStateApi || !nodeType || !nodeId) return;
      const publishState = dialogStateApi.publishState;
      if (typeof publishState !== 'function') return;
      publishState({ nodeType, nodeId, state: null }).catch(() => {});
    },
    [dialogStateApi, nodeType, nodeId]
  );

  const handleNavigation = useCallback(
    (event: StepNavigationEvent) => {
      let nextIndex = activeStepIndex;
      switch (event.type) {
        case 'direct':
          nextIndex = clampIndex(event.targetIndex, steps.length);
          break;
        case 'next':
          nextIndex = clampIndex(activeStepIndex + 1, steps.length);
          break;
        case 'back':
          nextIndex = clampIndex(activeStepIndex - 1, steps.length);
          break;
      }
      if (nextIndex === activeStepIndex) return;
      setActiveStepIndex(nextIndex);
      setUrlStep(nextIndex);
    },
    [activeStepIndex, steps.length, setUrlStep]
  );

  const navigateToNode = useCallback(
    (targetId: NodeId) => {
      void navigate({ to: `/t/${treeId}/${pageNodeId}/${targetId}` as const });
    },
    [navigate, treeId, pageNodeId]
  );

  const saveDraftInProgress = useRef(false);

  const handleSubmit = useCallback(async () => {
    if (typeof console !== 'undefined' && typeof console.debug === 'function') {
      console.debug('[PluginDialogShell] submitting dialog', {
        nodeType,
        mode,
      });
    }
    const finalData = {
      ...workingCopy,
      name: basicInfo.name,
      description: basicInfo.description,
      data: { ...((workingCopy?.data as Record<string, unknown>) || {}), tags: basicInfo.tags },
    };

    const savedNodeId = await saveWorkingCopy(finalData);

    try {
      await discardWorkingCopy();
    } catch (err) {
      console.warn('[PluginDialogShell] discard after submit failed', err);
    }

    if (savedNodeId) {
      onSuccess?.(savedNodeId);
      navigateToNode(savedNodeId);
    }

    onClose();
  }, [workingCopy, basicInfo.name, basicInfo.description, basicInfo.tags, saveWorkingCopy, onClose, nodeType, mode, discardWorkingCopy, onSuccess, navigateToNode]);

  const handleSaveDraft = useCallback(async () => {
    try {
      saveDraftInProgress.current = true;
      const draftData = {
        ...workingCopy,
        name: basicInfo.name,
        description: basicInfo.description,
        isDraft: true,
      };
      await saveDraft(draftData);
    } catch (err) {
      saveDraftInProgress.current = false;
      throw err;
    }
  }, [workingCopy, basicInfo, saveDraft]);

  const handleCancel = useCallback(async () => {
    try {
      await discardWorkingCopy();
    } catch (err) {
      console.warn('[PluginDialogShell] discard on cancel failed', err);
    }
    onClose();
  }, [discardWorkingCopy, onClose]);

  const stepDescriptors = useMemo<ReadonlyArray<StepComponentDescriptor<StepData>>>(
    () =>
      steps.map((step) => ({
        id: step.id,
        label: step.label ?? step.id,
        component: PlaceholderStep,
      })),
    [steps]
  );

  const canSaveCurrent = evaluatedState.guards.canSave;
  const canStartBatch = evaluatedState.guards.canStartBatch;
  const footerPrimaryButtons = footerOptions?.primaryButtons;
  const footerSaveDraftLabel = footerOptions?.saveDraftLabel;

  const HeaderComponent: HeadlessMultiStepDialogProps<StepData>['HeaderComponent'] = useCallback(
    () => (
      <PluginDialogHeader
        title={dialogTitle}
        subtitle={headerSubtitle}
        icon={icon || undefined}
        dialogState={workerDialogState}
      />
    ),
    [dialogTitle, headerSubtitle, icon, workerDialogState]
  );

  const renderContent = useCallback(
    (propsContent: HeadlessContentRenderProps<StepData>) => {
      const step = steps[propsContent.activeStepIndex];
      return (
        <Box
          sx={(theme) => ({
            flex: 1,
            overflow: 'auto',
            padding: theme.spacing(2),
            backgroundColor: theme.palette.background.default,
          })}
        >
          {step?.component ?? null}
        </Box>
      );
    },
    [steps]
  );

  const FooterComponent: HeadlessMultiStepDialogProps<StepData>['FooterComponent'] = useCallback(
    () => (
      <PluginDialogFooter
        mode={mode}
        canCommit={canSaveCurrent}
        onSaveDraft={
          handleSaveDraft
            ? () => {
                handleSaveDraft().catch(() => void 0);
              }
            : undefined
        }
        disableDraft={!hasUnsavedChanges}
        canStartBatch={canStartBatch}
        primaryButtonOptions={footerPrimaryButtons}
        saveDraftLabel={footerSaveDraftLabel}
      />
    ),
    [
      mode,
      canSaveCurrent,
      handleSaveDraft,
      hasUnsavedChanges,
      canStartBatch,
      footerPrimaryButtons,
      footerSaveDraftLabel,
    ]
  );

  const handleCloseRequest = useCallback(() => {
    if (saveDraftInProgress.current) {
      saveDraftInProgress.current = false;
      onClose();
      return;
    }
    handleCancel().catch(() => void 0);
  }, [handleCancel, onClose]);

  const handleSizeChange = useCallback(
    (next?: MultiDialogSize) => {
      if (!next) return;
      const viewport = getViewportSize();
      const normalized = normalizeDialogState(next, dialogPositionRef.current, viewport, {
        enforceTopLeftMargin: displayMode === 'normal',
        minPosition: displayMode === 'normal' ? 0 : FRAME_CONSTANTS.NON_STANDARD_MARGIN,
        clampSizeToViewport: true,
      });
      if (!sizesEqual(dialogSizeRef.current, normalized.size)) {
        persistSize(normalized.size);
      }
      if (!positionsEqual(dialogPositionRef.current, normalized.position)) {
        persistPosition(normalized.position);
      }
    },
    [displayMode, persistPosition, persistSize]
  );

  const handlePositionChange = useCallback(
    (next?: MultiDialogPosition) => {
      if (!next) return;
      const viewport = getViewportSize();
      const normalized = normalizeDialogState(dialogSizeRef.current, next, viewport, {
        enforceTopLeftMargin: displayMode === 'normal',
        minPosition: displayMode === 'normal' ? 0 : FRAME_CONSTANTS.NON_STANDARD_MARGIN,
        clampSizeToViewport: true,
      });
      if (!sizesEqual(dialogSizeRef.current, normalized.size)) {
        persistSize(normalized.size);
      }
      if (!positionsEqual(dialogPositionRef.current, normalized.position)) {
        persistPosition(normalized.position);
      }
    },
    [displayMode, persistPosition, persistSize]
  );

  if (dialogStateError) {
    const errorObject =
      dialogStateError instanceof Error ? dialogStateError : new Error(String(dialogStateError));
    throw errorObject;
  }

  const currentStepData: StepData = toRecord(workingCopy?.data) ?? {};

  const headlessProps: HeadlessMultiStepDialogProps<StepData> = {
    open,
    stepComponents: stepDescriptors,
    stepData: currentStepData,
    onStepDataChange: (patch: Partial<StepData>) =>
      updateWorkingCopy({
        data: { ...currentStepData, ...patch },
      }),
    activeStepIndex,
    onStepNavigate: handleNavigation,
    enabledStepIndices,
    validatedStepIndices,
    committableStepIndices,
    invalidMessageMap: {},
    onRequestClose: handleCloseRequest,
    onRequestCommit: () => {
      handleSubmit().catch(() => void 0);
    },
    isDirty: hasUnsavedChanges,
    position: dialogPosition,
    onPositionChange: handlePositionChange,
    size: dialogSize,
    onSizeChange: handleSizeChange,
    displayMode,
    onDisplayModeChange: (mode) => {
      void transitionDisplayMode(mode);
    },
    HeaderComponent,
    renderContent,
    FooterComponent,
  };

  return {
    headlessProps,
    stepDescriptors,
    loading,
    error,
    icon: icon ?? undefined,
    presentation,
    hasUnsavedChanges,
    dialogState: workerDialogState,
  };
}
