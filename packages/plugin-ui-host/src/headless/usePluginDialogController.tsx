/**
 * usePluginDialogController – core state machine for plugin console.
 *
 * Coordinates worker access, step composition, navigation rules, and
 * capability evaluation so the headless dialog shell can render plugin-loader with
 * consistent Next/Save guards derived from plugin-provided services.
 */

import type { DialogStateAPI, WorkerAPI } from '@hierarchidb/common-api';
import type { DialogStateSubscribeInput, NodeId, TagEntity, TreeId } from '@hierarchidb/common-types';
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
import { BasicInfoStep, useDialogDraft, type DraftData } from '@hierarchidb/plugin-ui-sdk';
import { getWorkerClientHook, type WorkerClientRef } from '@hierarchidb/runtime-client';
import { resolveDefaultNodeName } from '@hierarchidb/runtime-worker';
import type {
  DialogDisplayMode,
  DialogStep,
  MultiDialogPosition,
  MultiDialogSize,
} from '@hierarchidb/ui-dialog';
import {
  type HeadlessContentRenderProps,
  type HeadlessMultiStepDialogProps,
  type StepComponentDescriptor,
  type StepComponentProps,
  type StepNavigationEvent,
} from '@hierarchidb/ui-dialog';
import { normalizeDialogState, getPresetSize, initialPosition, getViewportSize, FRAME_CONSTANTS, sizesEqual, positionsEqual } from '@hierarchidb/ui-dialog';
import { Box } from '@mui/material';
import { useNavigate } from '@tanstack/react-router';
import { type Remote } from 'comlink';
import type React from 'react';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { PluginDialogFooter, PluginDialogHeader } from './components/index.js';
import type { PluginDialogFooterPrimaryButtonOptions } from './components/PluginDialogFooter.js';
import {
  buildStepWorkingData,
  evaluateStepGuards,
  evaluateValidationState,
  mergeDialogData,
  extractBasicInfoFields,
  stripReservedDialogKeys,
  emptyGuards,
  toRecord,
} from './controller/step-guards.js';
import {
  clampIndex,
  DEFAULT_SIZE,
  DEFAULT_POSITION,
} from './controller/dialog-layout.js';
import { subscribeDialogState } from './controller/dialog-state-subscriber.js';
import type { StepGuardState } from './controller/types.js';
import type { MultiStepDialogState } from './controller/types.js';

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

type StepAdapterProps = {
  cfg: PluginStepConfig;
  mode: 'create' | 'edit';
  nodeId: string;
  parentId: string;
  workingData: Record<string, unknown> | undefined;
  updateDraft: (patch: Partial<DraftData>) => void;
  onDataChange?: (data: Record<string, unknown>) => void;
  dialogRef?: React.RefObject<HTMLElement | null>;
};

const StepAdapterComponent: React.FC<StepAdapterProps> = ({
  cfg,
  mode,
  nodeId,
  parentId,
  workingData,
  updateDraft,
  onDataChange,
  dialogRef,
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

  const handleChange = useCallback(
    (data: unknown) => {
      const record = toRecord(data) ?? {};
      onDataChange?.(record);
      updateDraft({ draftData: record });
    },
    [onDataChange, updateDraft]
  );

  return (
    <>
      {cfg.componentFactory({
        mode,
        nodeId,
        parentId,
        data: workingData,
        disabled: false,
        onChange: handleChange,
        setValid,
        setError,
        dialogRef,
      })}
    </>
  );
};

const toStringArray = (value: unknown): string[] =>
  Array.isArray(value) ? value.filter((v): v is string => typeof v === 'string') : [];

const PlaceholderStep: React.FC<StepComponentProps<StepData>> = () => null;

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
    draft,
    hasUnsavedChanges,
    updateDraft,
    saveDraft,
    discardDraft,
    loading,
    error,
  } = useDialogDraft({
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

  const dialogRef = useRef<HTMLDivElement | null>(null);
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
    if (draft) {
      const tags =
        (Array.isArray(draft.draftMetadata?.tags)
          ? draft.draftMetadata?.tags
          : draft.metadata?.tags) ?? [];
      const resolvedName =
        typeof draft.draftMetadata?.name === 'string' && draft.draftMetadata.name.length
          ? draft.draftMetadata.name
          : typeof draft.metadata?.name === 'string'
            ? draft.metadata.name
            : '';
      const resolvedDescription =
        typeof draft.draftMetadata?.description === 'string' && draft.draftMetadata.description.length
          ? draft.draftMetadata.description
          : typeof draft.metadata?.description === 'string'
            ? draft.metadata.description
            : '';
      setBasicInfo({
        name: resolvedName,
        description: resolvedDescription,
        tags,
      });
    }
  }, [draft]);

  const draftDataWithoutMeta = useMemo(
    () => (toRecord(draft?.draftData) ?? {}),
    [draft?.draftData]
  );

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

  const [siblingNames, setSiblingNames] = useState<Set<string>>(() => new Set());

  useEffect(() => {
    if (mode !== 'create') {
      setSiblingNames(new Set());
      return;
    }
    if (!client || !pageNodeId) {
      setSiblingNames(new Set());
      return;
    }
    let disposed = false;
    (async () => {
      try {
        const query = await client.getQueryAPI();
        const siblings = await query.listChildren(pageNodeId);
        if (disposed) return;
        const values = new Set(
          siblings
            .filter((node) => String(node?.id ?? '') !== String(nodeId))
            .map((node) => (typeof node?.metadata.name === 'string' ? node.metadata.name.trim().toLowerCase() : ''))
            .filter((name): name is string => Boolean(name))
        );
        setSiblingNames(values);
      } catch {
        if (!disposed) {
          setSiblingNames(new Set());
        }
      }
    })();
    return () => {
      disposed = true;
    };
  }, [client, mode, pageNodeId, nodeId]);

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
          name: prev.name || node.metadata.name || '',
          description: prev.description || node.metadata.description || '',
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
    if (!draft?.data) return;
    const info = extractBasicInfoFields(draftDataWithoutMeta);
    setBasicInfo((prev) => {
      const tagsEqual =
        prev.tags.length === info.tags.length &&
        prev.tags.every((tag, idx) => tag === info.tags[idx]);
      if (prev.name === info.name && prev.description === info.description && tagsEqual) {
        return prev;
      }
      return info;
    });
  }, [composedConfigs.hasHostBase, draft?.data, draftDataWithoutMeta]);

  const pluginConfigSteps = useMemo(() => {
    void regTick;
    if (mode === 'create') return stepRegistry.getCreateSteps(nodeType);
    if (mode === 'edit')
      return stepRegistry.getEditSteps(nodeType, String(nodeId), draftDataWithoutMeta);
    return [];
  }, [mode, nodeType, nodeId, draftDataWithoutMeta, stepRegistry, regTick]);

  const normalizedBasicName = basicInfo.name.trim();
  const normalizedBasicKey = normalizedBasicName.toLowerCase();
  const hasBasicInfoNameConflict =
    mode === 'create' && Boolean(normalizedBasicKey) && siblingNames.has(normalizedBasicKey);
  const basicInfoValidationError = !normalizedBasicName
    ? 'Name is required'
    : hasBasicInfoNameConflict
      ? 'A node with this name already exists in this folder'
      : null;
  const isBasicInfoValid = !basicInfoValidationError;
  const basicInfoMeta = useMemo(
    () => ({ error: basicInfoValidationError, hasConflict: hasBasicInfoNameConflict }),
    [basicInfoValidationError, hasBasicInfoNameConflict]
  );

  const handleBasicInfoBridge = useCallback((data: Record<string, unknown>) => {
    const info = extractBasicInfoFields(data);
    setBasicInfo(info);
    updateDraft({
      draftMetadata: {
        name: info.name,
        description: info.description,
        tags: info.tags,
      },
    });
  }, [updateDraft]);

  const currentStepData = useMemo<StepData>(
    () => buildStepWorkingData(draftDataWithoutMeta, basicInfo, basicInfoMeta),
    [basicInfo, basicInfoMeta, draftDataWithoutMeta]
  );
  const basicInfoValidationPayload = useMemo<StepData>(
    () => stripReservedDialogKeys(currentStepData),
    [currentStepData]
  );

  const dialogData = useMemo<StepData>(
    () => mergeDialogData(basicInfo, draftDataWithoutMeta as Record<string, unknown> | undefined),
    [basicInfo, draftDataWithoutMeta]
  );

  const renderStep = useCallback(
    (cfg: PluginStepConfig) => (
      <StepAdapterComponent
        cfg={cfg}
        mode={mode}
        nodeId={String(nodeId)}
        parentId={String(pageNodeId)}
        workingData={currentStepData}
        updateDraft={updateDraft}
        onDataChange={cfg.id === 'basic-info' ? handleBasicInfoBridge : undefined}
        dialogRef={dialogRef}
      />
    ),
    [currentStepData, handleBasicInfoBridge, mode, nodeId, pageNodeId, updateDraft]
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
            onChange={(data: {
              name: string;
              description: string;
              tags?: string[];
            }) =>
              setBasicInfo((prev) => {
                const next = {
                  name: data.name,
                  description: data.description ?? '',
                  tags: data.tags ?? [],
                };
                if (
                  prev.name !== next.name ||
                  prev.description !== next.description ||
                  prev.tags.join(',') !== next.tags.join(',')
                ) {
                  updateDraft({
                    draftMetadata: {
                      name: next.name,
                      description: next.description,
                      tags: next.tags,
                    },
                  });
                }
                return next;
              })
            }
            mode={mode}
            validate={() => basicInfoValidationError}
          />
        ),
        validate: () => isBasicInfoValid,
      });
    }

    if (composedConfigs.configs.length) {
      composedConfigs.configs.forEach((cfg) => {
        const isBasicInfoStep = cfg.id === 'basic-info';
        const validationPayload = isBasicInfoStep
          ? basicInfoValidationPayload
          : draftDataWithoutMeta;
        const validateFn = cfg.validate;
        const resolveValidate = (() => {
          if (isBasicInfoStep) {
            if (validateFn) {
              return () => Boolean(validateFn(validationPayload)) && isBasicInfoValid;
            }
            return () => isBasicInfoValid;
          }
          return validateFn ? () => validateFn(validationPayload) : undefined;
        })();
        result.push({
          id: cfg.id,
          label: cfg.label ?? cfg.id,
          optional: !!cfg.optional,
          validate: resolveValidate,
          component: renderStep(cfg),
        });
      });
      return result;
    }

    return result.concat(pluginConfigSteps);
  }, [
    composedConfigs.hasHostBase,
    composedConfigs.configs,
    pluginConfigSteps,
    basicInfo.name,
    basicInfo.description,
    basicInfo.tags,
    tagSuggestions,
    mode,
    basicInfoValidationError,
    isBasicInfoValid,
    renderStep,
    updateDraft,
    draftDataWithoutMeta,
    basicInfoValidationPayload,
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
  const [isStartingBatch, setIsStartingBatch] = useState(false);

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
        payload: {
          draftMetadata: {
            ...draft?.draftMetadata,
            name: basicInfo.name,
            description: basicInfo.description,
            tags: basicInfo.tags,
          },
          draftData: { ...draftDataWithoutMeta },
        },
      });
    }
    const finalData = {
      ...draft,
      draftMetadata: {
        ...draft?.draftMetadata,
        name: basicInfo.name,
        description: basicInfo.description,
        tags: basicInfo.tags,
      },
      draftData: { ...draftDataWithoutMeta, tags: basicInfo.tags },
    } as Partial<DraftData>;

    const savedNodeId = await saveDraft(finalData);

    try {
      await discardDraft();
    } catch (err) {
      console.warn('[PluginDialogShell] discard after submit failed', err);
    }

    if (savedNodeId) {
      onSuccess?.(savedNodeId);
      navigateToNode(savedNodeId);
    }

    onClose();
  }, [
    draft,
    basicInfo.name,
    basicInfo.description,
    basicInfo.tags,
    draftDataWithoutMeta,
    saveDraft,
    onClose,
    nodeType,
    mode,
    discardDraft,
    onSuccess,
    navigateToNode,
  ]);

  const handleSaveDraft = useCallback(async () => {
    try {
      saveDraftInProgress.current = true;
      const draftData = {
        ...draft,
        draftMetadata: {
          ...draft?.draftMetadata,
          name: basicInfo.name,
          description: basicInfo.description,
          tags: basicInfo.tags,
        },
        draftData: { ...draftDataWithoutMeta },
      } as Partial<DraftData>;
      if (typeof console !== 'undefined' && typeof console.debug === 'function') {
        console.debug('[PluginDialogShell] saveDraft payload', draftData);
      }
      await saveDraft(draftData);
    } catch (err) {
      saveDraftInProgress.current = false;
      throw err;
    }
  }, [draft, basicInfo, draftDataWithoutMeta, saveDraft]);

  const handleCancel = useCallback(async () => {
    try {
      await discardDraft();
    } catch (err) {
      console.warn('[PluginDialogShell] discard on cancel failed', err);
    }
    onClose();
  }, [discardDraft, onClose]);

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
  const activeStartBatch = activeStepConfig?.capabilities?.startBatch;
  const footerPrimaryButtons = footerOptions?.primaryButtons;
  const footerSaveDraftLabel = footerOptions?.saveDraftLabel;
  const disableDraftButton = nodeType === 'folder'; // Folder は create/edit とも Draft ボタン不要

  const handleStartBatch = useCallback(async () => {
    if (!activeStartBatch) return;
    setIsStartingBatch(true);
    try {
      await Promise.resolve(
        activeStartBatch(dialogData, {
          nodeId: nodeId as string | undefined,
          parentId: pageNodeId as string | undefined,
          treeId,
          mode,
          dialogData,
        })
      );
    } catch (error) {
      if (typeof console !== 'undefined' && typeof console.error === 'function') {
        console.error('[PluginDialogShell] start batch failed', error);
      }
    } finally {
      setIsStartingBatch(false);
    }
  }, [activeStartBatch, dialogData, mode, nodeId, pageNodeId, treeId]);

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
          ref={dialogRef}
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
          disableDraftButton
            ? undefined
            : handleSaveDraft
              ? () => {
                  handleSaveDraft().catch(() => void 0);
                }
              : undefined
        }
        disableDraft={disableDraftButton || !hasUnsavedChanges}
        onStartBatch={activeStartBatch ? () => { handleStartBatch().catch(() => void 0); } : undefined}
        canStartBatch={canStartBatch && !isStartingBatch}
        isStartingBatch={isStartingBatch}
        primaryButtonOptions={footerPrimaryButtons}
        saveDraftLabel={footerSaveDraftLabel}
      />
    ),
    [
      mode,
      canSaveCurrent,
      handleSaveDraft,
      hasUnsavedChanges,
      disableDraftButton,
      canStartBatch,
      activeStartBatch,
      handleStartBatch,
      isStartingBatch,
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

  const headlessProps: HeadlessMultiStepDialogProps<StepData> = {
    open,
    stepComponents: stepDescriptors,
    stepData: currentStepData,
    onStepDataChange: (patch: Partial<StepData>) =>
      updateDraft({
        draftData: { ...currentStepData, ...patch },
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
