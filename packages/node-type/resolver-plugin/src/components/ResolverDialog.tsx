import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { NodeId } from '@hierarchidb/common-type';
import type { ResolverEntity, ResolverWorkingCopyEntity, SchemaInfo, PreviewConfig } from '../types/index.js';
import { ResolverBasicInfoStep } from './steps/ResolverBasicInfoStep.js';
import { SchemaSelectionStep } from './steps/SchemaSelectionStep.js';
import { PropertyMappingStep } from './steps/PropertyMappingStep.js';
import { ValidationConfigStep } from './steps/ValidationConfigStep.js';
import { DuplicateResolutionStep } from './steps/DuplicateResolutionStep.js';
import { PreviewTestStep } from './steps/PreviewTestStep.js';
import {
  HeadlessMultiStepDialog,
  type HeadlessMultiStepDialogProps,
  type HeadlessHeaderRenderProps,
  type HeadlessContentRenderProps,
  type HeadlessFooterRenderProps,
  type StepNavigationEvent,
  type StepComponentDescriptor,
  type StepComponentProps,
  type DialogDisplayMode,
} from '@hierarchidb/ui-dialog';
import { readRuntimeMode } from '@hierarchidb/util';

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

const PlaceholderStepComponent: React.FC<StepComponentProps<Partial<ResolverWorkingCopyEntity>>> = () => null;

export interface ResolverDialogProps {
  open: boolean;
  nodeId: NodeId;
  entity?: ResolverEntity;
  onClose: () => void;
  onSave: (entity: Partial<ResolverWorkingCopyEntity>) => Promise<void>;
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
  const [workingCopy, setWorkingCopy] = useState<Partial<ResolverWorkingCopyEntity>>({});
  const initialWorkingCopy = useRef<Partial<ResolverWorkingCopyEntity> | null>(null);
  const [sourceSchema, setSourceSchema] = useState<SchemaInfo | null>(null);
  const [targetSchema, setTargetSchema] = useState<SchemaInfo | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [activeStepIndex, setActiveStepIndex] = useState(0);
  const [displayMode, setDisplayModeState] = useState<DialogDisplayMode>('normal');

  useEffect(() => {
    if (!open) {
      setActiveStepIndex(0);
    }
  }, [open]);

  useEffect(() => {
    if (entity) {
      const copy: Partial<ResolverWorkingCopyEntity> = {
        ...entity,
        mappingRules: entity.mappingRules.map((rule) => ({ ...rule })),
        validationRules: entity.validationRules.map((rule) => ({ ...rule })),
        duplicateResolution: entity.duplicateResolution ? { ...entity.duplicateResolution } : { strategy: 'ignore' },
        dataTransformations: entity.dataTransformations.map((transformation) => ({ ...transformation })),
        previewConfig: entity.previewConfig ? { ...entity.previewConfig } : { ...DEFAULT_PREVIEW_CONFIG },
      };
      setWorkingCopy(copy);
      initialWorkingCopy.current = copy;
    } else {
      const copy: Partial<ResolverWorkingCopyEntity> = {
        nodeId,
        name: '',
        description: '',
        sourceSchema: '',
        targetSchema: '',
        mappingRules: [],
        validationRules: [],
        duplicateResolution: { strategy: 'ignore' },
        dataTransformations: [],
        previewConfig: { ...DEFAULT_PREVIEW_CONFIG },
      };
      setWorkingCopy(copy);
      initialWorkingCopy.current = copy;
    }
  }, [entity, nodeId]);

  const updateWorkingCopy = useCallback((updates: Partial<ResolverWorkingCopyEntity>) => {
    setWorkingCopy(prev => ({ ...prev, ...updates }));
  }, []);

  const handleSave = useCallback(async () => {
    if (isSaving) return;
    setIsSaving(true);
    try {
      await onSave(workingCopy);
      onClose();
    } catch (error) {
      console.error('Failed to save Resolver:', error);
    } finally {
      setIsSaving(false);
    }
  }, [isSaving, workingCopy, onSave, onClose]);

  const handleCancel = useCallback(() => {
    setWorkingCopy(initialWorkingCopy.current ?? {});
    setSourceSchema(null);
    setTargetSchema(null);
    onCancel();
  }, [onCancel]);

  const steps = useMemo((): ResolverDialogStep[] => [
    {
      id: '1',
      label: STEPS[0]!,
      component: (
        <ResolverBasicInfoStep
          data={workingCopy}
          onUpdate={updateWorkingCopy}
          onValidationChange={() => {}}
        />
      ),
      validate: async () => Boolean(workingCopy?.name?.trim()),
    },
    {
      id: '2',
      label: STEPS[1]!,
      component: (
        <SchemaSelectionStep
          data={workingCopy}
          onUpdate={updateWorkingCopy}
          onValidationChange={() => {}}
          onSourceSchemaChange={setSourceSchema}
          onTargetSchemaChange={setTargetSchema}
        />
      ),
      validate: async () => Boolean(workingCopy?.sourceSchema) && Boolean(workingCopy?.targetSchema),
    },
    {
      id: '3',
      label: STEPS[2]!,
      component: (
        <PropertyMappingStep
          data={workingCopy}
          onUpdate={updateWorkingCopy}
          onValidationChange={() => {}}
          sourceSchema={sourceSchema}
          targetSchema={targetSchema}
        />
      ),
      validate: async () => Array.isArray(workingCopy?.mappingRules),
    },
    {
      id: '4',
      label: STEPS[3]!,
      component: (
        <ValidationConfigStep
          data={workingCopy}
          onUpdate={updateWorkingCopy}
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
          data={workingCopy}
          onUpdate={updateWorkingCopy}
          onValidationChange={() => {}}
        />
      ),
      validate: async () => Boolean(workingCopy?.duplicateResolution),
    },
    {
      id: '6',
      label: STEPS[5]!,
      component: (
        <PreviewTestStep
          data={workingCopy}
          onUpdate={updateWorkingCopy}
          onValidationChange={() => {}}
          sourceSchema={sourceSchema}
          targetSchema={targetSchema}
          onValidationResult={() => {}}
        />
      ),
      validate: async () => true,
    },
  ], [workingCopy, updateWorkingCopy, sourceSchema, targetSchema]);

  const filledSteps = useMemo(() => [
    Boolean(workingCopy?.name?.trim()),
    Boolean(workingCopy?.sourceSchema) && Boolean(workingCopy?.targetSchema),
    Array.isArray(workingCopy?.mappingRules),
    true,
    Boolean(workingCopy?.duplicateResolution),
    true,
  ], [workingCopy]);

  const navigableSteps = useMemo(() => [
    true,
    filledSteps[0],
    filledSteps[1],
    filledSteps[2],
    filledSteps[3],
    filledSteps[4],
  ], [filledSteps]);

  const enabledStepIndices = useMemo(() => navigableSteps
    .map((allow, idx) => (allow ? idx : -1))
    .filter((idx) => idx >= 0), [navigableSteps]);

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

  const renderHeader: HeadlessMultiStepDialogProps<Partial<ResolverWorkingCopyEntity>>['renderHeader'] = useCallback((props: HeadlessHeaderRenderProps<Partial<ResolverWorkingCopyEntity>>) => (
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

  const renderContent: HeadlessMultiStepDialogProps<Partial<ResolverWorkingCopyEntity>>['renderContent'] = useCallback((props: HeadlessContentRenderProps<Partial<ResolverWorkingCopyEntity>>) => (
    <div style={{ padding: 16 }}>
      {steps[props.activeStepIndex]?.component}
    </div>
  ), [steps]);

  const isTestEnv = useMemo(() => readRuntimeMode() === 'test', []);

  const renderFooter: HeadlessMultiStepDialogProps<Partial<ResolverWorkingCopyEntity>>['renderFooter'] = useCallback((props: HeadlessFooterRenderProps<Partial<ResolverWorkingCopyEntity>>) => {
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

  const initialSnapshot = initialWorkingCopy.current;
  const isDirty = useMemo(() => {
    if (!initialSnapshot) return true;
    try {
      return JSON.stringify(initialSnapshot) !== JSON.stringify(workingCopy);
    } catch {
      return true;
    }
  }, [workingCopy, initialSnapshot]);

  const handleClose = useCallback((reason?: 'close' | 'discard') => {
    void reason;
    handleCancel();
  }, [handleCancel]);

  const stepDescriptors = useMemo<ReadonlyArray<StepComponentDescriptor<Partial<ResolverWorkingCopyEntity>>>>(() => (
    steps.map(step => ({ id: step.id, label: step.label ?? step.id, component: PlaceholderStepComponent }))
  ), [steps]);

  const headlessProps: HeadlessMultiStepDialogProps<Partial<ResolverWorkingCopyEntity>> = {
    open,
    stepComponents: stepDescriptors,
    stepData: workingCopy,
    onStepDataChange: updateWorkingCopy,
    activeStepIndex,
    onStepNavigate: handleNavigation,
    enabledStepIndices,
    validatedStepIndices,
    committableStepIndices,
    invalidMessageMap,
    onRequestClose: handleClose,
    onRequestCommit: handleCommit,
    isDirty,
    displayMode,
    onDisplayModeChange: setDisplayModeState,
    renderHeader,
    renderContent,
    renderFooter,
  };

  return (
    <HeadlessMultiStepDialog<Partial<ResolverWorkingCopyEntity>> {...headlessProps} />
  );
};

ResolverDialog.displayName = 'ResolverDialog';
