import type React from 'react';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { NodeId, TreeNodeMetadata } from '@hierarchidb/common-types';
import { Box, Typography } from '@mui/material';
import type { ResolverEntity, ResolverUpdaterPayload, SchemaInfo, PreviewConfig } from '../../common/types/index.js';
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
  type HeadlessDialogProps,
  type HeadlessHeaderRenderProps,
  type HeadlessFooterRenderProps,
  type StepNavigationEvent,
  type StepComponentDescriptor,
  type StepComponentProps,
} from '@hierarchidb/ui-dialog';
import type { DialogDisplayMode, DialogSize as MultiStepDialogSize, DialogPosition as MultiStepDialogPosition } from '@hierarchidb/common-types';
import { readRuntimeMode } from '@hierarchidb/util';
import { BasicInfoStep as SharedBasicInfoStep, type BasicInfoData } from '@hierarchidb/ui-plugin-basic-info';
import {
  useTreeNodeUpdater,
  type TreeNodeUpdaterState,
  createTreeNodeUpdaterActions,
} from '@hierarchidb/plugin-ui-sdk';
import { getWorkerClientHook, type WorkerClientRef } from '@hierarchidb/ui-worker-provider';
import { useTranslation } from '../../common/i18n/index.js';

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

const PlaceholderStepComponent: React.FC<StepComponentProps<ResolverUpdaterPayload>> = () => null;

export interface ResolverDialogProps {
  open: boolean;
  nodeId: NodeId;
  onClose: () => void;
  onSave: (entity: ResolverUpdaterPayload) => Promise<void>;
  onCancel: () => void;
  mode: 'create' | 'edit';
}

export const ResolverDialog: React.FC<ResolverDialogProps> = ({
  open,
  nodeId,
  onClose,
  onSave,
  onCancel,
  mode
}) => {
  const createDefaultDraft = useCallback(
    (): ResolverUpdaterPayload => ({
      treeNodeId: nodeId,
      draftMetadata: { name: '', description: '', tags: [] },
      draftData: {
        sourceSchema: null,
        targetSchema: null,
        mappingRules: [],
        validationRules: [],
        duplicateResolution: { strategy: 'ignore' },
        dataTransformations: [],
        previewConfig: { ...DEFAULT_PREVIEW_CONFIG },
      },
    }),
    [nodeId],
  );

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
  } = useTreeNodeUpdater<ResolverEntity>({
    mode,
    nodeType: 'resolver',
    nodeId,
    parentId: nodeId,
    workerClient,
  });

  const toResolverUpdaterPayload = useCallback(
    (raw: TreeNodeUpdaterState<ResolverEntity> | null): ResolverUpdaterPayload => {
      const draftData = (raw?.draftData ?? {}) as Partial<ResolverEntity>;
      const meta = (raw?.draftMetadata ?? { name: '', description: '', tags: [] }) as {
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
        treeNodeId: raw?.treeNodeId ?? nodeId,
        draftMetadata: {
          name: meta.name ?? '',
          description: meta.description ?? '',
          tags,
        },
        draftData: {
          ...draftData,
          sourceSchema: resolveSchema(draftData.sourceSchema) ?? null,
          targetSchema: resolveSchema(draftData.targetSchema) ?? null,
          mappingRules: Array.isArray(draftData.mappingRules)
            ? (draftData.mappingRules as ResolverEntity['mappingRules'])
            : [],
          validationRules: Array.isArray(draftData.validationRules)
            ? (draftData.validationRules as ResolverEntity['validationRules'])
            : [],
          duplicateResolution:
            draftData.duplicateResolution && typeof draftData.duplicateResolution === 'object'
              ? draftData.duplicateResolution
              : { strategy: 'ignore' },
          dataTransformations: Array.isArray(draftData.dataTransformations)
            ? (draftData.dataTransformations as ResolverEntity['dataTransformations'])
            : [],
          previewConfig: draftData.previewConfig ?? { ...DEFAULT_PREVIEW_CONFIG },
        },
      };
    },
    [nodeId]
  );

  const [draft, setDraft] = useState<ResolverUpdaterPayload | null>(null);
  const initialDraft = useRef<ResolverUpdaterPayload | null>(null);
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
  const [dialogSize, setDialogSize] = useState<MultiStepDialogSize>(initialLayout.size);
  const [dialogPosition, setDialogPosition] = useState<MultiStepDialogPosition>(initialLayout.position);

  const dialogSizeRef = useRef(dialogSize);
  const dialogPositionRef = useRef(dialogPosition);

  const applyNormalizedState = useCallback((size: MultiStepDialogSize, position: MultiStepDialogPosition) => {
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
      setDraft(initialDraft.current);
    }
  }, [open]);

  useEffect(() => {
    if(! nodeId){
      return;
    }
      setDraft({ treeNodeId: nodeId, draftMetadata: draft?.draftMetadata ?? null, draftData: draft?.draftData ?? null });
      setSourceSchema(draft?.draftData?.sourceSchema ?? null);
      setTargetSchema(draft?.draftData?.targetSchema ?? null);
      initialDraft.current = draft;
      return;
    /*
    if (wcDraft) {
      const normalized = toResolverUpdaterPayload(wcDraft);
      setDraft(normalized);
      setSourceSchema(normalized.draftData?.sourceSchema ?? null);
      setTargetSchema(normalized.draftData?.targetSchema ?? null);
      initialDraft.current = normalized;
      return;
    }
    const copy = createDefaultDraft();
    setDraft(copy);
    setSourceSchema(copy.draftData?.sourceSchema ?? null);
    setTargetSchema(copy.draftData?.targetSchema ?? null);
    initialDraft.current = copy;
  */
  }, [createDefaultDraft, draft, nodeId, toResolverUpdaterPayload, wcDraft]);

  const execUpdateDraft = useCallback(
    (updates: Partial<ResolverUpdaterPayload>) => {
      setDraft((prev) => {
        const base = prev ?? initialDraft.current ?? createDefaultDraft();
        const baseMetadata = base.draftMetadata ?? { name: '', description: '', tags: [] };
        const baseData = base.draftData ?? {
          sourceSchema: null,
          targetSchema: null,
          mappingRules: [],
          validationRules: [],
          duplicateResolution: { strategy: 'ignore' },
          dataTransformations: [],
          previewConfig: { ...DEFAULT_PREVIEW_CONFIG },
        };
        const merged: ResolverUpdaterPayload = {
          treeNodeId: updates.treeNodeId ?? base.treeNodeId,
          draftMetadata: {
            ...baseMetadata,
            ...(updates.draftMetadata ?? {}),
          },
          draftData: {
            ...baseData,
            ...(updates.draftData ?? {}),
          },
        };
        void updateDraft({
          treeNodeId: merged.treeNodeId,
          draftMetadata: merged.draftMetadata as TreeNodeMetadata,
          draftData: merged.draftData as ResolverEntity,
        });
        return merged;
      });
    },
    [createDefaultDraft, updateDraft],
  );

  const { updateMetadata } = useMemo(
    () => createTreeNodeUpdaterActions<ResolverEntity>((updates) =>
      execUpdateDraft({ draftData: updates } as Partial<ResolverUpdaterPayload>)
    ),
    [execUpdateDraft],
  );

  const fallbackDraft = useMemo<ResolverUpdaterPayload>(() => {
    const base = draft ?? initialDraft.current ?? createDefaultDraft();
    return {
      treeNodeId: base.treeNodeId,
      draftMetadata: base.draftMetadata ?? { name: '', description: '', tags: [] },
      draftData: base.draftData ?? {
        sourceSchema: null,
        targetSchema: null,
        mappingRules: [],
        validationRules: [],
        duplicateResolution: { strategy: 'ignore' },
        dataTransformations: [],
        previewConfig: { ...DEFAULT_PREVIEW_CONFIG },
      },
    };
  }, [createDefaultDraft, draft]);

  const handleSave = useCallback(async () => {
    if (isSaving) return;
    setIsSaving(true);
    try {
      const current = draft ?? initialDraft.current;
      if (current) {
        const draftMetadata = current.draftMetadata ?? { name: '', description: '', tags: [] };
        const draftData = current.draftData ?? {
          sourceSchema: null,
          targetSchema: null,
          mappingRules: [],
          validationRules: [],
          duplicateResolution: { strategy: 'ignore' },
          dataTransformations: [],
          previewConfig: { ...DEFAULT_PREVIEW_CONFIG },
        };
        await saveDraft({
          treeNodeId: current.treeNodeId,
          draftMetadata: draftMetadata as TreeNodeMetadata,
          draftData: draftData as ResolverEntity,
        });
        await onSave({
          ...current,
          draftMetadata,
          draftData,
        });
      }
      onClose();
    } catch (error) {
      console.error('Failed to save Resolver:', error);
    } finally {
      setIsSaving(false);
    }
  }, [draft, isSaving, onClose, onSave, saveDraft]);

  const handleCancel = useCallback(() => {
    const initial = initialDraft.current ?? createDefaultDraft();
    setDraft(initial);
    setSourceSchema(initial?.draftData?.sourceSchema ?? null);
    setTargetSchema(initial?.draftData?.targetSchema ?? null);
    void discardDraft().catch(() => {});
    onCancel();
  }, [createDefaultDraft, discardDraft, onCancel]);

  const basicInfoValidationError = useMemo(() => {
    const name = fallbackDraft.draftMetadata?.name ?? '';
    if (!name.trim()) return 'Name is required';
    if (name.length > 100) return 'Name must be 100 characters or less';
    if (fallbackDraft.draftMetadata?.description && fallbackDraft.draftMetadata.description.length > 500) {
      return 'Description must be 500 characters or less';
    }
    return null;
  }, [fallbackDraft.draftMetadata?.description, fallbackDraft.draftMetadata?.name]);

  const handleBasicInfoChange = useCallback(
    (value: BasicInfoData) => {
      updateMetadata(
        {
          name: value.name,
          description: value.description ?? '',
          tags: value.tags ?? [],
        },
        fallbackDraft.draftMetadata ?? { name: '', description: '', tags: [] },
      );
    },
    [fallbackDraft.draftMetadata, updateMetadata],
  );

  const { t } = useTranslation();
  const steps = useMemo((): ResolverDialogStep[] => {
    const currentDraft = fallbackDraft;
    return [
    {
      id: '1',
      label: t('steps.basicInfo.label', 'Basic Information'),
      component: (
        <Box sx={{ maxWidth: 600 }}>
          <Typography variant="h6" gutterBottom>
            {t('basicInfo.title', 'Basic Information')}
          </Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
            {t('basicInfo.description', 'Provide basic information for your property resolver configuration.')}
          </Typography>
          <SharedBasicInfoStep
            mode={mode}
          name={currentDraft?.draftMetadata?.name ?? ''}
          description={currentDraft?.draftMetadata?.description ?? ''}
          tags={currentDraft?.draftMetadata?.tags ?? []}
          onChange={handleBasicInfoChange}
          validate={() => basicInfoValidationError}
        />
          <Box sx={{ mt: 2, p: 2, bgcolor: 'info.main', color: 'info.contrastText', borderRadius: 1 }}>
            <Typography variant="subtitle2" sx={{ mb: 1 }}>
              {t('basicInfo.whatIs', 'What is Property Resolver?')}
            </Typography>
            <Typography variant="body2">
              {t(
                'basicInfo.about',
                'Property Resolver allows you to create mapping rules between different data schemas. It\'s useful when you need to transform data properties from one format to another, validate data integrity, handle duplicates, and preview the mapping results.'
              )}
            </Typography>
          </Box>
        </Box>
      ),
      validate: async () => !basicInfoValidationError,
    },
    {
      id: '2',
      label: t('steps.schemaSelection.label', 'Schema Selection'),
      component: (
        <SchemaSelectionStep
          data={currentDraft}
          onUpdate={execUpdateDraft}
          onValidationChange={() => {}}
          onSourceSchemaChange={setSourceSchema}
          onTargetSchemaChange={setTargetSchema}
        />
      ),
      validate: async () => Boolean(currentDraft?.draftData?.sourceSchema) && Boolean(currentDraft?.draftData?.targetSchema),
    },
    {
      id: '3',
      label: t('steps.propertyMapping.label', 'Property Mapping'),
      component: (
        <PropertyMappingStep
          data={currentDraft}
          onUpdate={execUpdateDraft}
          onValidationChange={() => {}}
          sourceSchema={sourceSchema}
          targetSchema={targetSchema}
        />
      ),
      validate: async () => Array.isArray(currentDraft?.draftData?.mappingRules),
    },
    {
      id: '4',
      label: t('steps.validationRules.label', 'Validation Rules'),
      component: (
        <ValidationConfigStep
          data={currentDraft}
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
      label: t('steps.duplicateResolution.label', 'Duplicate Resolution'),
      component: (
        <DuplicateResolutionStep
          data={currentDraft}
          onUpdate={execUpdateDraft}
          onValidationChange={() => {}}
        />
      ),
      validate: async () => Boolean(currentDraft?.draftData?.duplicateResolution),
    },
    {
      id: '6',
      label: t('steps.previewTest.label', 'Preview & Test'),
      component: (
        <PreviewTestStep
          data={currentDraft}
          onUpdate={execUpdateDraft}
          onValidationChange={() => {}}
          sourceSchema={sourceSchema}
          targetSchema={targetSchema}
          onValidationResult={() => {}}
        />
      ),
      validate: async () => true,
    },
  ];
  }, [fallbackDraft, t, mode, handleBasicInfoChange, execUpdateDraft, sourceSchema, targetSchema, basicInfoValidationError]);

  const filledSteps = useMemo(() => [
    !basicInfoValidationError,
    Boolean(fallbackDraft.draftData?.sourceSchema) && Boolean(fallbackDraft.draftData?.targetSchema),
    Array.isArray(fallbackDraft.draftData?.mappingRules),
    true,
    Boolean(fallbackDraft.draftData?.duplicateResolution),
    true,
  ], [basicInfoValidationError, fallbackDraft.draftData]);

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

  const renderHeader: HeadlessDialogProps<ResolverUpdaterPayload>['renderHeader'] = useCallback((props: HeadlessHeaderRenderProps<ResolverUpdaterPayload>) => (
    <header style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '12px 16px', borderBottom: '1px solid #dde1eb' }}>
      <div>
        <strong>{t('header.title', 'Resolver Configuration')}</strong>
        <div style={{ fontSize: 12, color: '#64748b' }}>
          {t('header.stepCounter', 'Step {{current}} / {{total}}', { current: props.activeStepIndex + 1, total: steps.length })}
        </div>
      </div>
      <div style={{ display: 'flex', gap: 8 }}>
        <button type="button" onClick={() => handleNavigation({ type: 'back' })} disabled={props.activeStepIndex === 0}>{t('buttons.back', 'Back')}</button>
        <button type="button" onClick={() => handleNavigation({ type: 'next' })} disabled={props.activeStepIndex >= steps.length - 1}>{t('buttons.next', 'Next')}</button>
      </div>
    </header>
  ), [handleNavigation, steps.length, t]);

  const isTestEnv = useMemo(() => readRuntimeMode() === 'test', []);

  const renderFooter: HeadlessDialogProps<ResolverUpdaterPayload>['renderFooter'] = useCallback((props: HeadlessFooterRenderProps<ResolverUpdaterPayload>) => {
    const canSave = filledSteps.every(Boolean) && !isSaving;

    return (
      <footer style={{ padding: '12px 16px', display: 'flex', justifyContent: 'space-between', borderTop: '1px solid #dde1eb' }}>
        <button type="button" onClick={() => props.onRequestClose?.('close')} disabled={isSaving}>{t('buttons.cancel', 'Cancel')}</button>
        <button type="button" onClick={() => props.onRequestCommit?.()} disabled={!canSave}>{t('buttons.save', 'Save')}</button>
        {isTestEnv && (
          <div style={{ position: 'absolute', width: 1, height: 1, overflow: 'hidden', clip: 'rect(0 0 0 0)' }}>
            {/* Hidden controls for Vitest: see docs/testing/resolver-dialog-headless-e2e.md */}
            <button aria-label="Next" onClick={() => handleNavigation({ type: 'next' })}>{t('buttons.next', 'Next')}</button>
            <button aria-label="Complete" onClick={() => props.onRequestCommit?.()}>{t('buttons.save', 'Save')}</button>
            <button aria-label="Cancel" onClick={() => props.onRequestClose?.('close')}>{t('buttons.cancel', 'Cancel')}</button>
          </div>
        )}
      </footer>
    );
  }, [filledSteps, handleNavigation, isSaving, isTestEnv, t]);

  const invalidMessageMap = useMemo<Record<string, string>>(() => ({}), []);

  const transitionDisplayMode = useCallback((mode: DialogDisplayMode) => {
    const viewport = getViewportSize();

    if (mode === 'full-screen') {
      const size: MultiStepDialogSize = {
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

  const handleSizeChange = useCallback((next?: MultiStepDialogSize) => {
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

  const handlePositionChange = useCallback((next?: MultiStepDialogPosition) => {
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

  const stepDescriptors = useMemo<ReadonlyArray<StepComponentDescriptor<ResolverUpdaterPayload>>>(() => (
    steps.map(step => ({ id: step.id, label: step.label ?? step.id, component: PlaceholderStepComponent }))
  ), [steps]);

  const headlessProps: HeadlessDialogProps<ResolverUpdaterPayload> = {
    open,
    stepComponents: stepDescriptors,
    stepData: fallbackDraft,
    onStepDataChange: (patch) => execUpdateDraft(patch as Partial<ResolverUpdaterPayload>),
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
      <HeadlessMultiStepDialog<ResolverUpdaterPayload> {...headlessProps} />
    </div>
  );
};

ResolverDialog.displayName = 'ResolverDialog';
