/**
 * usePluginDialogController – core state machine for plugin console.
 *
 * Coordinates worker access, step composition, navigation rules, and
 * capability evaluation so the headless dialog shell can render plugin-loader with
 * consistent Next/Save guards derived from plugin-provided services.
 */

import type { WorkerAPI } from '@hierarchidb/common-api';
import type { NodeId, TreeId } from '@hierarchidb/common-types';
import {
  HostProfileRegistry,
  PluginStepRegistry,
  composeStepConfigs,
} from '@hierarchidb/plugin-base';
import {
  getIconComponent,
  getPresentation,
  hydratePresentationDefinitionsFromGlobal,
} from '@hierarchidb/plugin-presentation';
import { useTreeNodeUpdater, type TreeNodeUpdaterState } from '@hierarchidb/plugin-ui-sdk';
import { getWorkerClientHook, type WorkerClientRef } from '@hierarchidb/ui-worker-provider';
import type {
  DialogDisplayMode,
  MultiStepDialogPosition,
  MultiStepDialogSize,
  StepComponentDescriptor,
  StepNavigationEvent,
} from '@hierarchidb/ui-dialog';
import {
  MultiStepDialogContent,
  type HeadlessMultiStepDialogProps,
} from '@hierarchidb/ui-dialog';
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
import { type Remote } from 'comlink';
import type React from 'react';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { PluginDialogFooter, PluginDialogHeader } from './components/index.js';
import type { PluginDialogFooterPrimaryButtonOptions } from './components/PluginDialogFooter.js';
import { clampIndex } from './controller/dialog-layout.js';
import { toRecord } from './controller/step-guards.js';
import { useDialogStateBridge } from './usePluginDialogController/dialog-state-bridge.js';
import { useDialogFrameState } from './usePluginDialogController/frame-state.js';
import { useBasicInfoState } from './usePluginDialogController/basic-info.js';
import { useDialogSteps } from './usePluginDialogController/steps.js';
import { useStepCapabilities } from './usePluginDialogController/capabilities.js';
import { useDialogStatePublisher } from './usePluginDialogController/publish-dialog-state.js';
import { evaluateCancelPolicy } from './cancelDraftPolicy.js';
import type { TreeNodeUpdaterPayload, TreeNodeUpdaterPatch } from './usePluginDialogController/data-types.js';
import type { MultiStepDialogState } from './controller/types.js';
export { subscribeDialogState } from './controller/dialog-state-subscriber.js';
export { BASIC_INFO_META_KEY, buildStepWorkingData } from './controller/step-guards.js';

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

export interface PluginDialogControllerState {
  headlessProps: HeadlessMultiStepDialogProps<Partial<PluginDefinedEntity>>;
  stepDescriptors: ReadonlyArray<StepComponentDescriptor<Partial<PluginDefinedEntity>>>;
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

  const {
    dialogStateApi,
    workerDialogState,
    dialogStateError,
    setDialogStateError,
  } = useDialogStateBridge({
    client,
    nodeType,
    nodeId,
  });

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

  const applyUpdateDraft = useCallback(
    (patch: TreeNodeUpdaterPatch<PluginDefinedEntity>) => {
      const payload: Partial<TreeNodeUpdaterState<PluginDefinedEntity>> = {
        treeNodeId: (treeUpdater?.treeNodeId ?? nodeId) as NodeId,
      };
      if (patch.draftMetadata !== undefined) payload.draftMetadata = patch.draftMetadata ?? undefined;
      if (patch.draftData !== undefined) payload.draftData = patch.draftData ?? undefined;
      updateTreeNodeUpdater(payload);
    },
    [nodeId, treeUpdater?.treeNodeId, updateTreeNodeUpdater]
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
      setLocalDraftData((prev) => ({ ...toRecord(prev) ?? {}, ...patch.draftData }));
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

  useDialogStatePublisher({
    dialogStateApi,
    nodeType,
    nodeId,
    steps,
    activeStepIndex,
    enabledStepIndices,
    validatedStepIndices,
    guards: evaluatedState.guards,
    dialogTitle,
    headerSubtitle,
    committableStepIndices,
    open,
    setDialogStateError,
  });

  const safeStepDescriptors: ReadonlyArray<StepComponentDescriptor<Partial<PluginDefinedEntity>>> = useMemo(
    () =>
      stepDescriptors.length
        ? stepDescriptors
        : [{ id: 'placeholder', label: 'placeholder', component: PlaceholderStep }],
    [stepDescriptors]
  );

  useEffect(() => {
    if (!workerDialogState) return;
    if (!workerDialogState.steps?.length) return;
    const validated = workerDialogState.steps
      .map((step, idx) => (step.completed ? idx : -1))
      .filter((idx) => idx >= 0);
    if (validated.length > validatedStepIndices.length) {
      setActiveStepIndex(workerDialogState.activeStepIndex);
    }
  }, [workerDialogState, validatedStepIndices.length, setActiveStepIndex]);

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
    // BasicInfoは draftMetadata にのみ保持。plugin固有データは draftData にのみ保持。
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
  }, [
    basicInfo.description,
    basicInfo.name,
    basicInfo.tags,
    localDraftData,
    nodeId,
    treeUpdater,
    updateTreeNodeUpdater,
    nodeType,
  ]);

  const canSaveCurrent = evaluatedState.guards.canSave;
  const canStartBatch = evaluatedState.guards.canStartBatch;
  const activeStartBatch = activeStepConfig?.capabilities?.startBatch;
  const footerPrimaryButtons = footerOptions?.primaryButtons;
  const footerSaveDraftLabel = footerOptions?.saveDraftLabel;
  const disableDraftButton = nodeType === 'folder';
  const [isStartingBatch, setIsStartingBatch] = useState(false);

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
            nextIndex = clampIndex(event.targetIndex ?? activeStepIndexRef.current, stepsLengthRef.current);
            break;
          case 'next':
            nextIndex = clampIndex(activeStepIndexRef.current + 1, stepsLengthRef.current);
            break;
          case 'back':
            nextIndex = clampIndex(activeStepIndexRef.current - 1, stepsLengthRef.current);
            break;
        }
        if (typeof console !== 'undefined' && typeof console.debug === 'function') {
          console.debug('[PluginDialogShell] navigation', {
            type: event.type,
            activeStepIndex: activeStepIndexRef.current,
            nextIndex,
            enabledStepIndices: enabledStepsRef.current,
            validatedStepIndices: validatedStepsRef.current,
            canSave: canSaveRef.current,
          });
        }
        if (nextIndex === activeStepIndexRef.current) return;
        void updateLocalDraftRef.current?.().finally(() => {
          setActiveStepIndexRef.current(nextIndex);
          setUrlStepRef.current(nextIndex);
        });
      })();
    },
    []
  );

  const navigateToNode = useCallback(
    (targetId: NodeId) => {
      void navigate({ to: `/t/${treeId}/${pageNodeId}/${targetId}` as const });
    },
    [navigate, treeId, pageNodeId]
  );

  const saveDraftInProgress = useRef(false);
  const foregroundDialogSx = useMemo(
    () => ({
      zIndex: (theme: Theme) => theme.zIndex.modal + 2,
      '& .MuiBackdrop-root': {
        zIndex: (theme: Theme) => theme.zIndex.modal + 1,
      },
    }),
    []
  );

  const handleSubmit = useCallback(async () => {
    const ok = await ensureNoConflict();
    if (!ok) return;
    await updateLocalDraft();
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
    const normalizedData =
      nodeType === 'folder'
        ? null
        : dialogData && Object.keys(dialogData).length > 0
          ? (dialogData as Record<string, unknown>)
          : null;

    // For single-source path, ensure upstream state is aligned before commit
    const savedNodeId = await commitTreeNodeUpdater({
      // commitTreeNodeUpdater pushes draft fields synchronously before commit.
      // draftMetadata carries basic info so commitDraft can apply it to metadata,
      // and commit will clear draftMetadata/draftData afterward.
      draftMetadata: {
        name: basicInfo.name,
        description: basicInfo.description,
        tags: basicInfo.tags,
      },
      draftData: nodeType === 'folder' ? null : (normalizedData ?? null),
      data: normalizedData === null ? undefined : normalizedData,
      metadata: undefined,
    });
    onSuccess?.(savedNodeId);
    navigateToNode(savedNodeId);
    onClose();
  }, [ensureNoConflict, updateLocalDraft, nodeType, dialogData, commitTreeNodeUpdater, basicInfo.name, basicInfo.description, basicInfo.tags, onSuccess, navigateToNode, onClose, mode, draft?.draftMetadata, draftDataWithoutMeta]);

  useEffect(() => {
    handleSubmitRef.current = handleSubmit;
  }, [handleSubmit]);

  const handleSaveDraft = useCallback(async () => {
    try {
      const ok = await ensureNoConflict();
      if (!ok) return;
      saveDraftInProgress.current = true;
      await updateLocalDraft();
      // Save Draft: keep data untouched, put latest step data into draftData, clear draftMetadata
      updateTreeNodeUpdater({
        draftData: nodeType === 'folder' ? null : (dialogData as Record<string, unknown>),
        draftMetadata: {
          ...(treeUpdater?.draftMetadata ?? {}),
          name: basicInfo.name,
          description: basicInfo.description,
          tags: basicInfo.tags,
        },
      });
    } catch (err) {
      saveDraftInProgress.current = false;
      throw err;
    }
  }, [ensureNoConflict, updateLocalDraft, updateTreeNodeUpdater, nodeType, dialogData, treeUpdater?.draftMetadata, basicInfo.name, basicInfo.description, basicInfo.tags]);

  const handleCancel = useCallback(async () => {
    const decision = evaluateCancelPolicy(mode, draft);
    if (decision === 'discard-force-delete') {
      await discardDraft({ forceDelete: true });
    } else if (decision === 'discard-draft-only') {
      await discardDraft();
    }
    onClose();
  }, [discardDraft, mode, onClose, draft]);

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

  const HeaderComponent: HeadlessMultiStepDialogProps<Partial<PluginDefinedEntity>>['HeaderComponent'] = useCallback(
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

  const ContentComponent: HeadlessMultiStepDialogProps<Partial<PluginDefinedEntity>>['ContentComponent'] = useCallback(
    () => (
      <Box
        sx={(theme) => ({
          flex: 1,
          overflow: 'auto',
          padding: theme.spacing(2),
          // backgroundColor: theme.palette.background.default,
        })}
        ref={dialogRef}
      >
        <MultiStepDialogContent />
      </Box>
    ),
    [dialogRef]
  );

  const FooterComponent: HeadlessMultiStepDialogProps<Partial<PluginDefinedEntity>>['FooterComponent'] =
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

  const confirmDiscardIfNeeded = useCallback(() => {
    if (!hasUnsavedChanges) return true;
    if (typeof window === 'undefined' || typeof window.confirm !== 'function') return false;
    return window.confirm('Discard unsaved changes?');
  }, [hasUnsavedChanges]);

  const handleCloseRequest = useCallback(() => {
    if (!confirmDiscardIfNeeded()) return;
    if (saveDraftInProgress.current) {
      saveDraftInProgress.current = false;
      onClose();
      return;
    }
    handleCancel().catch(() => void 0);
  }, [confirmDiscardIfNeeded, handleCancel, onClose]);

  const handleStepDataChange = useCallback(
    (patch: Partial<Partial<PluginDefinedEntity>>) => {
      // Folder は常に draftData null としたいのでローカルは空扱いにする
      if (nodeType === 'folder') {
        setLocalDraftData({});
        return;
      }
      setLocalDraftData((prev) => ({ ...(toRecord(prev) ?? {}), ...patch }));
    },
    [setLocalDraftData, nodeType]
  );

  const handleRequestCommit = useCallback(() => {
    if (typeof console !== 'undefined' && typeof console.debug === 'function') {
      console.debug('[PluginDialogShell] commit click', {
        activeStepIndex: activeStepIndexRef.current,
        canSave: canSaveRef.current,
        validatedStepIndices: validatedStepsRef.current,
      });
    }
    handleSubmitRef.current?.().catch(() => void 0);
  }, []);

  const invalidMessageMap = useMemo(() => ({}), []);

  const headlessProps: HeadlessMultiStepDialogProps<Partial<PluginDefinedEntity>> = {
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
    onPositionChange: handlePositionChange as (next?: MultiStepDialogPosition) => void,
    size: dialogSize,
    onSizeChange: handleSizeChange as (next?: MultiStepDialogSize) => void,
    displayMode,
    onDisplayModeChange: (mode: DialogDisplayMode) => {
      void transitionDisplayMode(mode);
    },
    HeaderComponent,
    ContentComponent,
    FooterComponent,
  };

  if (dialogStateError) {
    const errorObject =
      dialogStateError instanceof Error ? dialogStateError : new Error(String(dialogStateError));
    throw errorObject;
  }

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
