/**
 * usePluginDialogController – headless orchestrator for plugin dialogs.
 * Dialog UI state is persisted on TreeNode.dialogUIState via TreeNodeUpdaterAPI.
 */
import type { WorkerAPI } from '@hierarchidb/common-api';
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
import { getIconComponent, getPresentation, hydratePresentationDefinitionsFromGlobal } from '@hierarchidb/plugin-presentation';
import { useTreeNodeUpdater, type TreeNodeUpdaterState } from '@hierarchidb/plugin-ui-sdk';
import { getWorkerClientHook, type WorkerClientRef } from '@hierarchidb/ui-worker-provider';
import type {
  HeadlessDialogProps,
  StepComponentDescriptor,
  StepNavigationEvent,
} from '@hierarchidb/ui-dialog';
import { MultiStepDialogContent } from '@hierarchidb/ui-dialog';
import {
  Box,
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Typography,
} from '@mui/material';
import type { Theme } from '@mui/material/styles';
import { useNavigate } from '@tanstack/react-router';
import type { Remote } from 'comlink';
import type React from 'react';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { PluginDialogFooter, PluginDialogHeader } from './components/index.js';
import type { PluginDialogFooterPrimaryButtonOptions } from './components/PluginDialogFooter.js';
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
}

const PlaceholderStep: React.FC = () => null;

const formatTimestamp = (timestamp?: number): string => {
  if (!timestamp) return '';
  const date = new Date(timestamp);
  const pad = (v: number) => `${v}`.padStart(2, '0');
  return `${date.getFullYear()}/${pad(date.getMonth() + 1)}/${pad(date.getDate())} ${pad(date.getHours())}:${pad(date.getMinutes())}:${pad(date.getSeconds())}`;
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
    initialStep = 0,
    onClose,
    onSuccess,
    footerOptions,
  } = options;

  const { t } = useTranslation('common');
  const navigate = useNavigate();
  const stepRegistry = PluginStepRegistry.getInstance();
  const hostRegistry = HostProfileRegistry.getInstance();

  const useClientHook = getWorkerClientHook<WorkerClientRef | null>() ?? (() => null);
  const ref = useClientHook();
  const client: Remote<WorkerAPI> | null = useMemo(() => ref?.client ?? null, [ref]);

  const initialDraftData = useMemo(() => {
    if (mode === 'create' && nodeType === 'basemap') {
      return {
        mapStyle: { style: 'streets' },
        viewport: undefined,
      } as TreeNodeData;
    }
    return undefined;
  }, [mode, nodeType]);

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
    mode,
    nodeType,
    nodeId,
    parentId: pageNodeId,
    treeId,
    workerClient: ref ?? null,
    initialDraftData,
  });

  useAutosave({ open, draft, hasUnsavedChanges, saveDraft });

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
    mode,
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
    return composeStepConfigs(nodeType, mode);
  }, [nodeType, mode, regTick, hostTick]);

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
    mode,
    nodeId,
    pageNodeId,
    draftData: localDraftData,
    setDraftData: setLocalDraftData,
    handleBasicInfoBridge,
    dialogRef,
    basicInfoLabel: t('common.basicInfo.title', 'Basic Information'),
  });

  const presentation = useMemo(() => getPresentation(nodeType), [nodeType]);
  const icon = useMemo(() => getIconComponent(nodeType), [nodeType]);
  const isFolder = nodeType === 'folder';

  const dialogTitle = useMemo(() => {
    const label = presentation?.label || nodeType;
    return mode === 'create'
      ? t('dialogs.pluginDialog.titles.create', { plugin: label, defaultValue: 'Create {{plugin}}' })
      : t('dialogs.pluginDialog.titles.edit', { plugin: label, defaultValue: 'Edit {{plugin}}' });
  }, [mode, nodeType, presentation?.label, t]);

  const headerSubtitle = useMemo(() => {
    if (isFolder) return undefined;
    if (mode === 'edit') {
      const desc = presentation?.description?.trim();
      if (desc) {
        return desc;
      }
    }
    return undefined;
  }, [isFolder, mode, presentation?.description]);

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
    mode,
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
  const enabledStepsRef = useRef(enabledStepIndices);
  enabledStepsRef.current = enabledStepIndices;
  const validatedStepsRef = useRef(validatedStepIndices);
  validatedStepsRef.current = validatedStepIndices;
  const stepsLengthRef = useRef(steps.length);
  stepsLengthRef.current = steps.length;
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
        await Promise.resolve(updateLocalDraftRef.current?.()).finally(() => {
          setActiveStepIndexRef.current(nextIndex);
          setUrlStepRef.current(nextIndex);
          updateDialogUIState({
            dialogProgress: { activeStepIndex: nextIndex } as DialogProgressState,
          });
        });
      });
    },
    [runWithPending, updateDialogUIState]
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
  }, [basicInfo.description, basicInfo.name, basicInfo.tags, commitTreeNodeUpdater, dialogData, ensureNoConflict, getPersistableDialogUIState, navigateToNode, nodeId, pageNodeId, nodeType, onClose, runWithPending, treeUpdater?.draftMetadata, updateLocalDraft]);

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
          mode,
          dialogData,
        })
      );
    } catch (err) {
      console.error('[PluginDialogShell] start batch failed', err);
    } finally {
      setIsStartingBatch(false);
    }
  }, [activeStartBatch, dialogData, mode, nodeId, pageNodeId, treeId]);

  const HeaderComponent: HeadlessDialogProps<Partial<PluginDefinedEntity>>['HeaderComponent'] = useCallback(
    () => (
      <PluginDialogHeader
        title={dialogTitle}
        subtitle={headerSubtitle}
        icon={icon || undefined}
        pendingAction={pendingAction}
      />
    ),
    [dialogTitle, headerSubtitle, icon, pendingAction]
  );

  const ContentComponent: HeadlessDialogProps<Partial<PluginDefinedEntity>>['ContentComponent'] = useCallback(
    () => (
      <Box
        sx={(theme) => ({
          flex: 1,
          overflow: 'auto',
          padding: theme.spacing(2),
        })}
        ref={dialogRef}
      >
        <MultiStepDialogContent />
      </Box>
    ),
    [dialogRef]
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

  const FooterComponent: HeadlessDialogProps<Partial<PluginDefinedEntity>>['FooterComponent'] =
    useCallback(
      () => (
        <>
          <Dialog
            open={conflictDialog.open}
            onClose={() => {
              resolveConflict('continue');
            }}
            sx={{
              ...foregroundDialogSx,
              zIndex: (theme) => (theme.zIndex?.modal ?? 1300) + 1001,
            }}
            slotProps={{
              backdrop: {
                sx: {
                  backgroundColor: 'rgba(9, 12, 28, 0.45)',
                  zIndex: (theme) => (theme.zIndex?.modal ?? 1300) + 1000,
                },
              },
              paper: {
                sx: { zIndex: (theme) => (theme.zIndex?.modal ?? 1300) + 1002 },
              },
            }}
          >
            <DialogTitle>{t('dialogs.pluginDraft.conflict.title')}</DialogTitle>
            <DialogContent>
              <Typography variant="body2">
                {t('dialogs.pluginDraft.conflict.description', {
                  timestamp: formatTimestamp(conflictDialog.updatedAt),
                })}
              </Typography>
            </DialogContent>
            <DialogActions>
              <Button
                color="secondary"
                onClick={() => {
                  resolveConflict('discard');
                }}
              >
                {t('dialogs.pluginDraft.conflict.buttons.discardSelf')}
              </Button>
              <Button
                variant="contained"
                onClick={() => {
                  resolveConflict('continue');
                }}
              >
                {t('dialogs.pluginDraft.conflict.buttons.keepSelf')}
              </Button>
            </DialogActions>
          </Dialog>

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
            disableDraft={disableDraftButton || !dialogDirty}
            onStartBatch={activeStartBatch ? () => { handleStartBatch().catch(() => void 0); } : undefined}
            canStartBatch={canStartBatch && !isStartingBatch}
            isStartingBatch={isStartingBatch}
            primaryButtonOptions={footerPrimaryButtons}
            saveDraftLabel={footerSaveDraftLabel}
            pendingAction={pendingAction}
          />
        </>
      ),
      [conflictDialog.open, conflictDialog.updatedAt, foregroundDialogSx, t, mode, canSaveCurrent, disableDraftButton, handleSaveDraft, dialogDirty, activeStartBatch, canStartBatch, isStartingBatch, footerPrimaryButtons, footerSaveDraftLabel, pendingAction, resolveConflict, handleStartBatch]
    );

  const handleCloseRequest = useCallback(() => {
    if (dialogDirty) {
      setDiscardDialogOpen(true);
      return;
    }
    void runWithPending({ type: 'cancel' }, async () => {
      if (mode === 'create') {
        await discardDraft({ forceDelete: true });
      }
      onClose();
    });
  }, [dialogDirty, discardDraft, mode, onClose, runWithPending]);

  const handleConfirmDiscard = useCallback(() => {
    setDiscardDialogOpen(false);
    void runWithPending({ type: 'cancel' }, async () => {
      if (mode === 'create') {
        await discardDraft({ forceDelete: true });
      }
      onClose();
    });
  }, [discardDraft, mode, onClose, runWithPending]);

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

  const headlessProps: HeadlessDialogProps<Partial<PluginDefinedEntity>> = {
    open: open && isDialogReady,
    stepComponents: safeStepDescriptors,
    stepData: currentStepData,
    onStepDataChange: handleStepDataChange,
    activeStepIndex,
    onStepNavigate: handleNavigation,
    enabledStepIndices,
    validatedStepIndices,
    committableStepIndices,
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
  };

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
