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
import type {
  TreeNodeUpdaterPayload,
  TreeNodeUpdaterPatch,
} from './usePluginDialogController/data-types.js';

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

type PluginDefinedEntity = object;
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
      } as Record<string, unknown>;
    }
    return undefined;
  }, [mode, nodeType]);

  const {
    treeNodeUpdater: draft,
    hasUnsavedChanges,
    updateTreeNodeUpdater,
    commitTreeNodeUpdater,
    discardDraft,
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

  const acknowledgedVersionRef = useRef<number>(draft?.version ?? 0);
  useEffect(() => {
    if (draft?.version !== undefined) {
      acknowledgedVersionRef.current = draft.version;
    }
  }, [draft?.version]);

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
  const dialogUIStateRef = useRef<DialogUIState | null>(dialogUIState ?? null);
  useEffect(() => {
    dialogUIStateRef.current = dialogUIState ?? null;
  }, [dialogUIState]);

  const updateDialogUIState = useCallback(
    (patch: Partial<DialogUIState>) => {
      const prev = dialogUIStateRef.current ?? null;
      const nextWindow =
        patch.dialogWindow !== undefined ? patch.dialogWindow : (prev as any)?.dialogWindow;
      const nextProgress =
        patch.dialogProgress !== undefined ? patch.dialogProgress : (prev as any)?.dialogProgress;
      const next: DialogUIState | null =
        nextWindow || nextProgress
          ? {
              dialogWindow: nextWindow ?? null,
              dialogProgress: nextProgress ?? null,
            }
          : null;
      dialogUIStateRef.current = next;
      updateTreeNodeUpdater({ dialogUIState: next } as any);
    },
    [updateTreeNodeUpdater]
  );

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
  });

  const dialogStateRestoredRef = useRef(false);
  useEffect(() => {
    if (dialogStateRestoredRef.current) return;
    const state = dialogUIStateRef.current;
    if (!state) return;
    dialogStateRestoredRef.current = true;
    const progress = (state as any)?.dialogProgress?.activeStepIndex;
    if (typeof progress === 'number') {
      setActiveStepIndex(progress);
      setUrlStep(progress);
    }
    const windowState = (state as any)?.dialogWindow as DialogWindowState | undefined;
    if (windowState?.size) {
      handleSizeChange(windowState.size as DialogSize);
    }
    if (windowState?.position) {
      handlePositionChange(windowState.position as DialogPosition);
    }
    if (windowState?.mode) {
      void transitionDisplayMode(windowState.mode as DialogDisplayMode).catch(() => void 0);
    }
  }, [handlePositionChange, handleSizeChange, setActiveStepIndex, setUrlStep, transitionDisplayMode]);

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
  });

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

  const [conflictDialog, setConflictDialog] = useState<{
    open: boolean;
    latestVersion: number;
    updatedAt?: number;
  }>({ open: false, latestVersion: 0, updatedAt: undefined });
  const conflictResolverRef = useRef<((decision: 'discard' | 'continue') => void) | null>(null);

  const requestConflictResolution = useCallback(
    (latestVersion: number, updatedAt?: number) =>
      new Promise<'discard' | 'continue'>((resolve) => {
        conflictResolverRef.current = resolve;
        setConflictDialog({ open: true, latestVersion, updatedAt });
      }),
    []
  );

  const closeConflictDialog = useCallback(() => {
    setConflictDialog((prev) => ({ ...prev, open: false }));
  }, []);

  const fetchLatestVersion = useCallback(async () => {
    if (mode !== 'edit') return null;
    if (!client) return null;
    try {
      const query = await client.getQueryAPI();
      const latest = await query.getNode(nodeId);
      if (!latest) return null;
      return { version: latest.version ?? 0, updatedAt: latest.updatedAt };
    } catch (err) {
      console.warn('[PluginDialogShell] failed to fetch latest node for version check', err);
      return null;
    }
  }, [client, mode, nodeId]);

  const ensureNoConflict = useCallback(async (): Promise<boolean> => {
    const latest = await fetchLatestVersion();
    if (!latest) return true;
    const localVersion = acknowledgedVersionRef.current ?? draft?.version ?? 0;
    if (latest.version > localVersion) {
      const decision = await requestConflictResolution(latest.version, latest.updatedAt);
      closeConflictDialog();
      if (decision === 'discard') {
        await discardDraft();
        onClose();
        return false;
      }
      acknowledgedVersionRef.current = latest.version;
      updateTreeNodeUpdater({
        version: latest.version,
        updatedAt: latest.updatedAt,
      });
    }
    return true;
  }, [closeConflictDialog, discardDraft, draft?.version, fetchLatestVersion, onClose, requestConflictResolution, updateTreeNodeUpdater]);

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

  const canSaveCurrent = evaluatedState.guards.canSave;
  const canStartBatch = evaluatedState.guards.canStartBatch;
  const activeStartBatch = activeStepConfig?.capabilities?.startBatch;
  const footerPrimaryButtons = footerOptions?.primaryButtons;
  const footerSaveDraftLabel = footerOptions?.saveDraftLabel;
  const disableDraftButton = nodeType === 'folder';
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
      void (async () => {
        const ok = await ensureNoConflictRef.current();
        if (!ok) return;
        let nextIndex = activeStepIndexRef.current;
        switch (event.type) {
          case 'direct':
            nextIndex = Math.max(0, Math.min(event.targetIndex ?? activeStepIndexRef.current, stepsLengthRef.current - 1));
            break;
          case 'next':
            nextIndex = Math.min(activeStepIndexRef.current + 1, stepsLengthRef.current - 1);
            break;
          case 'back':
            nextIndex = Math.max(activeStepIndexRef.current - 1, 0);
            break;
        }
        if (nextIndex === activeStepIndexRef.current) return;
        void updateLocalDraftRef.current?.().finally(() => {
          setActiveStepIndexRef.current(nextIndex);
          setUrlStepRef.current(nextIndex);
          updateDialogUIState({
            dialogProgress: { activeStepIndex: nextIndex } as DialogProgressState,
          });
        });
      })();
    },
    [updateDialogUIState]
  );

  const navigateToNode = useCallback(
    (targetId: NodeId) => {
      void navigate({ to: `/t/${treeId}/${pageNodeId}/${targetId}` as const });
    },
    [navigate, treeId, pageNodeId]
  );

  const persistDialogWindow = useCallback(
    (patch: Partial<DialogWindowState>) => {
      const prevWindow = (dialogUIStateRef.current as any)?.dialogWindow ?? null;
      const next: DialogWindowState = {
        mode: patch.mode ?? prevWindow?.mode ?? displayMode,
        position: patch.position ?? prevWindow?.position ?? dialogPosition,
        size: patch.size ?? prevWindow?.size ?? dialogSize,
      };
      updateDialogUIState({ dialogWindow: next });
    },
    [dialogPosition, dialogSize, displayMode, updateDialogUIState]
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
    const ok = await ensureNoConflict();
    if (!ok) return;
    await updateLocalDraft();
    const normalizedData =
      nodeType === 'folder'
        ? null
        : dialogData && Object.keys(dialogData).length > 0
          ? (dialogData as Record<string, unknown>)
          : null;

    const savedNodeId = await commitTreeNodeUpdater({
      draftMetadata: {
        name: basicInfo.name,
        description: basicInfo.description,
        tags: basicInfo.tags,
      },
      draftData: nodeType === 'folder' ? null : (normalizedData ?? null),
      data: normalizedData === null ? undefined : normalizedData,
      metadata: undefined,
      dialogUIState: dialogUIStateRef.current ?? null,
    } as any);
    onSuccess?.(savedNodeId);
    navigateToNode(savedNodeId);
    onClose();
  }, [ensureNoConflict, updateLocalDraft, nodeType, dialogData, commitTreeNodeUpdater, basicInfo.name, basicInfo.description, basicInfo.tags, onSuccess, navigateToNode, onClose]);

  useEffect(() => {
    handleSubmitRef.current = handleSubmit;
  }, [handleSubmit]);

  const handleSaveDraft = useCallback(async () => {
    const ok = await ensureNoConflict();
    if (!ok) return;
    await updateLocalDraft();
    updateTreeNodeUpdater({
      draftData: nodeType === 'folder' ? null : (dialogData as Record<string, unknown>),
      draftMetadata: {
        ...(treeUpdater?.draftMetadata ?? {}),
        name: basicInfo.name,
        description: basicInfo.description,
        tags: basicInfo.tags,
      },
      dialogUIState: dialogUIStateRef.current ?? null,
    } as any);
  }, [ensureNoConflict, updateLocalDraft, updateTreeNodeUpdater, nodeType, dialogData, treeUpdater?.draftMetadata, basicInfo.name, basicInfo.description, basicInfo.tags]);

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
      />
    ),
    [dialogTitle, headerSubtitle, icon]
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
              conflictResolverRef.current?.('continue');
              closeConflictDialog();
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
                  conflictResolverRef.current?.('discard');
                  closeConflictDialog();
                }}
              >
                {t('dialogs.pluginDraft.conflict.buttons.discardSelf')}
              </Button>
              <Button
                variant="contained"
                onClick={() => {
                  conflictResolverRef.current?.('continue');
                  closeConflictDialog();
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
            disableDraft={disableDraftButton || !hasUnsavedChanges}
            onStartBatch={activeStartBatch ? () => { handleStartBatch().catch(() => void 0); } : undefined}
            canStartBatch={canStartBatch && !isStartingBatch}
            isStartingBatch={isStartingBatch}
            primaryButtonOptions={footerPrimaryButtons}
            saveDraftLabel={footerSaveDraftLabel}
          />
        </>
      ),
      [foregroundDialogSx, t, conflictDialog.open, conflictDialog.updatedAt, mode, canSaveCurrent, disableDraftButton, handleSaveDraft, hasUnsavedChanges, activeStartBatch, canStartBatch, isStartingBatch, footerPrimaryButtons, footerSaveDraftLabel, closeConflictDialog, handleStartBatch]
    );

  const handleCloseRequest = useCallback(() => {
    if (mode === 'create') {
      discardDraft({ forceDelete: true }).catch(() => void 0);
      onClose();
      return;
    }
    if (hasUnsavedChanges) {
      setDiscardDialogOpen(true);
      return;
    }
    onClose();
  }, [discardDraft, hasUnsavedChanges, mode, onClose]);

  const handleConfirmDiscard = useCallback(() => {
    setDiscardDialogOpen(false);
    if (mode === 'create') {
      discardDraft({ forceDelete: true }).catch(() => void 0);
    }
    onClose();
  }, [discardDraft, mode, onClose]);

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
    [setLocalDraftData, nodeType]
  );

  const handleRequestCommit = useCallback(() => {
    handleSubmitRef.current?.().catch(() => void 0);
  }, []);

  const invalidMessageMap = useMemo(() => ({}), []);

  const dialogStateSnapshot: DialogState | null = useMemo(() => {
    const windowState = (dialogUIStateRef.current as any)?.dialogWindow;
    if (!windowState) return null;
    return {
      activeStepIndex:
        (dialogUIStateRef.current as any)?.dialogProgress?.activeStepIndex ?? activeStepIndex,
      size: windowState.size ?? dialogSize,
      position: windowState.position ?? dialogPosition,
      displayMode: (windowState.mode as DialogDisplayMode | undefined) ?? displayMode,
      updatedAt: Date.now(),
    };
  }, [activeStepIndex, dialogPosition, dialogSize, displayMode]);

  const updateDialogState = useCallback(
    (patch: Partial<DialogState>) => {
      const nextWindow: DialogWindowState = {
        mode: patch.displayMode ?? (dialogUIStateRef.current as any)?.dialogWindow?.mode ?? displayMode,
        position:
          patch.position ?? (dialogUIStateRef.current as any)?.dialogWindow?.position ?? dialogPosition,
        size: patch.size ?? (dialogUIStateRef.current as any)?.dialogWindow?.size ?? dialogSize,
      };
      const nextProgress: DialogProgressState | null =
        patch.activeStepIndex !== undefined
          ? { activeStepIndex: patch.activeStepIndex }
          : (dialogUIStateRef.current as any)?.dialogProgress ?? null;
      updateDialogUIState({
        dialogWindow: nextWindow,
        dialogProgress: nextProgress,
      });
    },
    [dialogPosition, dialogSize, displayMode, updateDialogUIState]
  );

  const headlessProps: HeadlessDialogProps<Partial<PluginDefinedEntity>> = {
    open,
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
    isDirty: hasUnsavedChanges,
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
    hasUnsavedChanges,
    dialogState: dialogStateSnapshot,
    updateDialogState,
    unsavedChangeDialog: {
      open: discardDialogOpen,
      onDiscard: handleConfirmDiscard,
      onCancel: handleDismissDiscardDialog,
      title: t('dialogs.pluginDraft.discard.title'),
      message: t('dialogs.pluginDraft.discard.description'),
    },
  };
}

export { BASIC_INFO_META_KEY, buildStepWorkingData } from './controller/step-guards.js';
