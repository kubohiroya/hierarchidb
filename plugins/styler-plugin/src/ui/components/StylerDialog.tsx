import { useCallback, useMemo, useRef, useState } from 'react';
import type { NodeId, TreeId } from '@hierarchidb/common-types';
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
import { useTreeNodeUpdater, type DraftData, createTreeNodeUpdaterActions } from '@hierarchidb/plugin-ui-sdk';
import type { StylerDialogData } from './types.js';
import type { SpreadsheetDialogData } from '@hierarchidb/spreadsheet-plugin';
import { StyleSettingsStep } from './steps/StyleSettingsStep.js';
import { StylerStep5 } from './steps/StylerStep5.js';
import { StylerStep6 } from './steps/StylerStep6.js';
import { DataSourceStep as SpreadsheetDataSourceStep, FilteringStep as SpreadsheetFilteringStep } from '@hierarchidb/spreadsheet-plugin';

export interface StylerDialogProps {
  open: boolean;
  mode: 'create' | 'edit';
  nodeId?: NodeId;
  parentId?: NodeId;
  treeId?: TreeId;
  onClose: () => void;
  onSave: (data: StylerDialogData) => Promise<void>;
}

const defaultDialogState = () => {
  const viewport = getViewportSize();
  const size = getPresetSize('normal', viewport);
  const position = initialPosition(size, viewport);
  return { size, position };
};

type StylerDialogDraft = StylerDialogData & {
  name?: string;
  description?: string;
  tags?: string[];
};

const normalizeDraft = (raw: DraftData<StylerDialogDraft> | null): StylerDialogDraft => {
  const meta = raw?.draftMetadata ?? raw?.metadata ?? { name: '', description: '', tags: [] };
  const draftData = raw?.draftData ?? {};
  return {
    ...draftData,
    name: meta.name ?? '',
    description: meta.description ?? '',
    tags: Array.isArray(meta.tags) ? meta.tags : [],
  };
};

export const StylerDialog: React.FC<StylerDialogProps> = ({
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
  const { draft, updateDraft, saveDraft, discardDraft } = useTreeNodeUpdater<StylerDialogDraft>({
    mode,
    nodeType: 'styler',
    nodeId,
    parentId,
    treeId,
    workerClient,
  });

  const [dialogSize, setDialogSize] = useState<MultiDialogSize>(initialSize);
  const [dialogPosition, setDialogPosition] = useState<MultiDialogPosition>(initialPositionValue);
  const [displayMode, setDisplayMode] = useState<DialogDisplayMode>('normal');
  const [activeStepIndex, setActiveStepIndex] = useState(0);
  const [isSaving, setIsSaving] = useState(false);

  const dialogSizeRef = useRef(dialogSize);
  const dialogPositionRef = useRef(dialogPosition);

  const data = useMemo<StylerDialogDraft>(() => normalizeDraft(draft), [draft]);
  const spreadsheetData = useMemo<SpreadsheetDialogData>(() => ({
    ...data,
    metadata: data.spreadsheetMetadata ?? undefined,
  }), [data]);
  const { updatePayload, updateMetadata } = useMemo(
    () => createTreeNodeUpdaterActions<StylerDialogDraft>(updateDraft),
    [updateDraft]
  );

  const persistBasicInfo = useCallback(
    (value: BasicInfoData) => {
      updateMetadata(
        {
          name: value.name,
          description: value.description,
          tags: value.tags ?? [],
        },
        { name: '', description: '', tags: [] }
      );
    },
    [updateMetadata]
  );

  const handleUpdate = useCallback(
    (patch: Partial<StylerDialogData>) => {
      const basePayload = (draft?.draftData ?? {}) as StylerDialogData;
      updatePayload(patch, basePayload);
      updateMetadata(
        {
          name: data.name ?? '',
          description: data.description,
          tags: data.tags ?? [],
        },
        { name: '', description: '', tags: [] },
      );
    },
    [data.description, data.name, data.tags, draft?.draftData, updateMetadata, updatePayload]
  );

  const handleSave = useCallback(async () => {
    if (isSaving) return;
    setIsSaving(true);
    try {
      const savedId = await saveDraft();
      await onSave({ ...data, nodeId: savedId as NodeId } as StylerDialogData);
      onClose();
    } finally {
      setIsSaving(false);
    }
  }, [data, isSaving, onClose, onSave, saveDraft]);

  const handleDiscard = useCallback(() => {
    void discardDraft().catch(() => {});
    onClose();
  }, [discardDraft, onClose]);

  const steps = useMemo(() => [
    {
      id: 'basic',
      label: 'Basic Information',
      component: (
        <BasicInfoStep
          name={data.name ?? ''}
          description={data.description ?? ''}
          tags={data.tags ?? []}
          mode={mode}
          onChange={persistBasicInfo}
          validate={({ name }: BasicInfoData) => (name.trim().length ? null : 'Name is required')}
        />
      ),
      validate: () => Boolean(data.name?.trim()),
    },
    {
      id: 'style-settings',
      label: 'Style Settings',
      component: (
        <StyleSettingsStep
          mode={mode}
          nodeId={nodeId}
          parentId={parentId}
          data={data}
          onChange={handleUpdate}
          setValid={() => {}}
          setError={() => {}}
          disabled={false}
        />
      ),
      validate: () => Boolean(data.styleSettings?.styleType),
    },
    {
      id: 'data-source',
      label: 'Data Source',
      component: (
        <SpreadsheetDataSourceStep
          mode={mode}
          nodeId={nodeId}
          parentId={parentId}
          data={spreadsheetData}
          onChange={(next) => {
            const { metadata, ...rest } = next;
            handleUpdate({ ...rest, spreadsheetMetadata: metadata ?? undefined });
          }}
          setValid={() => {}}
          setError={() => {}}
          disabled={false}
        />
      ),
      validate: () => Boolean(data.spreadsheetMetadataId),
    },
    {
      id: 'filtering',
      label: 'Filtering',
      component: (
        <SpreadsheetFilteringStep
          mode={mode}
          nodeId={nodeId}
          parentId={parentId}
          data={spreadsheetData}
          onChange={(next) => {
            const { metadata, ...rest } = next;
            handleUpdate({ ...rest, spreadsheetMetadata: metadata ?? undefined });
          }}
          setValid={() => {}}
          setError={() => {}}
          disabled={false}
        />
      ),
      validate: () => true,
    },
    {
      id: 'style-mapping',
      label: 'Style Mapping',
      component: (
        <StylerStep5
          data={data}
          onChange={handleUpdate}
          onValidate={() => {}}
        />
      ),
      validate: () => Boolean(data.stylerConfig?.targetProperty && data.selectedValueColumn),
    },
    {
      id: 'preview',
      label: 'Preview',
      component: (
        <StylerStep6
          data={data}
          onChange={handleUpdate}
          onValidate={() => {}}
        />
      ),
      validate: () => true,
    },
  ], [data, handleUpdate, mode, nodeId, parentId, persistBasicInfo, spreadsheetData]);

  const enabledStepIndices = useMemo(() => steps
    .map((step, idx) => (step.validate ? step.validate() : true) ? idx : -1)
    .filter((idx) => idx >= 0), [steps]);

  const handleNavigation = useCallback((event: StepNavigationEvent) => {
    switch (event.type) {
      case 'direct':
        setActiveStepIndex(event.targetIndex);
        break;
      case 'next':
        setActiveStepIndex((prev) => Math.min(prev + 1, steps.length - 1));
        break;
      case 'back':
        setActiveStepIndex((prev) => Math.max(prev - 1, 0));
        break;
    }
  }, [steps.length]);

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
      setDialogSize(normalized.size);
      setDialogPosition(normalized.position);
    }
  }, [displayMode]);

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
      setDialogSize(normalized.size);
      setDialogPosition(normalized.position);
    }
  }, [displayMode]);

  const headlessProps: HeadlessMultiStepDialogProps<StylerDialogData> = {
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
    onDisplayModeChange: (mode: DialogDisplayMode) => setDisplayMode(mode),
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
    <div style={frameStyle} role="dialog" aria-modal={open}>
      <HeadlessMultiStepDialog<StylerDialogData> {...headlessProps} />
    </div>
  );
};

StylerDialog.displayName = 'StylerDialog';
