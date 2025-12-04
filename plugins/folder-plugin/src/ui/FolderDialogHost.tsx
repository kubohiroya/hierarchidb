import { useCallback, useMemo, useRef, useEffect } from 'react';
import type { NodeId } from '@hierarchidb/common-types';
import { getWorkerClientHook, type WorkerClientRef } from '@hierarchidb/ui-worker-provider';
import {
  HeadlessMultiStepDialog,
  FRAME_CONSTANTS,
  getViewportSize,
  getPresetSize,
  normalizeDialogState,
  initialPosition,
  sizesEqual,
  positionsEqual,
  type DialogDisplayMode,
  type MultiDialogPosition,
  type MultiDialogSize,
  type StepNavigationEvent,
  type HeadlessMultiStepDialogProps,
  type StepComponentProps,
} from '@hierarchidb/ui-dialog';
import { BasicInfoStep, type BasicInfoData } from '@hierarchidb/ui-plugin-basic-info';
import { useTreeNodeUpdater, type TreeNodeUpdaterState } from '@hierarchidb/plugin-ui-sdk';
import { useDialogViewState } from '@hierarchidb/plugin-base';
import { resolveDefaultNodeName } from '@hierarchidb/runtime-worker';

type FolderDraftData = {
  nodeId?: NodeId;
  name?: string;
  description?: string;
  tags?: string[];
};

const normalizeDraft = (raw: TreeNodeUpdaterState<FolderDraftData> | null): FolderDraftData => {
  const meta = raw?.draftMetadata ?? raw?.metadata ?? { name: '', description: '', tags: [] };
  const draftData = raw?.draftData ?? {};
  const defaultName = resolveDefaultNodeName('folder');
  return {
    ...draftData,
    name: meta.name?.trim().length ? meta.name : defaultName,
    description: meta.description ?? '',
    tags: Array.isArray(meta.tags) ? meta.tags : [],
  };
};

export interface FolderDialogHostProps {
  open: boolean;
  mode: 'create' | 'edit';
  nodeId?: NodeId;
  parentId?: NodeId;
  onClose: () => void;
  onSave?: (data: FolderDraftData) => Promise<void>;
}

export const FolderDialogHost: React.FC<FolderDialogHostProps> = ({
  open,
  mode,
  nodeId,
  parentId,
  onClose,
  onSave,
}) => {
  const workerClient = useMemo<WorkerClientRef | null>(() => {
    try {
      const hook = getWorkerClientHook<WorkerClientRef | null>();
      return hook();
    } catch {
      return null;
    }
  }, []);

  const { size: initialSize, position: initialPositionValue } = useMemo(() => {
    const viewport = getViewportSize();
    const size = getPresetSize('normal', viewport);
    const position = initialPosition(size, viewport);
    return { size, position };
  }, []);

  const { dialogState, updateDialogState } = useDialogViewState({
    initialSize,
    initialPosition: initialPositionValue,
    initialDisplayMode: 'normal',
    initialActiveStepIndex: 0,
  });

  const { draft, updateDraft, saveDraft, discardDraft } = useTreeNodeUpdater<FolderDraftData>({
    mode,
    nodeType: 'folder',
    nodeId,
    parentId,
    workerClient,
  });

  useEffect(() => {
    console.log('[folder-dialog] host mounted', { mode, nodeId, parentId, open });
  }, [mode, nodeId, parentId, open]);

  useEffect(() => {
    if (draft) {
      // Debug: inspect draft returned from DraftAPI to verify metadata payload
      console.log('[folder-dialog] draft loaded', {
        id: draft.treeNodeId,
        draftMetadata: draft.draftMetadata,
        metadata: draft.metadata,
        draftData: draft.draftData,
      });
    } else {
      console.log('[folder-dialog] draft not yet loaded');
    }
  }, [draft]);

  const data = useMemo<FolderDraftData>(() => normalizeDraft(draft), [draft]);

  const { size: dialogSize, position: dialogPosition, displayMode, activeStepIndex, isSaving } = dialogState;

  const dialogSizeRef = useRef(dialogSize);
  const dialogPositionRef = useRef(dialogPosition);

  const persistBasicInfo = useCallback(
    (value: BasicInfoData) => {
      void updateDraft({
        draftMetadata: {
          name: value.name,
          description: value.description,
          tags: value.tags ?? [],
        },
      });
    },
    [updateDraft]
  );

  const handleSave = useCallback(async () => {
    if (isSaving) return;
    updateDialogState({ patch: { isSaving: true } });
    try {
      const savedId = await saveDraft();
      if (onSave) {
        await onSave({ ...data, nodeId: savedId });
      }
      onClose();
    } finally {
      updateDialogState({ patch: { isSaving: false } });
    }
  }, [data, isSaving, onClose, onSave, saveDraft, updateDialogState]);

  const handleDiscard = useCallback(() => {
    void discardDraft().catch(() => {});
    onClose();
  }, [discardDraft, onClose]);

  const steps = useMemo(() => [
    {
      id: 'basic',
      label: 'Basic Information',
      component: ((_props: StepComponentProps<FolderDraftData>) => (
        <BasicInfoStep
          name={data.name ?? ''}
          description={data.description ?? ''}
          tags={data.tags ?? []}
          mode={mode}
          onChange={persistBasicInfo}
          validate={(value: BasicInfoData) => (value.name.trim().length ? null : 'Name is required')}
        />
      )) as import('react').ComponentType<StepComponentProps<FolderDraftData>>,
      validate: () => Boolean(data.name?.trim()),
    },
  ], [data.description, data.name, data.tags, mode, persistBasicInfo]);

  const enabledStepIndices = useMemo(() => steps
    .map((step, idx) => (step.validate ? step.validate() : true) ? idx : -1)
    .filter((idx) => idx >= 0), [steps]);

  const handleNavigation = useCallback((event: StepNavigationEvent) => {
    switch (event.type) {
      case 'direct':
        updateDialogState({ patch: { activeStepIndex: event.targetIndex } });
        break;
      case 'next':
        updateDialogState({
          patch: { activeStepIndex: Math.min(activeStepIndex + 1, steps.length - 1) },
        });
        break;
      case 'back':
        updateDialogState({
          patch: { activeStepIndex: Math.max(activeStepIndex - 1, 0) },
        });
        break;
    }
  }, [activeStepIndex, steps.length, updateDialogState]);

  const handleSizeChange = useCallback((next?: MultiDialogSize) => {
    if (!next) return;
    const normalized = normalizeDialogState(
      next,
      dialogPositionRef.current,
      getViewportSize(),
      {
        enforceTopLeftMargin: displayMode === 'normal',
        minPosition: displayMode === 'normal' ? 0 : FRAME_CONSTANTS.NON_STANDARD_MARGIN,
        clampSizeToViewport: true,
      },
    );
    if (!sizesEqual(dialogSizeRef.current, normalized.size) || !positionsEqual(dialogPositionRef.current, normalized.position)) {
      dialogSizeRef.current = normalized.size;
      dialogPositionRef.current = normalized.position;
      updateDialogState({ patch: { size: normalized.size, position: normalized.position } });
    }
  }, [displayMode, updateDialogState]);

  const handlePositionChange = useCallback((next?: MultiDialogPosition) => {
    if (!next) return;
    const normalized = normalizeDialogState(
      dialogSizeRef.current,
      next,
      getViewportSize(),
      {
        enforceTopLeftMargin: displayMode === 'normal',
        minPosition: displayMode === 'normal' ? 0 : FRAME_CONSTANTS.NON_STANDARD_MARGIN,
        clampSizeToViewport: true,
      },
    );
    if (!sizesEqual(dialogSizeRef.current, normalized.size) || !positionsEqual(dialogPositionRef.current, normalized.position)) {
      dialogSizeRef.current = normalized.size;
      dialogPositionRef.current = normalized.position;
      updateDialogState({ patch: { size: normalized.size, position: normalized.position } });
    }
  }, [displayMode, updateDialogState]);

  const headlessProps: HeadlessMultiStepDialogProps<FolderDraftData> = {
    open,
    stepComponents: steps.map((step) => ({
      id: step.id,
      label: step.label,
      component: step.component,
    })),
    stepData: data,
    onStepDataChange: () => {},
    activeStepIndex,
    onStepNavigate: handleNavigation,
    enabledStepIndices,
    validatedStepIndices: enabledStepIndices,
    committableStepIndices: [steps.length - 1],
    invalidMessageMap: {},
    onRequestClose: handleDiscard,
    onRequestCommit: handleSave,
    isDirty: true,
    position: dialogPosition,
    onPositionChange: handlePositionChange,
    size: dialogSize,
    onSizeChange: handleSizeChange,
    displayMode,
    onDisplayModeChange: (mode: DialogDisplayMode) => updateDialogState({ patch: { displayMode: mode } }),
  };

  const fullScreen = displayMode === 'full-screen';
  const frameStyle: React.CSSProperties = {
    width: fullScreen ? '100%' : `${dialogSize.width}px`,
    maxWidth: fullScreen ? '100%' : 'min(calc(100vw - 48px), 1280px)',
    height: fullScreen ? '100%' : `${dialogSize.height}px`,
    maxHeight: fullScreen ? '100%' : 'calc(100vh - 48px)',
    display: 'flex',
    flexDirection: 'column',
    borderRadius: fullScreen ? 0 : 12,
    boxShadow: fullScreen ? 'none' : '0 22px 80px rgba(10, 14, 36, 0.38)',
    overflow: 'hidden',
    backgroundColor: '#fff',
  };

  if (!draft) {
    // Worker client not ready yet; avoid rendering empty form to prevent blank defaults
    return null;
  }

  return (
    <div style={frameStyle} role="dialog" aria-modal={open}>
      <HeadlessMultiStepDialog<FolderDraftData> {...headlessProps} />
    </div>
  );
};

FolderDialogHost.displayName = 'FolderDialogHost';
