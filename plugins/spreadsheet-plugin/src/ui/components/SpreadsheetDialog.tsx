import { useCallback, useMemo, useRef } from 'react';
import type { NodeId, TreeId, TreeNodeMetadata } from '@hierarchidb/common-types';
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
} from '@hierarchidb/ui-dialog';
import { BasicInfoStep, type BasicInfoData } from '@hierarchidb/ui-plugin-basic-info';
import { useTreeNodeUpdater, createTreeNodeUpdaterActions } from '@hierarchidb/plugin-ui-sdk';
import { useDialogViewState } from '@hierarchidb/plugin-base';
import type { TreeNodeUpdaterPayload } from '@hierarchidb/common-types';
import type { SpreadsheetEntity } from '../../common/types/SpreadsheetEntity.js';
import { DataSourceStep } from './steps/DataSourceStep.js';
import { FilteringStep } from './steps/FilteringStep.js';

export interface SpreadsheetDialogProps {
  open: boolean;
  mode: 'create' | 'edit';
  nodeId?: NodeId;
  parentId?: NodeId;
  treeId?: TreeId;
  onClose: () => void;
  onSave: (data: TreeNodeMetadata) => Promise<void>;
}

const defaultDialogState = () => {
  const viewport = getViewportSize();
  const size = getPresetSize('normal', viewport);
  const position = initialPosition(size, viewport);
  return { size, position };
};

export const SpreadsheetDialog: React.FC<SpreadsheetDialogProps> = ({
  open,
  mode,
  nodeId,
  parentId,
  treeId,
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

  const { size: initialSize, position: initialPositionValue } = useMemo(defaultDialogState, []);

  const { dialogState, updateDialogState } = useDialogViewState({
    initialSize,
    initialPosition: initialPositionValue,
    initialDisplayMode: 'normal',
    initialActiveStepIndex: 0,
  });

  const { treeNodeUpdater, updateDraft, saveDraft, discardDraft } = useTreeNodeUpdater<SpreadsheetEntity>({
    mode,
    nodeType: 'spreadsheet',
    nodeId,
    parentId,
    treeId,
    workerClient,
  });

  const { size: dialogSize, position: dialogPosition, displayMode, activeStepIndex, isSaving } = dialogState;
  const dialogRef = useRef<HTMLDivElement | null>(null);

  const dialogSizeRef = useRef(dialogSize);
  const dialogPositionRef = useRef(dialogPosition);

  const dialogData = useMemo<TreeNodeUpdaterPayload<SpreadsheetEntity>['draftData']>(
    () => ((treeNodeUpdater?.draftData ?? treeNodeUpdater?.data ?? null) as SpreadsheetEntity | null),
    [treeNodeUpdater?.data, treeNodeUpdater?.draftData]
  );
  const { updatePayload, updateMetadata } = useMemo(
    () => createTreeNodeUpdaterActions<SpreadsheetEntity>(updateDraft),
    [updateDraft]
  );

  const persistBasicInfo = useCallback(
    (value: BasicInfoData) => {
      const baseMeta = treeNodeUpdater?.draftMetadata ?? treeNodeUpdater?.metadata;
      updateMetadata(
        {
          name: value.name,
          description: value.description ?? '',
          tags: value.tags ?? [],
        },
        baseMeta ?? { name: '', description: '', tags: [] }
      );
    },
    [treeNodeUpdater?.draftMetadata, treeNodeUpdater?.metadata, updateMetadata]
  );

  const handleUpdate = useCallback(
    (patch: Partial<SpreadsheetEntity>) => {
      const basePayload = (treeNodeUpdater?.draftData ?? treeNodeUpdater?.data ?? {}) as SpreadsheetEntity;
      const baseMeta = treeNodeUpdater?.draftMetadata ?? treeNodeUpdater?.metadata ?? { name: '', description: '', tags: [] };
      updatePayload(patch, basePayload);
      updateMetadata(
        baseMeta,
        baseMeta
      );
    },
    [treeNodeUpdater?.data, treeNodeUpdater?.draftData, treeNodeUpdater?.draftMetadata, treeNodeUpdater?.metadata, updateMetadata, updatePayload]
  );

  const handleSave = useCallback(async () => {
    if (isSaving) return;
    updateDialogState({ patch: { isSaving: true } });
    const baseMeta = treeNodeUpdater?.draftMetadata ?? treeNodeUpdater?.metadata ?? { name: '', description: '', tags: [] };
    try {
      await saveDraft();
      await onSave({
        name: baseMeta.name ?? '',
        description: baseMeta.description ?? '',
        tags: baseMeta.tags ?? [],
      });
      onClose();
    } finally {
      updateDialogState({ patch: { isSaving: false } });
    }
  }, [treeNodeUpdater?.draftMetadata, treeNodeUpdater?.metadata, isSaving, onClose, onSave, saveDraft, updateDialogState]);

  const handleDiscard = useCallback(() => {
    void discardDraft().catch(() => {});
    onClose();
  }, [discardDraft, onClose]);

  const metadata = treeNodeUpdater?.draftMetadata ?? treeNodeUpdater?.metadata;
  const data = dialogData ?? {};

  const steps = useMemo(() => [
    {
      id: 'basic',
      label: 'Basic Information',
      component: (
        <BasicInfoStep
          name={metadata?.name ?? ''}
          description={metadata?.description ?? ''}
          tags={metadata?.tags ?? []}
          mode={mode}
          onChange={persistBasicInfo}
          validate={({ name }: BasicInfoData) => (name.trim().length ? null : 'Name is required')}
        />
      ),
      validate: () => Boolean(metadata?.name?.trim()),
    },
    {
      id: 'data-source',
      label: 'Data Source',
      component: (
        <DataSourceStep
          mode={mode}
          nodeId={nodeId}
          parentId={parentId}
          data={data}
          onChange={handleUpdate}
          setValid={() => {}}
          setError={() => {}}
          disabled={false}
          dialogRef={dialogRef}
        />
      ),
      validate: () => Boolean(data?.spreadsheetMetadataId),
    },
    {
      id: 'filtering',
      label: 'Filtering',
      component: (
        <FilteringStep
          mode={mode}
          nodeId={nodeId}
          parentId={parentId}
          data={data}
          onChange={handleUpdate}
          setValid={() => {}}
          setError={() => {}}
          disabled={false}
          dialogRef={dialogRef}
        />
      ),
      validate: () => true,
    },
  ], [data, handleUpdate, metadata?.description, metadata?.name, metadata?.tags, mode, nodeId, parentId, persistBasicInfo]);

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

  const headlessProps: HeadlessMultiStepDialogProps<SpreadsheetEntity> = {
    open,
    stepComponents: steps.map((step) => ({
      id: step.id,
      label: step.label,
      component: () => step.component,
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

  return (
    <div style={frameStyle} role="dialog" aria-modal={open} ref={dialogRef}>
      <HeadlessMultiStepDialog<SpreadsheetEntity> {...headlessProps} />
    </div>
  );
};

SpreadsheetDialog.displayName = 'SpreadsheetDialog';
