import { useCallback, useMemo, useRef, useState } from 'react';
import type { NodeId, TreeId } from '@hierarchidb/common-types';
import { getWorkerClientHook, type WorkerClientRef } from '@hierarchidb/runtime-client';
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
import { useDialogDraft, normalizeBasicInfo, type DraftData } from '@hierarchidb/plugin-ui-sdk';
import type { ShapeDraft, ShapeEntity } from '../../common/shared/index.js';
import {
  DEFAULT_PROCESSING_CONFIG,
  mergeProcessingConfig,
  validateProcessingConfig,
  summarizeCheckboxState,
} from '../../common/shared/index.js';
import { StepTabularUpload } from '../../common/components/steps/StepTabularUpload.js';
import { StepTabularFilter } from '../../common/components/steps/StepTabularFilter.js';
import { Step2DataSource } from '../../common/components/steps/Step2DataSource.js';
import { Step3License } from '../../common/components/steps/Step3License.js';
import { Step4Processing } from '../../common/components/steps/Step4Processing.js';
import { Step5CountrySelection } from '../../common/components/steps/Step5CountrySelection.js';

export interface ShapeDialogProps {
  open: boolean;
  mode: 'create' | 'edit';
  nodeId?: NodeId;
  parentId?: NodeId;
  treeId?: TreeId;
  onClose: () => void;
  onSave?: (entity: ShapeEntity) => Promise<void>;
}

type ShapeDraftData = Partial<ShapeDraft> & {
  name?: string;
  description?: string;
  tags?: string[];
};

const normalizeDraft = (raw: DraftData<ShapeDraftData> | null): ShapeDraftData => {
  const basic = normalizeBasicInfo({
    metadata: raw?.draftMetadata ? { ...raw.draftMetadata } : undefined,
    draftData: raw?.draftData,
  });
  const draftData = raw?.draftData ?? {};
  return {
    ...draftData,
    name: basic.name,
    description: basic.description,
    tags: basic.tags,
  };
};

export const ShapeDialogHost: React.FC<ShapeDialogProps> = ({
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

  const { size: initialSize, position: initialPositionValue } = useMemo(() => {
    const viewport = getViewportSize();
    const size = getPresetSize('normal', viewport);
    const position = initialPosition(size, viewport);
    return { size, position };
  }, []);

  const { draft, updateDraft, saveDraft, discardDraft } = useDialogDraft<ShapeDraftData>({
    mode,
    nodeType: 'shape',
    nodeId,
    parentId,
    treeId,
    workerClient,
  });

  const data = useMemo<ShapeDraftData>(() => normalizeDraft(draft), [draft]);

  const [dialogSize, setDialogSize] = useState<MultiDialogSize>(initialSize);
  const [dialogPosition, setDialogPosition] = useState<MultiDialogPosition>(initialPositionValue);
  const [displayMode, setDisplayMode] = useState<DialogDisplayMode>('normal');
  const [activeStepIndex, setActiveStepIndex] = useState(0);
  const [isSaving, setIsSaving] = useState(false);
  const dialogSizeRef = useRef(dialogSize);
  const dialogPositionRef = useRef(dialogPosition);

  const persistBasicInfo = useCallback(
    (value: BasicInfoData) => {
      void updateDraft({
        draftMetadata: {
          name: value.name,
          description: value.description,
          tags: value.tags,
        },
      });
    },
    [updateDraft]
  );

  const handleSave = useCallback(async () => {
    if (isSaving) return;
    setIsSaving(true);
    try {
      const savedId = await saveDraft();
      if (onSave) {
        const now = Date.now();
        await onSave({
          id: savedId,
          nodeId: savedId,
          name: data.name ?? '',
          description: data.description ?? '',
          tags: data.tags ?? [],
          dataSourceName: 'naturalearth',
          licenseAgreement: true,
          processingConfig: mergeProcessingConfig(DEFAULT_PROCESSING_CONFIG),
          checkboxState: [],
          selectedCountries: [],
          adminLevels: [],
          urlMetadata: [],
          createdAt: now,
          updatedAt: now,
          version: 1,
        } as ShapeEntity);
      }
      onClose();
    } finally {
      setIsSaving(false);
    }
  }, [data.description, data.name, data.tags, isSaving, onClose, onSave, saveDraft]);

  const handleDiscard = useCallback(() => {
    void discardDraft().catch(() => {});
    onClose();
  }, [discardDraft, onClose]);

  const handleUpdate = useCallback(
    (patch: Partial<ShapeDraft>) => {
      void updateDraft({
        draftData: {
          ...(draft?.draftData ?? {}),
          ...patch,
        },
        draftMetadata: {
          name: data.name ?? '',
          description: data.description,
          tags: data.tags,
        },
      });
    },
    [data.description, data.name, data.tags, draft?.draftData, updateDraft]
  );

  const steps = useMemo(() => [
    {
      id: 'tabular-upload',
      label: 'Dataset Upload',
      component: (
        <StepTabularUpload
          mode={mode}
          data={data}
          onChange={handleUpdate}
          setValid={() => {}}
          setError={() => {}}
          disabled={false}
        />
      ),
      validate: () => Boolean(data.tabularMetadataId),
    },
    {
      id: 'tabular-filter',
      label: 'Dataset Filter',
      component: (
        <StepTabularFilter
          mode={mode}
          data={data}
          onChange={handleUpdate}
          setValid={() => {}}
          setError={() => {}}
          disabled={false}
        />
      ),
      validate: () => Boolean(data.tabularMetadataId),
    },
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
      id: 'data-source',
      label: 'Data Source',
      component: (
        <Step2DataSource
          draft={data}
          onUpdate={handleUpdate}
          disabled={false}
        />
      ),
      validate: () => Boolean(data.dataSourceName),
    },
    {
      id: 'license',
      label: 'License Agreement',
      component: (
        <Step3License
          draft={data}
          onUpdate={handleUpdate}
          disabled={false}
        />
      ),
      validate: () => Boolean(data.licenseAgreement),
    },
    {
      id: 'processing',
      label: 'Processing Configuration',
      component: (
        <Step4Processing
          draft={data}
          onUpdate={handleUpdate}
          disabled={false}
        />
      ),
      validate: () =>
        validateProcessingConfig(
          mergeProcessingConfig(data.processingConfig ?? DEFAULT_PROCESSING_CONFIG)
        ).isValid,
    },
    {
      id: 'country-selection',
      label: 'Country Selection',
      component: (
        <Step5CountrySelection
          draft={data}
          onUpdate={handleUpdate}
          disabled={false}
        />
      ),
      validate: () => summarizeCheckboxState(data.checkboxState).hasSelection,
    },
  ], [data, handleUpdate, mode, persistBasicInfo]);

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

  const headlessProps: HeadlessMultiStepDialogProps<ShapeDraftData> = {
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
      <HeadlessMultiStepDialog<ShapeDraftData> {...headlessProps} />
    </div>
  );
};

ShapeDialogHost.displayName = 'ShapeDialogHost';
