/**
 * usePluginDialogController – headless orchestrator for plugin dialogs.
 * Dialog UI atoms is persisted on TreeNode.dialogUIState via TreeNodeUpdaterAPI.
 */
import type { WorkerAPI } from '@hierarchidb/worker-api';
import type { NodeId, PeerEntity, TreeId } from '@hierarchidb/core-types';
import type {
  DialogDisplayMode,
  DialogPosition,
  DialogSize,
  DialogState,
  DialogUIState,
  DialogWindowState,
  TreeNodeData,
} from '@hierarchidb/tree-api';
import {
  composeStepConfigs,
  HostProfileRegistry,
  PluginStepRegistry,
} from '@hierarchidb/plugin-base';
import {
  getPresentation,
  hydratePresentationDefinitionsFromGlobal,
} from '@hierarchidb/plugin-presentation';
import { type TreeNodeUpdaterState, useTreeNodeUpdater } from '@hierarchidb/plugin-ui-sdk';
import type {
  HeadlessDialogProps,
  StepComponentDescriptor,
} from '@hierarchidb/ui-dialog';
import { useIconRegistry } from '@hierarchidb/ui-icon';
import { getWorkerClientHook, type WorkerClientRef } from '@hierarchidb/ui-worker-provider';
import { loadTreeConsoleSettings, TREE_CONSOLE_SETTINGS_STORAGE_KEY } from '@hierarchidb/util';
import type { Theme } from '@mui/material/styles';
import { useNavigate } from '@tanstack/react-router';
import type { Remote } from 'comlink';
import type React from 'react';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  createContentComponent,
  createFooterComponent,
  createHeaderComponent,
} from './components/DialogScaffold.js';
import type {
  PluginDialogFooterPrimaryButtonOptions,
  PluginDialogFooterProps,
} from './components/PluginDialogFooter.js';
import type { PluginDialogConflictDialogProps } from './PluginDialogControllerElements.js';
import { createPluginDialogContentComponent } from './PluginDialogControllerElements.js';
import { toRecord } from './controller/step-guards.js';
import { useAutosave } from './usePluginDialogController/autosave.js';
import { useBasicInfoState } from './usePluginDialogController/basic-info.js';
import { useStepCapabilities } from './usePluginDialogController/capabilities.js';
import { useConflictGuard } from './usePluginDialogController/conflict-guard.js';
import type {
  TreeNodeUpdaterPatch,
  TreeNodeUpdaterPayload,
} from './usePluginDialogController/data-types.js';
import { useDialogUIStateSync } from './usePluginDialogController/dialog-ui-state.js';
import { useDialogDirtyState } from './usePluginDialogController/dirty-state.js';
import { useDialogFrameState } from './usePluginDialogController/frame-state.js';
import { usePendingAction } from './usePluginDialogController/pending-action.js';
import { useDialogSteps } from './usePluginDialogController/steps.js';
import { useStepNavigation } from './usePluginDialogController/step-navigation.js';

const SYNC_DEBUG_STORAGE_KEY = 'hdb:dialog-sync-debug';
const WINDOW_STATE_PERSIST_DEBOUNCE_MS = 250;

function isSyncDebugActive(): boolean {
  if (typeof window === 'undefined') return false;
  return window.localStorage.getItem(SYNC_DEBUG_STORAGE_KEY) === '1';
}

function buildDraftSignature(value: unknown): string | null {
  if (value == null) return null;
  try {
    return JSON.stringify(value);
  } catch (error) {
    return `[unserializable:${String(error)}]`;
  }
}

function logSync(label: string, payload: { draftData?: string | null; dialogUIState?: string | null }): void {
  if (!isSyncDebugActive()) return;
  console.debug(`[PluginDialogSync] ${label}`, payload);
}

type WorkerApi = WorkerAPI<TreeNodeData>;

export interface PluginDialogControllerOptions {
  mode: 'create' | 'edit' | 'preview';
  nodeType: string;
  nodeId: NodeId;
  pageNodeId: NodeId;
  treeId: TreeId;
  open: boolean;
  initialStep?: number;
  forceInitialStep?: boolean;
  urlState?: { mode?: DialogDisplayMode; step?: number };
  onUrlStateChange?: (next: { mode: DialogDisplayMode; step: number }) => void;
  onClose: () => void;
  onSuccess?: (nodeId: NodeId) => void;
  footerOptions?: PluginDialogFooterOptions;
  autosaveEnabled?: boolean;
  removePaddingWithFullScreenMode?: boolean;
  autoBuild?: {
    enabled?: boolean;
    onComplete?: () => void;
  };
}

export interface PluginDialogFooterOptions {
  primaryButtons?: PluginDialogFooterPrimaryButtonOptions;
  saveDraftLabel?: string;
}

type PluginDefinedEntity = PeerEntity<TreeNodeData>;
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
  conflictDialog?: PluginDialogConflictDialogProps;
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

const reuseNumberArray = (
  prevRef: React.MutableRefObject<ReadonlyArray<number>>,
  next: ReadonlyArray<number>
) => {
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
    urlState,
    onUrlStateChange,
    onClose,
    onSuccess,
    footerOptions,
    autosaveEnabled: autosaveEnabledProp,
    autoBuild,
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
  const client: Remote<WorkerApi> | null = useMemo(() => ref?.client ?? null, [ref]);
  const autosaveEnabled = useAutosavePreference(autosaveEnabledProp);

  const initialDraftData = useMemo(() => {
    if (stepMode === 'create' && nodeType === 'basemap') {
      return {
        mapStyle: { style: 'streets' },
        viewport: undefined,
      } as Partial<PluginDefinedEntity>;
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
  } = useTreeNodeUpdater<PluginDefinedEntity>({
    mode: stepMode,
    nodeType,
    nodeId,
    parentId: pageNodeId,
    treeId,
    workerClient: ref ?? null,
    initialDraftData,
  });

  const [autosaveReady, setAutosaveReady] = useState(false);
  const autosaveDirtyRef = useRef(false);

  const treeUpdater: TreeNodeUpdaterPayload<PluginDefinedEntity> | null = useMemo(
    () =>
      draft
        ? {
            treeNodeId: draft.treeNodeId,
            draftMetadata: draft.draftMetadata ?? null,
            draftData: draft.draftData,
          }
        : null,
    [draft]
  );
  const isTemporary = Boolean(draft?.isTemporary);

  const dialogUIState = (draft as LocalTreeNodeUpdaterState | null)?.dialogUIState ?? null;
  const isDialogReady = Boolean(dialogUIState);
  const allowFullScreen = true;

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
    allowFullScreen,
    urlState,
    onUrlStateChange,
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
    allowFullScreen,
    forceInitialStep,
    urlStep: urlState?.step ?? null,
    restoreKey: (treeUpdater?.treeNodeId ?? nodeId) as string | number | null,
    restoreDeps: {
      setActiveStepIndex,
      setUrlStep,
      handleSizeChange,
      handlePositionChange,
      transitionDisplayMode,
    },
  });

  const buildDialogUIStateForCommit = useCallback(
    (forcedActiveStepIndex?: number): DialogUIState => {
      const base = getPersistableDialogUIState() ?? dialogUIStateRef.current ?? {};
      if (typeof forcedActiveStepIndex !== 'number' || Number.isNaN(forcedActiveStepIndex)) {
        return base;
      }
      return {
        ...base,
        dialogProgress: {
          activeStepIndex: toPersistedStepIndex(forcedActiveStepIndex),
        },
      };
    },
    [getPersistableDialogUIState, dialogUIStateRef, toPersistedStepIndex]
  );

  const buildDialogUIStateForPersist = useCallback((): DialogUIState => {
    const base = getPersistableDialogUIState() ?? dialogUIStateRef.current ?? {};
    const existingProgress = dialogUIStateRef.current?.dialogProgress?.activeStepIndex;
    if (typeof existingProgress !== 'number' || Number.isNaN(existingProgress)) {
      return {
        ...base,
        dialogProgress: null,
      };
    }
    return base;
  }, [getPersistableDialogUIState, dialogUIStateRef]);

  const draftDataWithoutMeta = useMemo<Partial<PluginDefinedEntity>>(
    () => (toRecord(draft?.draftData) as Partial<PluginDefinedEntity>) ?? {},
    [draft?.draftData]
  );

  const [localDraftData, setLocalDraftDataState] = useState<Partial<PluginDefinedEntity>>(
    () => draftDataWithoutMeta
  );
  const localDraftDataRef = useRef<Partial<PluginDefinedEntity>>(draftDataWithoutMeta);
  const displayModeTransitionRef = useRef(false);
  const setLocalDraftData = useCallback(
    (source: string, next: React.SetStateAction<Partial<PluginDefinedEntity>>) => {
      if (!source) throw new Error('setLocalDraftData: source is required.');
      setLocalDraftDataState((prev: Partial<PluginDefinedEntity>) => {
        const resolved =
          typeof next === 'function'
            ? (next as (prevState: Partial<PluginDefinedEntity>) => Partial<PluginDefinedEntity>)(
                prev
              )
            : next;
        localDraftDataRef.current = resolved ?? {};
        return resolved ?? {};
      });
    },
    []
  );
  useEffect(() => {
    setLocalDraftData('draftDataSync', draftDataWithoutMeta);
  }, [draftDataWithoutMeta, setLocalDraftData]);

  const applyUpdateDraft = useCallback(
    (patch: TreeNodeUpdaterPatch<PluginDefinedEntity>) => {
      const payload: Partial<LocalTreeNodeUpdaterState> = {
        treeNodeId: (treeUpdater?.treeNodeId ?? nodeId) as NodeId,
      };
      if (patch.draftMetadata !== undefined)
        payload.draftMetadata = patch.draftMetadata ?? undefined;
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
      setLocalDraftData('basicInfoBridge', (prev: Partial<PluginDefinedEntity>) => ({
        ...(toRecord(prev) ?? {}),
        ...patch.draftData,
      }));
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
  useEffect(() => {
    if (!open) {
      autosaveDirtyRef.current = false;
      setAutosaveReady(false);
      return;
    }
    const wasDirty = autosaveDirtyRef.current;
    autosaveDirtyRef.current = dialogDirty;
    if (!wasDirty && dialogDirty) {
      setAutosaveReady(true);
    }
  }, [dialogDirty, open]);

  useAutosave({
    open,
    draft,
    hasUnsavedChanges,
    saveDraft,
    enabled: autosaveEnabled && autosaveReady,
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

  const handleTagNavigate = useCallback(
    (tag: string) => {
      const trimmed = tag.trim();
      if (!trimmed) return;
      void navigate({
        to: `/t/${treeId}/${pageNodeId}/tags/${encodeURIComponent(trimmed)}` as const,
      });
    },
    [navigate, pageNodeId, treeId]
  );

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
    setDraftData: (next) => setLocalDraftData('stepAdapter', next),
    handleBasicInfoBridge,
    dialogRef,
    basicInfoLabel: t('common.basicInfo.title', 'Basic Information'),
    onTagClick: handleTagNavigate,
  });

  // Keep stepData stable across draft updates; refresh only on step change.
  const stepDataRef = useRef<Partial<PluginDefinedEntity>>(currentStepData);
  useEffect(() => {
    stepDataRef.current = currentStepData;
  }, [ currentStepData]);
  const stableStepData = stepDataRef.current;

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
  const autoBuildEnabled = Boolean(autoBuild?.enabled);

  const isAutoBuildComplete = useCallback((data: Partial<PluginDefinedEntity>): boolean => {
    const record = data as Record<string, unknown>;
    const processingStatus = record.processingStatus;
    const buildFinishedAt = record.buildFinishedAt;
    if (typeof processingStatus === 'string' && processingStatus === 'completed') {
      return true;
    }
    if (typeof buildFinishedAt === 'number' && Number.isFinite(buildFinishedAt)) {
      return true;
    }
    const spreadsheetMetadataId = record.spreadsheetMetadataId;
    if (typeof spreadsheetMetadataId === 'string' && spreadsheetMetadataId.trim().length > 0) {
      return true;
    }
    const dataSource = record.dataSource as { sizeBytes?: unknown } | undefined;
    if (typeof dataSource?.sizeBytes === 'number' && dataSource.sizeBytes > 0) {
      return true;
    }
    return false;
  }, []);

  const dialogTitle = useMemo(() => {
    const label = presentation?.label || nodeType;
    return dialogMode === 'create'
      ? t('dialogs.pluginDialog.titles.create', {
          plugin: label,
          defaultValue: 'Create {{plugin}}',
        })
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
    [enabledStepIndices]
  );
  const stableValidatedStepIndices = useMemo(
    () => reuseNumberArray(stableValidatedStepsRef, validatedStepIndices),
    [validatedStepIndices]
  );
  const stableCommittableStepIndices = useMemo(
    () => reuseNumberArray(stableCommittableStepsRef, committableStepIndices),
    [committableStepIndices]
  );

  const safeStepDescriptors: ReadonlyArray<StepComponentDescriptor<Partial<PluginDefinedEntity>>> =
    useMemo(
      () =>
        stepDescriptors.length
          ? stepDescriptors
          : [{ id: 'placeholder', label: 'placeholder', component: PlaceholderStep }],
      [stepDescriptors]
    );

  const { conflictDialog, resolveConflict, ensureNoConflict } = useConflictGuard({
    mode: stepMode,
    client,
    nodeId,
    draftVersion: draft?.version,
    discardDraft,
    onClose,
    updateTreeNodeUpdater,
    getLocalDraftSnapshot: () => ({
      draftMetadata: treeUpdater?.draftMetadata ?? null,
      draftData: treeUpdater?.draftData,
    }),
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
      draftData: nodeType === 'folder' ? undefined : { ...(localDraftDataRef.current ?? {}) },
      dialogUIState: getPersistableDialogUIState(),
    };
    if (isSyncDebugActive()) {
      logSync('updateTreeNodeUpdater:updateLocalDraft', {
        draftData: buildDraftSignature(nextPatch.draftData),
        dialogUIState: buildDraftSignature(nextPatch.dialogUIState),
      });
    }
    updateTreeNodeUpdater(nextPatch);
  }, [
    basicInfo.description,
    basicInfo.name,
    basicInfo.tags,
    getPersistableDialogUIState,
    nodeId,
    treeUpdater,
    updateTreeNodeUpdater,
    nodeType,
  ]);

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



  const handleSubmitRef = useRef<(() => Promise<void>) | null>(null);

  const { handleNavigation } = useStepNavigation({
    activeStepIndex,
    stepsLength: steps.length,
    setActiveStepIndex,
    setUrlStep,
    toPersistedStepIndex,
    runWithPending,
    updateLocalDraft,
    updateDialogUIState,
    getPersistableDialogUIState,
    commitTreeNodeUpdater: commitTreeNodeUpdater ?? undefined,
    nodeId,
    nodeType,
    treeUpdaterTreeNodeId: treeUpdater?.treeNodeId,
    treeUpdaterDraftMetadata: treeUpdater?.draftMetadata ?? null,
    localDraftDataRef,
  });

  const navigateToNode = useCallback(
    (targetId: NodeId) => {
      void navigate({ to: `/t/${treeId}/${pageNodeId}/${targetId}` as const });
    },
    [navigate, treeId, pageNodeId]
  );

  const dialogWindowPersistTimerRef = useRef<number | null>(null);
  const persistDialogUIStateDraft = useCallback(async () => {
    if (dialogMode === 'create' || dialogMode === 'preview') return;
    const treeNodeId = (treeUpdater?.treeNodeId ?? nodeId) as NodeId | undefined;
    if (!treeNodeId) return;
    try {
      const payload: TreeNodeUpdaterState<PluginDefinedEntity> = {
        treeNodeId,
        draftMetadata: treeUpdater?.draftMetadata ?? null,
        draftData: nodeType === 'folder' ? undefined : treeUpdater?.draftData,
        dialogUIState: buildDialogUIStateForPersist(),
      };
      await commitTreeNodeUpdater('save-draft', payload);
    } catch (error) {
      console.warn('[PluginDialogShell] failed to persist dialog UI state', error);
    }
  }, [
    commitTreeNodeUpdater,
    dialogMode,
    buildDialogUIStateForPersist,
    nodeId,
    nodeType,
    treeUpdater?.draftData,
    treeUpdater?.draftMetadata,
    treeUpdater?.treeNodeId,
  ]);

  const schedulePersistDialogUIStateDraft = useCallback(() => {
    if (dialogMode === 'create' || dialogMode === 'preview') return;
    if (typeof window === 'undefined') return;
    if (dialogWindowPersistTimerRef.current !== null) {
      window.clearTimeout(dialogWindowPersistTimerRef.current);
    }
    dialogWindowPersistTimerRef.current = window.setTimeout(() => {
      dialogWindowPersistTimerRef.current = null;
      void persistDialogUIStateDraft();
    }, WINDOW_STATE_PERSIST_DEBOUNCE_MS);
  }, [dialogMode, persistDialogUIStateDraft]);

  useEffect(() => {
    return () => {
      if (typeof window === 'undefined') return;
      if (dialogWindowPersistTimerRef.current === null) return;
      window.clearTimeout(dialogWindowPersistTimerRef.current);
      dialogWindowPersistTimerRef.current = null;
    };
  }, []);

  const persistDialogWindow = useCallback(
    (patch: Partial<DialogWindowState>) => {
      const prevWindow = dialogUIStateRef.current?.dialogWindow ?? null;
      const next: DialogWindowState = {
        mode: patch.mode ?? prevWindow?.mode ?? displayMode,
        position: patch.position ?? prevWindow?.position ?? dialogPosition,
        size: patch.size ?? prevWindow?.size ?? dialogSize,
        restorePosition: patch.restorePosition ?? prevWindow?.restorePosition ?? null,
        restoreSize: patch.restoreSize ?? prevWindow?.restoreSize ?? null,
      };
      updateDialogUIState({ dialogWindow: next });
      schedulePersistDialogUIStateDraft();
    },
    [
      dialogPosition,
      dialogSize,
      dialogUIStateRef,
      displayMode,
      updateDialogUIState,
      schedulePersistDialogUIStateDraft,
    ]
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
  const handleSubmit = useCallback(async () => {
    await runWithPending({ type: 'commit' }, async () => {
      const ok = await ensureNoConflict();
      if (!ok) return;
      await updateLocalDraft();
      const normalizedData =
        nodeType === 'folder'
          ? null
          : dialogData && Object.keys(dialogData).length > 0
            ? (dialogData as Partial<PluginDefinedEntity>)
            : null;

      const savePayload: TreeNodeUpdaterState<PluginDefinedEntity> = {
        treeNodeId: (treeUpdater?.treeNodeId ?? nodeId) as NodeId,
        draftMetadata: {
          name: basicInfo.name,
          description: basicInfo.description,
          tags: basicInfo.tags,
        },
        draftData: nodeType === 'folder' ? undefined : normalizedData ?? undefined,
        dialogUIState: buildDialogUIStateForCommit(activeStepIndex),
      };
      const savedNodeId = await commitTreeNodeUpdater('save', savePayload);
      const targetId = (savedNodeId ?? treeUpdater?.treeNodeId ?? nodeId) as NodeId;
      onSuccess?.(targetId);
      navigateToNode(targetId);
      onClose();
    });
  }, [
    basicInfo.description,
    basicInfo.name,
    basicInfo.tags,
    activeStepIndex,
    buildDialogUIStateForCommit,
    commitTreeNodeUpdater,
    dialogData,
    ensureNoConflict,
    navigateToNode,
    nodeType,
    onClose,
    onSuccess,
    runWithPending,
    treeUpdater?.treeNodeId,
    updateLocalDraft,
    nodeId,
  ]);

  useEffect(() => {
    handleSubmitRef.current = handleSubmit;
  }, [handleSubmit]);

  const handleSaveDraft = useCallback(async () => {
    await runWithPending({ type: 'save-draft' }, async () => {
      const ok = await ensureNoConflict();
      if (!ok) return;
      await updateLocalDraft();
      const draftPayload: TreeNodeUpdaterState<PluginDefinedEntity> = {
        treeNodeId: (treeUpdater?.treeNodeId ?? nodeId) as NodeId,
        draftData: nodeType === 'folder' ? undefined : (dialogData as Partial<PluginDefinedEntity>),
        draftMetadata: {
          ...(treeUpdater?.draftMetadata ?? {}),
          name: basicInfo.name,
          description: basicInfo.description,
          tags: basicInfo.tags,
        },
        dialogUIState: buildDialogUIStateForCommit(activeStepIndex),
      };
      await commitTreeNodeUpdater('save-draft', draftPayload);
      const targetId = (pageNodeId ?? nodeId) as NodeId;
      navigateToNode(targetId);
      onClose();
    });
  }, [
    runWithPending,
    ensureNoConflict,
    updateLocalDraft,
    treeUpdater?.treeNodeId,
    treeUpdater?.draftMetadata,
    activeStepIndex,
    buildDialogUIStateForCommit,
    nodeId,
    nodeType,
    dialogData,
    basicInfo.name,
    basicInfo.description,
    basicInfo.tags,
    commitTreeNodeUpdater,
    pageNodeId,
    navigateToNode,
    onClose,
  ]);
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

  const autoBuildStartedRef = useRef(false);
  const autoBuildCompleteRef = useRef(false);
  useEffect(() => {
    autoBuildStartedRef.current = false;
    autoBuildCompleteRef.current = false;
  }, []);
  useEffect(() => {
    if (!autoBuildEnabled || !open) return;
    if (!activeStartBatch || !canStartBatch) return;
    if (autoBuildStartedRef.current) return;
    autoBuildStartedRef.current = true;
    handleStartBatch().catch(() => void 0);
  }, [autoBuildEnabled, open, activeStartBatch, canStartBatch, handleStartBatch]);

  const HeaderComponent = useMemo<
    HeadlessDialogProps<Partial<PluginDefinedEntity>>['HeaderComponent']
  >(
    () => createHeaderComponent(dialogTitle, headerSubtitle, icon, pendingAction),
    [dialogTitle, headerSubtitle, icon, pendingAction]
  );

  const ContentComponent = useMemo<
    HeadlessDialogProps<Partial<PluginDefinedEntity>>['ContentComponent']
  >(() => {
    const Content = createContentComponent(dialogRef);
    return createPluginDialogContentComponent<Partial<PluginDefinedEntity>>(Content);
  }, [dialogRef]);

  const foregroundDialogSx = useMemo(
    () => ({
      zIndex: (theme: Theme) => theme.zIndex.modal + 2,
      '& .MuiBackdrop-root': {
        zIndex: (theme: Theme) => theme.zIndex.modal + 1,
      },
    }),
    []
  );

  const conflictDialogProps = useMemo<PluginDialogConflictDialogProps>(
    () => ({
      open: conflictDialog.open,
      updatedAt: conflictDialog.updatedAt ?? null,
      foregroundSx: foregroundDialogSx,
      resolveConflict,
      formatTimestamp,
      translate: t,
    }),
    [conflictDialog.open, conflictDialog.updatedAt, foregroundDialogSx, resolveConflict, t]
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
  const FooterComponent = useMemo<
    HeadlessDialogProps<Partial<PluginDefinedEntity>>['FooterComponent']
  >(() => createFooterComponent(footerPropsRef), []);

  useEffect(() => {
    if (!autoBuildEnabled || !open) return;
    if (autoBuildCompleteRef.current) return;
    const requiresStartBatch = Boolean(activeStartBatch);
    if (requiresStartBatch && !autoBuildStartedRef.current) return;
    if (!isAutoBuildComplete(dialogData)) return;
    autoBuildCompleteRef.current = true;
    autoBuild?.onComplete?.();
  }, [activeStartBatch, autoBuild, autoBuildEnabled, dialogData, isAutoBuildComplete, open]);

  const persistDialogUIState = useCallback(async () => {
    if (typeof window !== 'undefined' && dialogWindowPersistTimerRef.current !== null) {
      window.clearTimeout(dialogWindowPersistTimerRef.current);
      dialogWindowPersistTimerRef.current = null;
    }
    await persistDialogUIStateDraft();
  }, [persistDialogUIStateDraft]);

  const persistDialogUIStateOnClose = useCallback(async () => {
    await persistDialogUIState();
  }, [persistDialogUIState]);

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
    const close = onCloseRef.current;
    const discard = discardDraftRef.current;
    void runWithPending({ type: 'cancel' }, async () => {
      if (dialogMode === 'create') {
        if (isTemporary) {
          await discard?.({ forceDelete: true });
        }
      } else if (dialogMode !== 'preview') {
        await persistDialogUIStateOnClose();
      }
      close?.();
    });
  }, [dialogMode, isTemporary, persistDialogUIStateOnClose, runWithPending]);

  const handleDismissDiscardDialog = useCallback(() => {
    setDiscardDialogOpen(false);
  }, []);

  const handleStepDataChange = useCallback(
    (patch: Partial<Partial<PluginDefinedEntity>>) => {
      if (nodeType === 'folder') {
        setLocalDraftData('stepDataChange', {});
        return;
      }
      setLocalDraftData('stepDataChange', (prev: Partial<PluginDefinedEntity>) => ({
        ...(toRecord(prev) ?? {}),
        ...patch,
      }));
    },
    [nodeType, setLocalDraftData]
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
      allowFullScreen,
      removePaddingWithFullScreenMode: Boolean(options.removePaddingWithFullScreenMode),
      onDisplayModeChange: (mode: DialogDisplayMode) => {
        if (mode === 'full-screen' && !allowFullScreen) {
          if (typeof console !== 'undefined' && typeof console.warn === 'function') {
            console.warn('[PluginDialogShell] full-screen disabled for node type', {
              nodeType,
            });
          }
          return;
        }
        if (mode === displayMode) {
          return;
        }
        if (displayModeTransitionRef.current) {
          if (typeof console !== 'undefined' && typeof console.warn === 'function') {
            console.warn('[PluginDialogShell] displayMode change skipped (transition in flight)', {
              current: displayMode,
              requested: mode,
            });
          }
          return;
        }
        displayModeTransitionRef.current = true;
        const currentWindow = dialogUIStateRef.current?.dialogWindow ?? null;
        const shouldCaptureRestore =
          displayMode === 'normal' && (mode === 'maximize' || mode === 'full-screen');
        const restorePosition = shouldCaptureRestore
          ? dialogPosition
          : (currentWindow?.restorePosition ?? null);
        const restoreSize = shouldCaptureRestore
          ? dialogSize
          : (currentWindow?.restoreSize ?? null);
        void transitionDisplayMode(mode, { restorePosition, restoreSize, source: 'explicit' })
          .then(() => {
            persistDialogWindow({ mode, restorePosition, restoreSize });
          })
          .finally(() => {
            displayModeTransitionRef.current = false;
          });
      },
      HeaderComponent,
      ContentComponent,
      FooterComponent,
    }),
    [open, isDialogReady, safeStepDescriptors, stableStepData, handleStepDataChange, activeStepIndex, handleNavigation, stableEnabledStepIndices, stableValidatedStepIndices, stableCommittableStepIndices, invalidMessageMap, handleCloseRequest, handleRequestCommit, dialogDirty, dialogPosition, handlePositionChangeWithPersist, dialogSize, handleSizeChangeWithPersist, displayMode, allowFullScreen, options.removePaddingWithFullScreenMode, HeaderComponent, ContentComponent, FooterComponent, transitionDisplayMode, persistDialogWindow, dialogUIStateRef, nodeType]
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
    conflictDialog: conflictDialogProps,
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
