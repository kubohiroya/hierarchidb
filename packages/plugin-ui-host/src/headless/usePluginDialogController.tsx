/**
 * usePluginDialogController – headless orchestrator for plugin dialogs.
 * Dialog UI state is persisted on TreeNode.dialogUIState via TreeNodeUpdaterAPI.
 */
import type { WorkerAPI } from '@hierarchidb/common-api';
import { dequal } from 'dequal';
import type {
  DialogDisplayMode,
  DialogPosition,
  DialogSize,
  DialogState,
  DialogUIState,
  DialogWindowState,
  DialogProgressState,
  NodeId,
  TreeId,
} from '@hierarchidb/common-types';
import { HostProfileRegistry, PluginStepRegistry, composeStepConfigs } from '@hierarchidb/plugin-base';
import { getPresentation, hydratePresentationDefinitionsFromGlobal } from '@hierarchidb/plugin-presentation';
import { useIconRegistry } from '@hierarchidb/ui-icon';
import { useTreeNodeUpdater, type TreeNodeUpdaterState } from '@hierarchidb/plugin-ui-sdk';
import { getWorkerClientHook, type WorkerClientRef } from '@hierarchidb/ui-worker-provider';
import type {
  HeadlessDialogProps,
  StepComponentDescriptor,
  StepNavigationEvent,
} from '@hierarchidb/ui-dialog';
import { PluginDialogContent } from '@hierarchidb/ui-dialog';
import type { Theme } from '@mui/material/styles';
import { useNavigate } from '@tanstack/react-router';
import type { Remote } from 'comlink';
import type React from 'react';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { TREE_CONSOLE_SETTINGS_STORAGE_KEY, loadTreeConsoleSettings } from '@hierarchidb/util';
import type { PluginDialogFooterPrimaryButtonOptions, PluginDialogFooterProps } from './components/PluginDialogFooter.js';
import { toRecord } from './controller/step-guards.js';
import { useDialogFrameState } from './usePluginDialogController/frame-state.js';
import { useBasicInfoState } from './usePluginDialogController/basic-info.js';
import { useDialogSteps } from './usePluginDialogController/steps.js';
import { useStepCapabilities } from './usePluginDialogController/capabilities.js';
import { useDialogUIStateSync } from './usePluginDialogController/dialog-ui-state.js';
import { useConflictGuard } from './usePluginDialogController/conflict-guard.js';
import { useAutosave } from './usePluginDialogController/autosave.js';
import { usePendingAction } from './usePluginDialogController/pending-action.js';
import { useDialogDirtyState } from './usePluginDialogController/dirty-state.js';
import type {
  TreeNodeUpdaterPayload,
  TreeNodeUpdaterPatch,
} from './usePluginDialogController/data-types.js';
import type { DialogActionInFlight } from './types.js';
import {
  ConflictDialog,
  createContentComponent,
  createFooterComponent,
  createHeaderComponent,
} from './components/DialogScaffold.js';

export interface PluginDialogControllerOptions {
  mode: 'create' | 'edit' | 'preview';
  nodeType: string;
  nodeId: NodeId;
  pageNodeId: NodeId;
  treeId: TreeId;
  open: boolean;
  initialStep?: number;
  forceInitialStep?: boolean;
  onClose: () => void;
  onSuccess?: (nodeId: NodeId) => void;
  footerOptions?: PluginDialogFooterOptions;
  autosaveEnabled?: boolean;
}

export interface PluginDialogFooterOptions {
  primaryButtons?: PluginDialogFooterPrimaryButtonOptions;
  saveDraftLabel?: string;
}

import type { TreeNodeData } from '@hierarchidb/common-types';
type PluginDefinedEntity = TreeNodeData;
type LocalTreeNodeUpdaterState = TreeNodeUpdaterState<PluginDefinedEntity> & {
  dialogUIState?: DialogUIState | null;
};

export interface PluginDialogControllerState {
  headlessProps: HeadlessDialogProps<Partial<PluginDefinedEntity>>;
  stepDescriptors: ReadonlyArray<StepComponentDescriptor<Partial<PluginDefinedEntity>>>;
  loading: boolean;
  error: unknown;
  icon?: React.ReactNode;
  presentation?: {
    label: string;
    description?: string;
  };
  hasUnsavedChanges: boolean;
  dialogState?: DialogState | null;
  updateDialogState: (patch: Partial<DialogState>) => void;
  unsavedChangeDialog?: {
    open: boolean;
    onDiscard: () => void;
    onCancel: () => void;
    title: string;
    message: string;
  };
  conflictDialog?: React.ReactNode;
}

const PlaceholderStep: React.FC = () => null;

const formatTimestamp = (timestamp?: number): string => {
  if (!timestamp) return '';
  const date = new Date(timestamp);
  const pad = (v: number) => `${v}`.padStart(2, '0');
  return `${date.getFullYear()}/${pad(date.getMonth() + 1)}/${pad(date.getDate())} ${pad(date.getHours())}:${pad(date.getMinutes())}:${pad(date.getSeconds())}`;
};

/*
// Lightweight deep-ish equality to reuse stepData references when unchanged.
const shallowEqualValue = (a: unknown, b: unknown): boolean => {
  if (a === b) return true;
  const stack: Array<{ left: unknown; right: unknown }> = [{ left: a, right: b }];
  while (stack.length) {
    const { left, right } = stack.pop()!;
    if (left === right) continue;
    const leftArr = Array.isArray(left);
    const rightArr = Array.isArray(right);
    if (leftArr || rightArr) {
      if (!leftArr || !rightArr) return false;
      if (left.length !== right.length) return false;
      for (let i = 0; i < left.length; i += 1) {
        stack.push({ left: left[i], right: right[i] });
      }
      continue;
    }
    const leftObj = typeof left === 'object' && left !== null;
    const rightObj = typeof right === 'object' && right !== null;
    if (leftObj || rightObj) {
      if (!leftObj || !rightObj) return false;
      const leftKeys = Object.keys(left as Record<string, unknown>);
      const rightKeys = Object.keys(right as Record<string, unknown>);
      if (leftKeys.length !== rightKeys.length) return false;
      for (const key of leftKeys) {
        if (!Object.prototype.hasOwnProperty.call(right, key)) return false;
        stack.push({
          left: (left as Record<string, unknown>)[key],
          right: (right as Record<string, unknown>)[key],
        });
      }
      continue;
    }
    if (left !== right) return false;
  }
  return true;
};
*/

const reuseNumberArray = (prevRef: React.MutableRefObject<ReadonlyArray<number>>, next: ReadonlyArray<number>) => {
  const prev = prevRef.current;
  if (prev === next) return prev;
  if (prev.length === next.length && prev.every((v, i) => v === next[i])) {
    return prev;
  }
  prevRef.current = next;
  return next;
};

const readStoredAutosave = (): boolean => {
  const stored = loadTreeConsoleSettings().autosaveEnabled;
  return typeof stored === 'boolean' ? stored : true;
};

const useAutosavePreference = (explicit?: boolean): boolean => {
  const [enabled, setEnabled] = useState<boolean>(() => {
    if (typeof explicit === 'boolean') return explicit;
    return readStoredAutosave();
  });

  useEffect(() => {
    if (typeof explicit === 'boolean') {
      setEnabled(explicit);
      return undefined;
    }
    setEnabled(readStoredAutosave());
    const global = typeof window !== 'undefined' ? window : null;
    if (!global) return undefined;
    const handleStorage = (event: StorageEvent) => {
      if (event.key && event.key !== TREE_CONSOLE_SETTINGS_STORAGE_KEY) return;
      setEnabled(readStoredAutosave());
    };
    global.addEventListener('storage', handleStorage);
    return () => {
      global.removeEventListener('storage', handleStorage);
    };
  }, [explicit]);

  return enabled;
};

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
    initialStep = 1,
    forceInitialStep = false,
    onClose,
    onSuccess,
    footerOptions,
    autosaveEnabled: autosaveEnabledProp,
  } = options;
  const dialogMode = mode;
  const stepMode: 'create' | 'edit' = dialogMode === 'preview' ? 'edit' : dialogMode;

  const { t } = useTranslation('common');
  const navigate = useNavigate();
  const stepRegistry = PluginStepRegistry.getInstance();
  const hostRegistry = HostProfileRegistry.getInstance();
  const toPersistedStepIndex = useCallback((index: number): number => Math.max(index + 1, 1), []);

  const useClientHook = getWorkerClientHook<WorkerClientRef | null>() ?? (() => null);
  const ref = useClientHook();
  const client: Remote<WorkerAPI> | null = useMemo(() => ref?.client ?? null, [ref]);
  const autosaveEnabled = useAutosavePreference(autosaveEnabledProp);

  const initialDraftData = useMemo(() => {
    if (stepMode === 'create' && nodeType === 'basemap') {
      return {
        mapStyle: { style: 'streets' },
        viewport: undefined,
      } as TreeNodeData;
    }
    return undefined;
  }, [stepMode, nodeType]);

  const {
    treeNodeUpdater: draft,
    hasUnsavedChanges,
    updateTreeNodeUpdater,
    commitTreeNodeUpdater,
    discardDraft,
    saveDraft,
    loading,
    error,
  } = useTreeNodeUpdater<Partial<PluginDefinedEntity>>({
    mode: stepMode,
    nodeType,
    nodeId,
    parentId: pageNodeId,
    treeId,
    workerClient: ref ?? null,
    initialDraftData,
  });

  useAutosave({ open, draft, hasUnsavedChanges, saveDraft, enabled: autosaveEnabled });

  const treeUpdater: TreeNodeUpdaterPayload<PluginDefinedEntity> | null = useMemo(
    () =>
      draft
        ? {
            treeNodeId: draft.treeNodeId,
            draftMetadata: draft.draftMetadata ?? null,
            draftData: draft.draftData ?? null,
          }
        : null,
    [draft]
  );
  const isTemporary = Boolean(draft?.isTemporary);

  const dialogUIState = (draft as LocalTreeNodeUpdaterState | null)?.dialogUIState ?? null;
  const isDialogReady = Boolean(dialogUIState);

  const {
    activeStepIndex,
    setActiveStepIndex,
    setUrlStep,
    displayMode,
    dialogSize,
    dialogPosition,
    transitionDisplayMode,
    handleSizeChange,
    handlePositionChange,
    dialogRef,
  } = useDialogFrameState({
    nodeType,
    nodeId,
    pageNodeId,
    initialStep,
    forceInitialStep,
    initialDialogUIState: dialogUIState,
  });

  const {
    dialogUIStateRef,
    updateDialogUIState,
    getPersistableDialogUIState,
    dialogStateSnapshot,
    updateDialogState,
  } = useDialogUIStateSync({
    dialogUIState,
    activeStepIndex,
    dialogPosition,
    dialogSize,
    displayMode,
    forceInitialStep,
    restoreKey: (treeUpdater?.treeNodeId ?? nodeId) as string | number | null,
    restoreDeps: {
      setActiveStepIndex,
      setUrlStep,
      handleSizeChange,
      handlePositionChange,
      transitionDisplayMode,
    },
  });

  const draftDataWithoutMeta = useMemo<Partial<PluginDefinedEntity>>(
    () => (toRecord(draft?.draftData ?? null) as Partial<PluginDefinedEntity>) ?? {},
    [draft?.draftData]
  );

  const [localDraftData, setLocalDraftData] = useState<Partial<PluginDefinedEntity>>(
    () => draftDataWithoutMeta
  );
  useEffect(() => {
    setLocalDraftData(draftDataWithoutMeta);
  }, [draftDataWithoutMeta]);

  const applyUpdateDraft = useCallback(
    (patch: TreeNodeUpdaterPatch<PluginDefinedEntity>) => {
      const payload: Partial<LocalTreeNodeUpdaterState> = {
        treeNodeId: (treeUpdater?.treeNodeId ?? nodeId) as NodeId,
      };
      if (patch.draftMetadata !== undefined) payload.draftMetadata = patch.draftMetadata ?? undefined;
      if (patch.draftData !== undefined) payload.draftData = patch.draftData ?? undefined;
      updateTreeNodeUpdater(payload);
    },
    [nodeId, treeUpdater?.treeNodeId, updateTreeNodeUpdater]
  );

  const {
    basicInfo,
    setBasicInfo,
    basicInfoValidationError,
    isBasicInfoValid,
    basicInfoMeta,
    tagSuggestions,
    handleBasicInfoBridge,
  } = useBasicInfoState({
    mode: stepMode,
    nodeType,
    nodeId,
    pageNodeId,
    client,
    draft: treeUpdater,
    updateDraft: (patch) => {
      setLocalDraftData((prev) => ({ ...(toRecord(prev) ?? {}), ...patch.draftData }));
      applyUpdateDraft(patch);
    },
  });

  const { dialogDirty } = useDialogDirtyState({
    open,
    draft: treeUpdater,
    basicInfo,
    treeUpdater,
    localDraftData: toRecord(localDraftData ?? {}) ?? {},
  });

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
    return composeStepConfigs(nodeType, stepMode);
  }, [nodeType, regTick, hostTick, stepMode]);

  useEffect(() => {
    hydratePresentationDefinitionsFromGlobal();
  }, []);

  const { steps, stepDescriptors, currentStepData, dialogData } = useDialogSteps({
    composedConfigs,
    basicInfo,
    setBasicInfo,
    basicInfoMeta,
    basicInfoValidationError,
    isBasicInfoValid,
    tagSuggestions,
    mode: stepMode,
    nodeId,
    pageNodeId,
    draftData: localDraftData,
    setDraftData: setLocalDraftData,
    handleBasicInfoBridge,
    dialogRef,
    basicInfoLabel: t('common.basicInfo.title', 'Basic Information'),
  });

  // Stabilize stepData reference to avoid noisy context diffs in HeadlessPluginDialog
  const stepDataRef = useRef<Partial<PluginDefinedEntity>>(currentStepData);
  const stableStepData = useMemo(() => {
    const prev = stepDataRef.current;
    if (dequal(prev, currentStepData)) {
      return prev;
    }
    stepDataRef.current = currentStepData;
    return currentStepData;
  }, [currentStepData]);

  const { resolveIcon } = useIconRegistry();
  const iconNodeType =
    nodeType.endsWith('-plugin') && nodeType !== 'folder-plugin'
      ? nodeType.replace(/-plugin$/, '')
      : nodeType;
  const presentation = useMemo(() => getPresentation(nodeType), [nodeType]);
  const icon = useMemo(
    () =>
      resolveIcon({
        nodeType: iconNodeType,
        icon: presentation?.icon,
      }),
    [iconNodeType, presentation?.icon, resolveIcon]
  );
  const isFolder = nodeType === 'folder';

  const dialogTitle = useMemo(() => {
    const label = presentation?.label || nodeType;
    return dialogMode === 'create'
      ? t('dialogs.pluginDialog.titles.create', { plugin: label, defaultValue: 'Create {{plugin}}' })
      : t('dialogs.pluginDialog.titles.edit', { plugin: label, defaultValue: 'Edit {{plugin}}' });
  }, [dialogMode, nodeType, presentation?.label, t]);

  const headerSubtitle =
    !isFolder && dialogMode !== 'create'
      ? presentation?.description?.trim() || undefined
      : undefined;

  const {
    evaluatedState,
    enabledStepIndices,
    validatedStepIndices,
    committableStepIndices,
    activeStepConfig,
  } = useStepCapabilities({
    steps,
    composedConfigs,
    activeStepIndex,
    dialogData,
  });
  const stableEnabledStepsRef = useRef<ReadonlyArray<number>>([]);
  const stableValidatedStepsRef = useRef<ReadonlyArray<number>>([]);
  const stableCommittableStepsRef = useRef<ReadonlyArray<number>>([]);
  const stableEnabledStepIndices = useMemo(
    () => reuseNumberArray(stableEnabledStepsRef, enabledStepIndices),
    [enabledStepIndices],
  );
  const stableValidatedStepIndices = useMemo(
    () => reuseNumberArray(stableValidatedStepsRef, validatedStepIndices),
    [validatedStepIndices],
  );
  const stableCommittableStepIndices = useMemo(
    () => reuseNumberArray(stableCommittableStepsRef, committableStepIndices),
    [committableStepIndices],
  );

  const safeStepDescriptors: ReadonlyArray<StepComponentDescriptor<Partial<PluginDefinedEntity>>> = useMemo(
    () =>
      stepDescriptors.length
        ? stepDescriptors
        : [{ id: 'placeholder', label: 'placeholder', component: PlaceholderStep }],
    [stepDescriptors]
  );

  const {
    conflictDialog,
    resolveConflict,
    ensureNoConflict,
  } = useConflictGuard({
    mode: stepMode,
    client,
    nodeId,
    draftVersion: draft?.version,
    discardDraft,
    onClose,
    updateTreeNodeUpdater,
  });

  const updateLocalDraft = useCallback(async () => {
    if (!treeUpdater) return;
    const nextPatch: Partial<TreeNodeUpdaterState<PluginDefinedEntity>> = {
      treeNodeId: (treeUpdater.treeNodeId ?? nodeId) as NodeId,
      draftMetadata: {
        ...(treeUpdater.draftMetadata ?? {}),
        name: basicInfo.name,
        description: basicInfo.description,
        tags: basicInfo.tags,
      },
      draftData: nodeType === 'folder' ? null : { ...(localDraftData ?? {}) },
    };
    updateTreeNodeUpdater(nextPatch);
  }, [basicInfo.description, basicInfo.name, basicInfo.tags, localDraftData, nodeId, treeUpdater, updateTreeNodeUpdater, nodeType]);

  const canSaveCurrent = evaluatedState.guards.canSave || dialogDirty;
  const canStartBatch = evaluatedState.guards.canStartBatch;
  const activeStartBatch = activeStepConfig?.capabilities?.startBatch;
  const footerPrimaryButtons = footerOptions?.primaryButtons;
  const footerSaveDraftLabel = footerOptions?.saveDraftLabel;
  const disableDraftButton = nodeType === 'folder';
  const { pendingAction, pendingActionRef, runWithPending } = usePendingAction(open);
  const [isStartingBatch, setIsStartingBatch] = useState(false);
  const [discardDialogOpen, setDiscardDialogOpen] = useState(false);
  const dialogDirtyRef = useRef(dialogDirty);
  useEffect(() => {
    dialogDirtyRef.current = dialogDirty;
  }, [dialogDirty]);
  const discardDraftRef = useRef(discardDraft);
  useEffect(() => {
    discardDraftRef.current = discardDraft;
  }, [discardDraft]);
  const onCloseRef = useRef(onClose);
  useEffect(() => {
    onCloseRef.current = onClose;
  }, [onClose]);
  const runWithPendingRef = useRef(runWithPending);
  useEffect(() => {
    runWithPendingRef.current = runWithPending;
  }, [runWithPending]);
  const saveDraftHandlerRef = useRef<(() => Promise<void>) | undefined>(undefined);
  const startBatchHandlerRef = useRef<(() => Promise<void>) | undefined>(undefined);

  const ensureNoConflictRef = useRef(ensureNoConflict);
  useEffect(() => {
    ensureNoConflictRef.current = ensureNoConflict;
  }, [ensureNoConflict]);

  const updateLocalDraftRef = useRef(updateLocalDraft);
  useEffect(() => {
    updateLocalDraftRef.current = updateLocalDraft;
  }, [updateLocalDraft]);

  const setActiveStepIndexRef = useRef(setActiveStepIndex);
  const setUrlStepRef = useRef(setUrlStep);
  useEffect(() => {
    setActiveStepIndexRef.current = setActiveStepIndex;
    setUrlStepRef.current = setUrlStep;
  }, [setActiveStepIndex, setUrlStep]);

  const activeStepIndexRef = useRef(activeStepIndex);
  activeStepIndexRef.current = activeStepIndex;
  const enabledStepsNavRef = useRef(enabledStepIndices);
  enabledStepsNavRef.current = enabledStepIndices;
  const validatedStepsNavRef = useRef(validatedStepIndices);
  validatedStepsNavRef.current = validatedStepIndices;
  const stepsLengthRef = useRef(steps.length);
  stepsLengthRef.current = steps.length;
  const pendingStepTransitionRef = useRef<{ target: number; resolve: () => void } | null>(null);
  const canSaveRef = useRef(canSaveCurrent);
  canSaveRef.current = canSaveCurrent;
  const handleSubmitRef = useRef<(() => Promise<void>) | null>(null);

  const handleNavigation = useCallback(
    (event: StepNavigationEvent) => {
      const action: DialogActionInFlight =
        event.type === 'direct'
          ? { type: 'step', index: event.targetIndex ?? activeStepIndexRef.current }
          : { type: event.type };
      void runWithPending(action, async () => {
        const ok = await ensureNoConflictRef.current();
        if (!ok) return;
        let nextIndex = activeStepIndexRef.current;
        switch (event.type) {
          case 'direct':
            nextIndex = Math.max(
              0,
              Math.min(event.targetIndex ?? activeStepIndexRef.current, stepsLengthRef.current - 1)
            );
            break;
          case 'next':
            nextIndex = Math.min(activeStepIndexRef.current + 1, stepsLengthRef.current - 1);
            break;
          case 'back':
            nextIndex = Math.max(activeStepIndexRef.current - 1, 0);
            break;
        }
        if (nextIndex === activeStepIndexRef.current) return;
        const waitForTransition = new Promise<void>((resolve) => {
          pendingStepTransitionRef.current = { target: nextIndex, resolve };
        });
        await Promise.resolve(updateLocalDraftRef.current?.()).finally(() => {
          setActiveStepIndexRef.current(nextIndex);
          setUrlStepRef.current(nextIndex);
          updateDialogUIState({
            dialogProgress: { activeStepIndex: toPersistedStepIndex(nextIndex) } as DialogProgressState,
          });
        });
        await Promise.race([
          waitForTransition,
          new Promise<void>((resolve) => {
            window.setTimeout(resolve, 5000);
          }),
        ]);
        if (pendingStepTransitionRef.current?.target === nextIndex) {
          pendingStepTransitionRef.current = null;
        }
      });
    },
    [runWithPending, updateDialogUIState, toPersistedStepIndex]
  );

  const navigateToNode = useCallback(
    (targetId: NodeId) => {
      void navigate({ to: `/t/${treeId}/${pageNodeId}/${targetId}` as const });
    },
    [navigate, treeId, pageNodeId]
  );

  const persistDialogWindow = useCallback(
    (patch: Partial<DialogWindowState>) => {
      const prevWindow = (dialogUIStateRef.current)?.dialogWindow ?? null;
      const next: DialogWindowState = {
        mode: patch.mode ?? prevWindow?.mode ?? displayMode,
        position: patch.position ?? prevWindow?.position ?? dialogPosition,
        size: patch.size ?? prevWindow?.size ?? dialogSize,
      };
      updateDialogUIState({ dialogWindow: next });
    },
    [dialogPosition, dialogSize, dialogUIStateRef, displayMode, updateDialogUIState]
  );

  const handleSizeChangeWithPersist = useCallback(
    (next?: DialogSize) => {
      handleSizeChange(next);
      persistDialogWindow({ size: next ?? dialogSize });
    },
    [dialogSize, handleSizeChange, persistDialogWindow]
  );

  const handlePositionChangeWithPersist = useCallback(
    (next?: DialogPosition) => {
      handlePositionChange(next);
      persistDialogWindow({ position: next ?? dialogPosition });
    },
    [dialogPosition, handlePositionChange, persistDialogWindow]
  );

  useEffect(() => {
    const pending = pendingStepTransitionRef.current;
    if (pending && pending.target === activeStepIndex) {
      pending.resolve();
      pendingStepTransitionRef.current = null;
    }
  }, [activeStepIndex]);

  const handleSubmit = useCallback(async () => {
    await runWithPending({ type: 'commit' }, async () => {
      const ok = await ensureNoConflict();
      if (!ok) return;
      await updateLocalDraft();
      const normalizedData =
        nodeType === 'folder'
          ? null
          : dialogData && Object.keys(dialogData).length > 0
            ? (dialogData as TreeNodeData)
            : null;

      const savePayload: TreeNodeUpdaterState<Partial<PluginDefinedEntity>> = {
        treeNodeId: (treeUpdater?.treeNodeId ?? nodeId) as NodeId,
        draftMetadata: {
          name: basicInfo.name,
          description: basicInfo.description,
          tags: basicInfo.tags,
        },
        draftData: nodeType === 'folder' ? null : (normalizedData ?? null),
        dialogUIState: getPersistableDialogUIState(),
      };
      const savedNodeId = await commitTreeNodeUpdater('save', savePayload);
      const targetId = (savedNodeId ?? treeUpdater?.treeNodeId ?? nodeId) as NodeId;
      onSuccess?.(targetId);
      navigateToNode(targetId);
      onClose();
    });
  }, [basicInfo.description, basicInfo.name, basicInfo.tags, commitTreeNodeUpdater, dialogData, ensureNoConflict, getPersistableDialogUIState, navigateToNode, nodeType, onClose, onSuccess, runWithPending, treeUpdater?.treeNodeId, updateLocalDraft, nodeId]);

  useEffect(() => {
    handleSubmitRef.current = handleSubmit;
  }, [handleSubmit]);

  const handleSaveDraft = useCallback(async () => {
    await runWithPending({ type: 'save-draft' }, async () => {
      const ok = await ensureNoConflict();
      if (!ok) return;
      await updateLocalDraft();
      const draftPayload: TreeNodeUpdaterState<Partial<PluginDefinedEntity>> = {
        treeNodeId: (treeUpdater?.treeNodeId ?? nodeId) as NodeId,
        draftData: nodeType === 'folder' ? null : (dialogData as TreeNodeData),
        draftMetadata: {
          ...(treeUpdater?.draftMetadata ?? {}),
          name: basicInfo.name,
          description: basicInfo.description,
          tags: basicInfo.tags,
        },
        dialogUIState: getPersistableDialogUIState(),
      };
      await commitTreeNodeUpdater('save-draft', draftPayload);
      const targetId = (pageNodeId ?? nodeId) as NodeId;
      navigateToNode(targetId);
      onClose();
    });
  }, [runWithPending, ensureNoConflict, updateLocalDraft, treeUpdater?.treeNodeId, treeUpdater?.draftMetadata, nodeId, nodeType, dialogData, basicInfo.name, basicInfo.description, basicInfo.tags, getPersistableDialogUIState, commitTreeNodeUpdater, pageNodeId, navigateToNode, onClose]);
  useEffect(() => {
    saveDraftHandlerRef.current = handleSaveDraft;
  }, [handleSaveDraft]);

  const handleStartBatch = useCallback(async () => {
    if (!activeStartBatch) return;
    if (pendingActionRef.current) return;
    setIsStartingBatch(true);
    try {
      await Promise.resolve(
        activeStartBatch(dialogData, {
          nodeId: nodeId as string | undefined,
          parentId: pageNodeId as string | undefined,
          treeId,
          mode: stepMode,
          dialogData,
        })
      );
    } catch (err) {
      console.error('[PluginDialogShell] start batch failed', err);
    } finally {
      setIsStartingBatch(false);
    }
  }, [activeStartBatch, dialogData, nodeId, pageNodeId, pendingActionRef, stepMode, treeId]);
  useEffect(() => {
    startBatchHandlerRef.current = handleStartBatch;
  }, [handleStartBatch]);

  const HeaderComponent = useMemo<HeadlessDialogProps<Partial<PluginDefinedEntity>>['HeaderComponent']>(
    () => createHeaderComponent(dialogTitle, headerSubtitle, icon, pendingAction),
    [dialogTitle, headerSubtitle, icon, pendingAction],
  );

  const ContentComponent = useMemo<HeadlessDialogProps<Partial<PluginDefinedEntity>>['ContentComponent']>(
    () => {
      const Content = createContentComponent(dialogRef);
      return () => (
        <Content>
          <PluginDialogContent />
        </Content>
      );
    },
    [dialogRef],
  );

  const foregroundDialogSx = useMemo(
    () => ({
      zIndex: (theme: Theme) => theme.zIndex.modal + 2,
      '& .MuiBackdrop-root': {
        zIndex: (theme: Theme) => theme.zIndex.modal + 1,
      },
    }),
    []
  );

  const conflictDialogNode = useMemo(
    () => (
      <ConflictDialog
        open={conflictDialog.open}
        updatedAt={conflictDialog.updatedAt ?? null}
        foregroundSx={foregroundDialogSx}
        resolveConflict={resolveConflict}
        formatTimestamp={formatTimestamp}
        translate={t}
      />
    ),
    [conflictDialog.open, conflictDialog.updatedAt, foregroundDialogSx, resolveConflict, t],
  );

  const footerPropsRef = useRef<PluginDialogFooterProps>({
    mode: dialogMode,
    canCommit: canSaveCurrent,
    onSaveDraft: undefined,
    disableDraft: disableDraftButton || !dialogDirty || autosaveEnabled,
    onStartBatch: undefined,
    canStartBatch: canStartBatch && !isStartingBatch,
    isStartingBatch,
    primaryButtonOptions: footerPrimaryButtons,
    saveDraftLabel: footerSaveDraftLabel,
    pendingAction,
  });
  const stableOnSaveDraft = useCallback(() => {
    const fn = saveDraftHandlerRef.current;
    if (fn) {
      fn().catch(() => void 0);
    }
  }, []);
  const stableOnStartBatch = useCallback(() => {
    const fn = startBatchHandlerRef.current;
    if (fn) {
      fn().catch(() => void 0);
    }
  }, []);
  Object.assign(footerPropsRef.current, {
    mode: dialogMode,
    canCommit: canSaveCurrent,
    onSaveDraft: disableDraftButton || autosaveEnabled ? undefined : stableOnSaveDraft,
    disableDraft: disableDraftButton || !dialogDirty || autosaveEnabled,
    onStartBatch: activeStartBatch ? stableOnStartBatch : undefined,
    canStartBatch: canStartBatch && !isStartingBatch,
    isStartingBatch,
    primaryButtonOptions: footerPrimaryButtons,
    saveDraftLabel: footerSaveDraftLabel,
    pendingAction,
  });
  const FooterComponent = useMemo<HeadlessDialogProps<Partial<PluginDefinedEntity>>['FooterComponent']>(
    () => createFooterComponent(footerPropsRef),
    [],
  );

  const persistDialogUIStateOnClose = useCallback(async () => {
    if (dialogMode === 'create' || dialogMode === 'preview') return;
    const treeNodeId = (treeUpdater?.treeNodeId ?? nodeId) as NodeId | undefined;
    if (!treeNodeId) return;
    try {
      const payload: TreeNodeUpdaterState<Partial<PluginDefinedEntity>> = {
        treeNodeId,
        draftMetadata: treeUpdater?.draftMetadata ?? null,
        draftData: nodeType === 'folder' ? null : (treeUpdater?.draftData ?? null),
        dialogUIState: getPersistableDialogUIState(),
      };
      await commitTreeNodeUpdater('save-draft', payload);
    } catch (error) {
      console.warn('[PluginDialogShell] failed to persist dialog UI state on close', error);
    }
  }, [commitTreeNodeUpdater, dialogMode, getPersistableDialogUIState, nodeId, nodeType, treeUpdater?.draftData, treeUpdater?.draftMetadata, treeUpdater?.treeNodeId]);

  const handleCloseRequest = useCallback(() => {
    if (dialogDirtyRef.current) {
      setDiscardDialogOpen(true);
      return;
    }
    const runPending = runWithPendingRef.current;
    const discard = discardDraftRef.current;
    const close = onCloseRef.current;
    void runPending({ type: 'cancel' }, async () => {
      if (dialogMode === 'create') {
        if (isTemporary) {
          await discard?.({ forceDelete: true });
        }
      } else if (dialogMode !== 'preview') {
        await persistDialogUIStateOnClose();
      }
      close?.();
    });
  }, [dialogMode, isTemporary, persistDialogUIStateOnClose]);

  const handleConfirmDiscard = useCallback(() => {
    setDiscardDialogOpen(false);
    void runWithPending({ type: 'cancel' }, async () => {
      if (dialogMode === 'create') {
        if (isTemporary) {
          await discardDraft({ forceDelete: true });
        }
      } else if (dialogMode !== 'preview') {
        await persistDialogUIStateOnClose();
      }
      onClose();
    });
  }, [dialogMode, discardDraft, isTemporary, onClose, persistDialogUIStateOnClose, runWithPending]);

  const handleDismissDiscardDialog = useCallback(() => {
    setDiscardDialogOpen(false);
  }, []);

  const handleStepDataChange = useCallback(
    (patch: Partial<Partial<PluginDefinedEntity>>) => {
      if (nodeType === 'folder') {
        setLocalDraftData({});
        return;
      }
      setLocalDraftData((prev) => ({ ...(toRecord(prev) ?? {}), ...patch }));
    },
    [nodeType]
  );

  const handleRequestCommit = useCallback(() => {
    handleSubmitRef.current?.().catch((err) => {
      if (typeof console !== 'undefined' && typeof console.error === 'function') {
        console.error('[PluginDialogShell] commit failed', err);
      }
    });
  }, []);

  const invalidMessageMap = useMemo(() => ({}), []);

  const headlessProps: HeadlessDialogProps<Partial<PluginDefinedEntity>> = useMemo(
    () => ({
      open: open && isDialogReady,
      stepComponents: safeStepDescriptors,
      stepData: stableStepData,
      onStepDataChange: handleStepDataChange,
      activeStepIndex,
      onStepNavigate: handleNavigation,
      enabledStepIndices: stableEnabledStepIndices,
      validatedStepIndices: stableValidatedStepIndices,
      committableStepIndices: stableCommittableStepIndices,
      invalidMessageMap,
      onRequestClose: handleCloseRequest,
      onRequestCommit: handleRequestCommit,
      isDirty: dialogDirty,
      position: dialogPosition,
      onPositionChange: handlePositionChangeWithPersist as (next?: DialogPosition) => void,
      size: dialogSize,
      onSizeChange: handleSizeChangeWithPersist as (next?: DialogSize) => void,
      displayMode,
      onDisplayModeChange: (mode: DialogDisplayMode) => {
        void transitionDisplayMode(mode).then(() => {
          persistDialogWindow({ mode });
        });
      },
      HeaderComponent,
      ContentComponent,
      FooterComponent,
    }),
    [open, isDialogReady, safeStepDescriptors, stableStepData, handleStepDataChange, activeStepIndex, handleNavigation, stableEnabledStepIndices, stableValidatedStepIndices, stableCommittableStepIndices, invalidMessageMap, handleCloseRequest, handleRequestCommit, dialogDirty, dialogPosition, handlePositionChangeWithPersist, dialogSize, handleSizeChangeWithPersist, displayMode, HeaderComponent, ContentComponent, FooterComponent, transitionDisplayMode, persistDialogWindow],
  );

  return {
    headlessProps,
    stepDescriptors,
    loading,
    error,
    icon: icon ?? undefined,
    presentation,
    hasUnsavedChanges: dialogDirty,
    dialogState: dialogStateSnapshot,
    updateDialogState,
    conflictDialog: conflictDialogNode,
    unsavedChangeDialog: {
      open: discardDialogOpen,
      onDiscard: handleConfirmDiscard,
      onCancel: handleDismissDiscardDialog,
      title: t('dialogs.pluginDraft.discard.title', 'Discard changes?'),
      message: t(
        'dialogs.pluginDraft.discard.description',
        'Your changes will be lost. Do you want to discard them?'
      ),
    },
  };
}

export { BASIC_INFO_META_KEY, buildStepWorkingData } from './controller/step-guards.js';
