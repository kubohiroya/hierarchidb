import type React from 'react';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { NodeId } from '@hierarchidb/common-types';
import { Box, FormHelperText, Typography } from '@mui/material';
import type { ResolverEntity, ResolverDraftEntity, SchemaInfo, PreviewConfig } from '../../common/types/index.js';
import { SchemaSelectionStep } from './steps/SchemaSelectionStep.js';
import { PropertyMappingStep } from './steps/PropertyMappingStep.js';
import { ValidationConfigStep } from './steps/ValidationConfigStep.js';
import { DuplicateResolutionStep } from './steps/DuplicateResolutionStep.js';
import { PreviewTestStep } from './steps/PreviewTestStep.js';
import {
  HeadlessMultiStepDialog,
  FRAME_CONSTANTS,
  getViewportSize,
  getPresetSize,
  normalizeDialogState,
  initialPosition,
  sizesEqual,
  positionsEqual,
  type HeadlessMultiStepDialogProps,
  type HeadlessHeaderRenderProps,
  type HeadlessContentRenderProps,
  type HeadlessFooterRenderProps,
  type StepNavigationEvent,
  type StepComponentDescriptor,
  type StepComponentProps,
  type DialogDisplayMode,
  type MultiDialogSize,
  type MultiDialogPosition,
} from '@hierarchidb/ui-dialog';
import { readRuntimeMode } from '@hierarchidb/util';
import { BasicInfoStep as SharedBasicInfoStep, type BasicInfoData } from '@hierarchidb/ui-plugin-basic-info';
import { useDialogDraft, type DraftData } from '@hierarchidb/plugin-ui-sdk';
import { getWorkerClientHook, type WorkerClientRef } from '@hierarchidb/ui-worker-provider';

type ResolverDialogStep = {
  id: string;
  label: string;
  component: React.ReactNode;
  validate?: () => Promise<boolean>;
};

const DEFAULT_PREVIEW_CONFIG: PreviewConfig = {
  sampleSize: 100,
  refreshInterval: 1000,
  highlightMappings: true,
  showValidationErrors: true,
};

const PlaceholderStepComponent: React.FC<StepComponentProps<Partial<ResolverDraftEntity>>> = () => null;

export interface ResolverDialogProps {
  open: boolean;
  nodeId: NodeId;
  entity?: ResolverEntity;
  onClose: () => void;
  onSave: (entity: Partial<ResolverDraftEntity>) => Promise<void>;
  onCancel: () => void;
}

const STEPS = ['Basic Information', 'Schema Selection', 'Property Mapping', 'Validation Rules', 'Duplicate Resolution', 'Preview & Test'];

export const ResolverDialog: React.FC<ResolverDialogProps> = ({
  open,
  nodeId,
  entity,
  onClose,
  onSave,
  onCancel,
}) => {
  const workerClient = useMemo<WorkerClientRef | null>(() => {
    try {
      const hook = getWorkerClientHook<WorkerClientRef | null>();
      return hook();
    } catch {
      return null;
    }
  }, []);

  const {
    draft: wcDraft,
    updateDraft,
    saveDraft,
    discardDraft,
  } = useDialogDraft<ResolverEntity>({
    mode: entity ? 'edit' : 'create',
    nodeType: 'resolver',
    nodeId,
    parentId: nodeId,
    workerClient,
  });

  const normalizeDraft = useCallback(
    (raw: DraftData<ResolverEntity> | null): Partial<ResolverDraftEntity> => {
      const draftData =
        (raw?.draftData && typeof raw.draftData === 'object' ? raw.draftData : undefined) as
          | Record<string, unknown>
          | undefined;

      const meta = (raw?.draftMetadata ?? raw?.metadata ?? { name: '', description: '', tags: [] }) as {
        name?: string;
        description?: string;
        tags?: unknown;
      };
      const tags = Array.isArray(meta.tags) ? meta.tags.filter((t): t is string => typeof t === 'string') : [];

      const resolveSchema = (value: unknown): SchemaInfo | null => {
        if (value && typeof value === 'object') {
          const schema = value as Partial<SchemaInfo>;
          if (Array.isArray(schema.properties) && typeof schema.name === 'string') {
            return {
              name: schema.name,
              properties: schema.properties as SchemaInfo['properties'],
              sampleData: schema.sampleData,
            };
          }
        }
        return null;
      };

      return {
        nodeId,
        name: meta.name ?? '',
        description: meta.description ?? '',
        tags,
        sourceSchema: resolveSchema(draftData?.sourceSchema),
        targetSchema: resolveSchema(draftData?.targetSchema),
        mappingRules: (draftData?.mappingRules as ResolverDraftEntity['mappingRules']) ?? [],
        validationRules: (draftData?.validationRules as ResolverDraftEntity['validationRules']) ?? [],
        duplicateResolution:
          (draftData?.duplicateResolution as ResolverDraftEntity['duplicateResolution']) ?? {
            strategy: 'ignore',
          },
        dataTransformations:
          (draftData?.dataTransformations as ResolverDraftEntity['dataTransformations']) ?? [],
        previewConfig:
          (draftData?.previewConfig as ResolverDraftEntity['previewConfig']) ?? {
            ...DEFAULT_PREVIEW_CONFIG,
          },
      };
    },
    [nodeId]
  );

  const [draft, setDraft] = useState<Partial<ResolverDraftEntity>>({});
  const initialDraft = useRef<Partial<ResolverDraftEntity> | null>(null);
  const [sourceSchema, setSourceSchema] = useState<SchemaInfo | null>(null);
  const [targetSchema, setTargetSchema] = useState<SchemaInfo | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [activeStepIndex, setActiveStepIndex] = useState(0);
  const viewportOnMount = getViewportSize();
  const defaultSize = getPresetSize('normal', viewportOnMount);
  const initialLayout = normalizeDialogState(
    defaultSize,
    initialPosition(defaultSize, viewportOnMount),
    viewportOnMount,
    { enforceTopLeftMargin: true },
  );

  const [displayMode, setDisplayModeState] = useState<DialogDisplayMode>('normal');
  const [dialogSize, setDialogSize] = useState<MultiDialogSize>(initialLayout.size);
  const [dialogPosition, setDialogPosition] = useState<MultiDialogPosition>(initialLayout.position);

  const dialogSizeRef = useRef(dialogSize);
  const dialogPositionRef = useRef(dialogPosition);

  const applyNormalizedState = useCallback((size: MultiDialogSize, position: MultiDialogPosition) => {
    dialogSizeRef.current = size;
    dialogPositionRef.current = position;
    setDialogSize(size);
    setDialogPosition(position);
  }, [setDialogPosition, setDialogSize]);

  useEffect(() => {
    dialogSizeRef.current = dialogSize;
  }, [dialogSize]);

  useEffect(() => {
    dialogPositionRef.current = dialogPosition;
  }, [dialogPosition]);

  useEffect(() => {
    if (!open) {
      setActiveStepIndex(0);
      setDraft(initialDraft.current ?? {});
    }
  }, [open]);

  useEffect(() => {
    if (entity) {
      const copy: Partial<ResolverDraftEntity> = {
        ...entity,
        mappingRules: entity.mappingRules.map((rule) => ({ ...rule })),
        validationRules: entity.validationRules.map((rule) => ({ ...rule })),
        duplicateResolution: entity.duplicateResolution ? { ...entity.duplicateResolution } : { strategy: 'ignore' },
        dataTransformations: entity.dataTransformations.map((transformation) => ({ ...transformation })),
        previewConfig: entity.previewConfig ? { ...entity.previewConfig } : { ...DEFAULT_PREVIEW_CONFIG },
      };
      setDraft(copy);
      setSourceSchema(copy.sourceSchema ?? null);
      setTargetSchema(copy.targetSchema ?? null);
      initialDraft.current = copy;
    } else if (wcDraft) {
      const normalized = normalizeDraft(wcDraft);
      setDraft(normalized);
      setSourceSchema(normalized.sourceSchema ?? null);
      setTargetSchema(normalized.targetSchema ?? null);
      initialDraft.current = normalized;
    } else {
      const copy: Partial<ResolverDraftEntity> = {
        nodeId,
        name: '',
        description: '',
        sourceSchema: null,
        targetSchema: null,
        mappingRules: [],
        validationRules: [],
        duplicateResolution: { strategy: 'ignore' },
        dataTransformations: [],
        previewConfig: { ...DEFAULT_PREVIEW_CONFIG },
      };
      setDraft(copy);
      setSourceSchema(null);
      setTargetSchema(null);
      initialDraft.current = copy;
    }
  }, [entity, nodeId, normalizeDraft, wcDraft]);

  const execUpdateDraft = useCallback((updates: Partial<ResolverDraftEntity>) => {
    setDraft((prev: Partial<ResolverDraftEntity>) => ({ ...prev, ...updates }));
    const draftMetadata = {
      name: updates.name ?? draft?.name ?? '',
      description: updates.description ?? draft?.description,
      tags: updates.tags ?? draft?.tags ?? [],
    };
    const draftData: Record<string, unknown> = {
      ...(typeof wcDraft?.draftData === 'object' ? (wcDraft?.draftData as Record<string, unknown>) : {}),
      ...updates,
      sourceSchema: updates.sourceSchema ?? draft?.sourceSchema ?? null,
      targetSchema: updates.targetSchema ?? draft?.targetSchema ?? null,
    };
    void updateDraft({
      draftMetadata,
      draftData,
    } as Partial<DraftData<ResolverEntity>>);
  }, [draft, updateDraft, wcDraft]);

  const handleSave = useCallback(async () => {
    if (isSaving) return;
    setIsSaving(true);
    try {
      await saveDraft();
      await onSave(draft);
      onClose();
    } catch (error) {
      console.error('Failed to save Resolver:', error);
    } finally {
      setIsSaving(false);
    }
  }, [isSaving, draft, onSave, onClose, saveDraft]);

  const handleCancel = useCallback(() => {
    const initial = initialDraft.current ?? {};
    setDraft(initial);
    setSourceSchema((initial as Partial<ResolverDraftEntity>)?.sourceSchema ?? null);
    setTargetSchema((initial as Partial<ResolverDraftEntity>)?.targetSchema ?? null);
    void discardDraft().catch(() => {});
    onCancel();
  }, [discardDraft, onCancel]);

  const basicInfoMode: 'create' | 'edit' = entity ? 'edit' : 'create';

  const basicInfoValidationError = useMemo(() => {
    const name = draft?.name ?? '';
    if (!name.trim()) return 'Name is required';
    if (name.length > 100) return 'Name must be 100 characters or less';
    if (draft?.description && draft.description.length > 500) {
      return 'Description must be 500 characters or less';
    }
    return null;
  }, [draft?.description, draft?.name]);

  const handleBasicInfoChange = useCallback(
    (value: BasicInfoData) => {
      execUpdateDraft({
        name: value.name,
        description: value.description,
        tags: value.tags,
      });
    },
    [execUpdateDraft],
  );

  const steps = useMemo((): ResolverDialogStep[] => [
    {
      id: '1',
      label: STEPS[0]!,
      component: (
        <Box sx={{ maxWidth: 600 }}>
          <Typography variant="h6" gutterBottom>
            Basic Information
          </Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
            Provide basic information for your property resolver configuration.
          </Typography>
          <SharedBasicInfoStep
            name={draft?.name ?? ''}
            description={draft?.description ?? ''}
            tags={draft?.tags ?? []}
            mode={basicInfoMode}
            validate={({ name, description }: BasicInfoData) => {
              if (!name.trim()) return 'Name is required';
              if (name.length > 100) return 'Name must be 100 characters or less';
              if (description && description.length > 500) {
                return 'Description must be 500 characters or less';
              }
              return null;
            }}
            onChange={handleBasicInfoChange}
          />
          <FormHelperText error={Boolean(basicInfoValidationError)} sx={{ mt: 1 }}>
            {basicInfoValidationError ?? ' '}
          </FormHelperText>
          <Box sx={{ mt: 2, p: 2, bgcolor: 'info.main', color: 'info.contrastText', borderRadius: 1 }}>
            <Typography variant="subtitle2" sx={{ mb: 1 }}>
              What is Property Resolver?
            </Typography>
            <Typography variant="body2">
              Property Resolver allows you to create mapping rules between different data schemas.
              It&apos;s useful when you need to transform data properties from one format to another,
              validate data integrity, handle duplicates, and preview the mapping results.
            </Typography>
          </Box>
        </Box>
      ),
      validate: async () => !basicInfoValidationError,
    },
    {
      id: '2',
      label: STEPS[1]!,
      component: (
        <SchemaSelectionStep
          data={draft}
          onUpdate={execUpdateDraft}
          onValidationChange={() => {}}
          onSourceSchemaChange={setSourceSchema}
          onTargetSchemaChange={setTargetSchema}
        />
      ),
      validate: async () => Boolean(draft?.sourceSchema) && Boolean(draft?.targetSchema),
    },
    {
      id: '3',
      label: STEPS[2]!,
      component: (
        <PropertyMappingStep
          data={draft}
          onUpdate={execUpdateDraft}
          onValidationChange={() => {}}
          sourceSchema={sourceSchema}
          targetSchema={targetSchema}
        />
      ),
      validate: async () => Array.isArray(draft?.mappingRules),
    },
    {
      id: '4',
      label: STEPS[3]!,
      component: (
        <ValidationConfigStep
          data={draft}
          onUpdate={execUpdateDraft}
          onValidationChange={() => {}}
          sourceSchema={sourceSchema}
          targetSchema={targetSchema}
        />
      ),
      validate: async () => true,
    },
    {
      id: '5',
      label: STEPS[4]!,
      component: (
        <DuplicateResolutionStep
          data={draft}
          onUpdate={execUpdateDraft}
          onValidationChange={() => {}}
        />
      ),
      validate: async () => Boolean(draft?.duplicateResolution),
    },
    {
      id: '6',
      label: STEPS[5]!,
      component: (
        <PreviewTestStep
          data={draft}
          onUpdate={execUpdateDraft}
          onValidationChange={() => {}}
          sourceSchema={sourceSchema}
          targetSchema={targetSchema}
          onValidationResult={() => {}}
        />
      ),
      validate: async () => true,
    },
  ], [draft, basicInfoMode, handleBasicInfoChange, basicInfoValidationError, execUpdateDraft, sourceSchema, targetSchema]);

  const filledSteps = useMemo(() => [
    !basicInfoValidationError,
    Boolean(draft?.sourceSchema) && Boolean(draft?.targetSchema),
    Array.isArray(draft?.mappingRules),
    true,
    Boolean(draft?.duplicateResolution),
    true,
  ], [basicInfoValidationError, draft]);

  const enabledMatrix = useMemo(() => [
    true,
    filledSteps[0],
    filledSteps[1],
    filledSteps[2],
    filledSteps[3],
    filledSteps[4],
  ], [filledSteps]);

  const enabledStepIndices = useMemo(() => enabledMatrix
    .map((allow, idx) => (allow ? idx : -1))
    .filter((idx) => idx >= 0), [enabledMatrix]);

  const validatedStepIndices = useMemo(() => filledSteps
    .map((valid, idx) => (valid ? idx : -1))
    .filter((idx) => idx >= 0), [filledSteps]);

  const committableStepIndices = useMemo(() => (steps.length ? [steps.length - 1] : []), [steps.length]);

  const handleNavigation = useCallback((event: StepNavigationEvent) => {
    switch (event.type) {
      case 'direct':
        setActiveStepIndex(event.targetIndex);
        break;
      case 'next':
        setActiveStepIndex(prev => Math.min(prev + 1, steps.length - 1));
        break;
      case 'back':
        setActiveStepIndex(prev => Math.max(prev - 1, 0));
        break;
    }
  }, [steps.length]);

  const handleCommit = useCallback(async () => {
    await handleSave();
  }, [handleSave]);

  const renderHeader: HeadlessMultiStepDialogProps<Partial<ResolverDraftEntity>>['renderHeader'] = useCallback((props: HeadlessHeaderRenderProps<Partial<ResolverDraftEntity>>) => (
    <header style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '12px 16px', borderBottom: '1px solid #dde1eb' }}>
      <div>
        <strong>Resolver Configuration</strong>
        <div style={{ fontSize: 12, color: '#64748b' }}>
          Step {props.activeStepIndex + 1} / {steps.length}
        </div>
      </div>
      <div style={{ display: 'flex', gap: 8 }}>
        <button type="button" onClick={() => handleNavigation({ type: 'back' })} disabled={props.activeStepIndex === 0}>Back</button>
        <button type="button" onClick={() => handleNavigation({ type: 'next' })} disabled={props.activeStepIndex >= steps.length - 1}>Next</button>
      </div>
    </header>
  ), [handleNavigation, steps.length]);

  const renderContent: HeadlessMultiStepDialogProps<Partial<ResolverDraftEntity>>['renderContent'] = useCallback((props: HeadlessContentRenderProps<Partial<ResolverDraftEntity>>) => (
    <div style={{ padding: 16 }}>
      {steps[props.activeStepIndex]?.component}
    </div>
  ), [steps]);

  const isTestEnv = useMemo(() => readRuntimeMode() === 'test', []);

  const renderFooter: HeadlessMultiStepDialogProps<Partial<ResolverDraftEntity>>['renderFooter'] = useCallback((props: HeadlessFooterRenderProps<Partial<ResolverDraftEntity>>) => {
    const canSave = filledSteps.every(Boolean) && !isSaving;

    return (
      <footer style={{ padding: '12px 16px', display: 'flex', justifyContent: 'space-between', borderTop: '1px solid #dde1eb' }}>
        <button type="button" onClick={() => props.onRequestClose?.('close')} disabled={isSaving}>Cancel</button>
        <button type="button" onClick={() => props.onRequestCommit?.()} disabled={!canSave}>Save</button>
        {isTestEnv && (
          <div style={{ position: 'absolute', width: 1, height: 1, overflow: 'hidden', clip: 'rect(0 0 0 0)' }}>
            {/* Hidden controls for Vitest: see docs/testing/resolver-dialog-headless-e2e.md */}
            <button aria-label="Next" onClick={() => handleNavigation({ type: 'next' })}>Next</button>
            <button aria-label="Complete" onClick={() => props.onRequestCommit?.()}>Complete</button>
            <button aria-label="Cancel" onClick={() => props.onRequestClose?.('close')}>Cancel</button>
          </div>
        )}
      </footer>
    );
  }, [filledSteps, handleNavigation, isSaving, isTestEnv]);

  const invalidMessageMap = useMemo<Record<string, string>>(() => ({}), []);

  const transitionDisplayMode = useCallback((mode: DialogDisplayMode) => {
    const viewport = getViewportSize();

    if (mode === 'full-screen') {
      const size: MultiDialogSize = {
        width: Math.max(viewport.width, FRAME_CONSTANTS.MIN_DIALOG_WIDTH),
        height: Math.max(viewport.height, FRAME_CONSTANTS.MIN_DIALOG_HEIGHT),
      };
      applyNormalizedState(size, { x: 0, y: 0 });
    } else if (mode === 'maximize') {
      const preset = getPresetSize('maximize', viewport);
      const normalized = normalizeDialogState(preset, {
        x: FRAME_CONSTANTS.NON_STANDARD_MARGIN,
        y: FRAME_CONSTANTS.NON_STANDARD_MARGIN,
      }, viewport, {
        enforceTopLeftMargin: false,
        minPosition: FRAME_CONSTANTS.NON_STANDARD_MARGIN,
        clampSizeToViewport: true,
      });
      applyNormalizedState(normalized.size, normalized.position);
    } else {
      const preset = getPresetSize('normal', viewport);
      const normalized = normalizeDialogState(preset, initialPosition(preset, viewport), viewport, {
        enforceTopLeftMargin: true,
      });
      applyNormalizedState(normalized.size, normalized.position);
    }

    setDisplayModeState(mode);
  }, [applyNormalizedState, setDisplayModeState]);

  useEffect(() => {
    if (typeof window === 'undefined') return;

    let rafId: number | null = null;

    const normalize = () => {
      rafId = null;
      const viewport = getViewportSize();
      let targetSize = dialogSizeRef.current;
      let targetPosition = dialogPositionRef.current;
      let options = {
        enforceTopLeftMargin: displayMode === 'normal',
        minPosition: displayMode === 'normal' ? 0 : FRAME_CONSTANTS.NON_STANDARD_MARGIN,
        clampSizeToViewport: true,
      };

      if (displayMode === 'full-screen') {
        targetSize = {
          width: Math.max(viewport.width, FRAME_CONSTANTS.MIN_DIALOG_WIDTH),
          height: Math.max(viewport.height, FRAME_CONSTANTS.MIN_DIALOG_HEIGHT),
        };
        targetPosition = { x: 0, y: 0 };
        options = {
          enforceTopLeftMargin: false,
          minPosition: 0,
          clampSizeToViewport: false,
        };
      } else if (displayMode === 'maximize') {
        targetSize = getPresetSize('maximize', viewport);
        targetPosition = { x: FRAME_CONSTANTS.NON_STANDARD_MARGIN, y: FRAME_CONSTANTS.NON_STANDARD_MARGIN };
        options = {
          enforceTopLeftMargin: false,
          minPosition: FRAME_CONSTANTS.NON_STANDARD_MARGIN,
          clampSizeToViewport: true,
        };
      }

      const normalized = normalizeDialogState(targetSize, targetPosition, viewport, options);
      if (!sizesEqual(dialogSizeRef.current, normalized.size) || !positionsEqual(dialogPositionRef.current, normalized.position)) {
        applyNormalizedState(normalized.size, normalized.position);
      }
    };

    const schedule = () => {
      if (rafId !== null) return;
      rafId = window.requestAnimationFrame(normalize);
    };

    window.addEventListener('resize', schedule, { passive: true });
    schedule();

    return () => {
      window.removeEventListener('resize', schedule);
      if (rafId !== null) {
        window.cancelAnimationFrame(rafId);
        rafId = null;
      }
    };
  }, [applyNormalizedState, displayMode]);

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
      applyNormalizedState(normalized.size, normalized.position);
    }
  }, [applyNormalizedState, displayMode]);

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
      applyNormalizedState(normalized.size, normalized.position);
    }
  }, [applyNormalizedState, displayMode]);

  const initialSnapshot = initialDraft.current;
  const isDirty = useMemo(() => {
    if (!initialSnapshot) return true;
    try {
      return JSON.stringify(initialSnapshot) !== JSON.stringify(draft);
    } catch {
      return true;
    }
  }, [draft, initialSnapshot]);

  const handleClose = useCallback((reason?: 'close' | 'discard') => {
    void reason;
    handleCancel();
  }, [handleCancel]);

  const stepDescriptors = useMemo<ReadonlyArray<StepComponentDescriptor<Partial<ResolverDraftEntity>>>>(() => (
    steps.map(step => ({ id: step.id, label: step.label ?? step.id, component: PlaceholderStepComponent }))
  ), [steps]);

  const headlessProps: HeadlessMultiStepDialogProps<Partial<ResolverDraftEntity>> = {
    open,
    stepComponents: stepDescriptors,
    stepData: draft,
    onStepDataChange: execUpdateDraft,
    activeStepIndex,
    onStepNavigate: handleNavigation,
    enabledStepIndices,
    validatedStepIndices,
    committableStepIndices,
    invalidMessageMap,
    onRequestClose: handleClose,
    onRequestCommit: handleCommit,
    isDirty,
    position: dialogPosition,
    onPositionChange: handlePositionChange,
    size: dialogSize,
    onSizeChange: handleSizeChange,
    displayMode,
    onDisplayModeChange: (mode) => { transitionDisplayMode(mode); },
    renderHeader,
    renderContent,
    renderFooter,
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
      <HeadlessMultiStepDialog<Partial<ResolverDraftEntity>> {...headlessProps} />
    </div>
  );
};

ResolverDialog.displayName = 'ResolverDialog';
