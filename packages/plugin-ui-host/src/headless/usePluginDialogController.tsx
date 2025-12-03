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
import { useTreeNodeUpdater } from '@hierarchidb/plugin-ui-sdk';
import { getWorkerClientHook, type WorkerClientRef } from '@hierarchidb/ui-worker-provider';
import type {
  DialogDisplayMode,
  MultiDialogPosition,
  MultiDialogSize,
  StepComponentDescriptor,
  StepNavigationEvent,
} from '@hierarchidb/ui-dialog';
import {
  type HeadlessContentRenderProps,
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
      const payload: Record<string, unknown> = {
        treeNodeId: treeUpdater?.treeNodeId ?? nodeId,
      };
      if (patch.draftMetadata !== undefined) payload.draftMetadata = patch.draftMetadata;
      if (patch.draftData !== undefined) payload.draftData = patch.draftData;
      updateTreeNodeUpdater(payload as any);
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

  const [resumeDialogOpen, setResumeDialogOpen] = useState(false);
  const resumeDialogShownRef = useRef(false);

  useEffect(() => {
    if (mode !== 'edit') return;
    if (!draft) return;
    if (resumeDialogShownRef.current) return;
    if (!draft.hasRemoteDraft) return;
    resumeDialogShownRef.current = true;
    setResumeDialogOpen(true);
  }, [draft, mode]);

  const handleResumeExistingDraft = useCallback(() => {
    setResumeDialogOpen(false);
  }, []);

  const handleStartFreshDraft = useCallback(() => {
    if (!draft) {
      setResumeDialogOpen(false);
      return;
    }
    const fallbackMetadata = draft.metadata ?? { name: '', description: '', tags: [] };
    const baselineData =
      (draft.data as Partial<PluginDefinedEntity> | undefined) ?? ({} as Partial<PluginDefinedEntity>);
    updateTreeNodeUpdater({
      treeNodeId: draft.treeNodeId,
      draftMetadata: fallbackMetadata,
      draftData: baselineData,
      version: draft.version,
      updatedAt: draft.updatedAt,
      hasRemoteDraft: false,
    } as any);
    setResumeDialogOpen(false);
  }, [draft, updateTreeNodeUpdater]);

  const handleResumeCancel = useCallback(() => {
    setResumeDialogOpen(false);
    onClose();
  }, [onClose]);

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
      } as any);
    }
    return true;
  }, [closeConflictDialog, discardDraft, draft?.version, fetchLatestVersion, onClose, requestConflictResolution, updateTreeNodeUpdater]);

  const flushDraftOnce = useCallback(async () => {
    const payload: Partial<
      import('@hierarchidb/plugin-ui-sdk').TreeNodeUpdaterState<Partial<PluginDefinedEntity>>
    > = {
      treeNodeId: (treeUpdater?.treeNodeId ?? nodeId) as NodeId,
      draftMetadata: {
        ...(treeUpdater?.draftMetadata ?? {}),
        name: basicInfo.name,
        description: basicInfo.description,
        tags: basicInfo.tags,
      },
      draftData: { ...localDraftData },
    };
    await commitTreeNodeUpdater(payload);
  }, [
    basicInfo.description,
    basicInfo.name,
    basicInfo.tags,
    localDraftData,
    nodeId,
    commitTreeNodeUpdater,
    treeUpdater?.draftMetadata,
    treeUpdater?.treeNodeId,
  ]);

  const handleNavigation = useCallback(
    (event: StepNavigationEvent) => {
      void (async () => {
        const ok = await ensureNoConflict();
        if (!ok) return;
        let nextIndex = activeStepIndex;
        switch (event.type) {
          case 'direct':
            nextIndex = clampIndex(event.targetIndex ?? activeStepIndex, steps.length);
            break;
          case 'next':
            nextIndex = clampIndex(activeStepIndex + 1, steps.length);
            break;
          case 'back':
            nextIndex = clampIndex(activeStepIndex - 1, steps.length);
            break;
        }
        if (nextIndex === activeStepIndex) return;
        void flushDraftOnce().finally(() => {
          setActiveStepIndex(nextIndex);
          setUrlStep(nextIndex);
        });
      })();
    },
    [activeStepIndex, ensureNoConflict, setActiveStepIndex, setUrlStep, steps.length, flushDraftOnce]
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
    await flushDraftOnce();
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
    const savedNodeId = treeUpdater?.treeNodeId ?? nodeId;

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
  }, [ensureNoConflict, flushDraftOnce, treeUpdater?.treeNodeId, nodeId, onClose, nodeType, mode, draft?.draftMetadata, basicInfo.name, basicInfo.description, basicInfo.tags, draftDataWithoutMeta, discardDraft, onSuccess, navigateToNode]);

  const handleSaveDraft = useCallback(async () => {
    try {
      const ok = await ensureNoConflict();
      if (!ok) return;
      saveDraftInProgress.current = true;
      await flushDraftOnce();
    } catch (err) {
      saveDraftInProgress.current = false;
      throw err;
    }
  }, [ensureNoConflict, flushDraftOnce]);

  const handleCancel = useCallback(async () => {
    // Cancel: create は forceDelete、edit は draft clear（現行 discardDraft が内部で判断）
    const forceDelete = mode === 'create';
    await discardDraft(forceDelete ? { forceDelete: true } : undefined);
    onClose();
  }, [discardDraft, mode, onClose]);

  const canSaveCurrent = evaluatedState.guards.canSave;
  const canStartBatch = evaluatedState.guards.canStartBatch;
  const activeStartBatch = activeStepConfig?.capabilities?.startBatch;
  const footerPrimaryButtons = footerOptions?.primaryButtons;
  const footerSaveDraftLabel = footerOptions?.saveDraftLabel;
  const disableDraftButton = nodeType === 'folder';
  const [isStartingBatch, setIsStartingBatch] = useState(false);

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

  const renderContent = useCallback(
    (propsContent: HeadlessContentRenderProps<Partial<PluginDefinedEntity>>) => {
      const descriptor = propsContent.steps[propsContent.activeStepIndex];
      if (!descriptor) return null;
      const StepComp = descriptor.component;
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
          <StepComp
            stepIndex={propsContent.activeStepIndex}
            stepId={descriptor.id}
            label={descriptor.label}
            data={propsContent.stepData}
            onChange={propsContent.onStepDataChange}
            invalidMessages={propsContent.invalidMessageMap}
          />
        </Box>
      );
    },
    [dialogRef]
  );

  const FooterComponent: HeadlessMultiStepDialogProps<Partial<PluginDefinedEntity>>['FooterComponent'] =
    useCallback(
      () => (
        <>
          <Dialog open={resumeDialogOpen} onClose={handleResumeCancel} sx={foregroundDialogSx}>
            <DialogTitle>{t('dialogs.pluginDraft.resume.title')}</DialogTitle>
            <DialogContent>
              <Typography variant="body2">{t('dialogs.pluginDraft.resume.description')}</Typography>
            </DialogContent>
            <DialogActions>
              <Button onClick={handleResumeCancel}>{t('dialogs.pluginDraft.resume.buttons.cancel')}</Button>
              <Button onClick={handleStartFreshDraft}>{t('dialogs.pluginDraft.resume.buttons.startFresh')}</Button>
              <Button variant="contained" onClick={handleResumeExistingDraft} autoFocus>
                {t('dialogs.pluginDraft.resume.buttons.resumePrevious')}
              </Button>
            </DialogActions>
          </Dialog>

          <Dialog
            open={conflictDialog.open}
            onClose={() => {
              conflictResolverRef.current?.('continue');
              closeConflictDialog();
            }}
            sx={foregroundDialogSx}
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
      [
        resumeDialogOpen,
        handleResumeCancel,
        handleStartFreshDraft,
        handleResumeExistingDraft,
        conflictDialog.open,
        conflictDialog.updatedAt,
        closeConflictDialog,
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

  const headlessProps: HeadlessMultiStepDialogProps<Partial<PluginDefinedEntity>> = {
    open,
    stepComponents: safeStepDescriptors,
    stepData: currentStepData,
    onStepDataChange: (patch: Partial<Partial<PluginDefinedEntity>>) =>
      setLocalDraftData((prev) => ({ ...(toRecord(prev) ?? {}), ...patch })),
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
    onPositionChange: handlePositionChange as (next?: MultiDialogPosition) => void,
    size: dialogSize,
    onSizeChange: handleSizeChange as (next?: MultiDialogSize) => void,
    displayMode,
    onDisplayModeChange: (mode: DialogDisplayMode) => {
      void transitionDisplayMode(mode);
    },
    HeaderComponent,
    renderContent,
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
