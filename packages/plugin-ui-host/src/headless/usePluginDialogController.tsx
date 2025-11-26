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
import { useDialogDraft, type DraftData } from '@hierarchidb/plugin-ui-sdk';
import { getWorkerClientHook, type WorkerClientRef } from '@hierarchidb/runtime-client';
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
import { Box } from '@mui/material';
import { useNavigate } from '@tanstack/react-router';
import { type Remote } from 'comlink';
import type React from 'react';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
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
import type { DialogStepData } from './usePluginDialogController/data-types.js';
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

export interface PluginDialogControllerState {
  headlessProps: HeadlessMultiStepDialogProps<DialogStepData>;
  stepDescriptors: ReadonlyArray<StepComponentDescriptor<DialogStepData>>;
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

  const draftDataWithoutMeta = useMemo(
    () => (toRecord(draft?.draftData) ?? {}),
    [draft?.draftData]
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
    draft,
    draftDataWithoutMeta,
    updateDraft,
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
    draftDataWithoutMeta,
    updateDraft,
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

  const safeStepDescriptors: ReadonlyArray<StepComponentDescriptor<DialogStepData>> = useMemo(
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

  const handleNavigation = useCallback(
    (event: StepNavigationEvent) => {
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
      setActiveStepIndex(nextIndex);
      setUrlStep(nextIndex);
    },
    [activeStepIndex, setActiveStepIndex, setUrlStep, steps.length]
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

  const HeaderComponent: HeadlessMultiStepDialogProps<DialogStepData>['HeaderComponent'] = useCallback(
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
    (propsContent: HeadlessContentRenderProps<DialogStepData>) => {
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
    [steps, dialogRef]
  );

  const FooterComponent: HeadlessMultiStepDialogProps<DialogStepData>['FooterComponent'] = useCallback(
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

  const headlessProps: HeadlessMultiStepDialogProps<DialogStepData> = {
    open,
    stepComponents: safeStepDescriptors,
    stepData: currentStepData,
    onStepDataChange: (patch: Partial<DialogStepData>) =>
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
