import React, { useCallback, useEffect, useMemo, useState } from 'react';
// import { Alert } from '@mui/material';
import type { NodeId } from '@hierarchidb/common-type';
import type { ResolverEntity, ResolverWorkingCopyEntity, SchemaInfo } from '~/types';

// Step components
import { ResolverBasicInfoStep } from './steps/ResolverBasicInfoStep';
import { SchemaSelectionStep } from './steps/SchemaSelectionStep';
import { PropertyMappingStep } from './steps/PropertyMappingStep';
import { ValidationConfigStep } from './steps/ValidationConfigStep';
import { DuplicateResolutionStep } from './steps/DuplicateResolutionStep';
import { PreviewTestStep } from './steps/PreviewTestStep';
// Avoid hard build-time dependency on ui-dialog: load at runtime
type DialogStep = { id: string; label: string; component: React.ReactNode; validate?: () => Promise<boolean> };
type StepStateEvaluator = { getFilledSteps?: (data: any) => boolean[]; getNavigableSteps?: (data: any) => boolean[] };
let MultiStepDialog: any;

interface ResolverDialogProps {
  open: boolean;
  nodeId: NodeId;
  entity?: ResolverEntity;
  onClose: () => void;
  onSave: (entity: Partial<ResolverWorkingCopyEntity>) => Promise<void>;
  onCancel: () => void;
}

const STEPS = ['Basic Information','Schema Selection','Property Mapping','Validation Rules','Duplicate Resolution','Preview & Test'];

// Removed unused StepValidation (computed validity is used instead)

export const ResolverDialog: React.FC<ResolverDialogProps> = ({
                                                                open,
                                                                nodeId,
                                                                entity,
                                                                onClose,
                                                                onSave,
                                                                onCancel,
                                                              }) => {
  const [workingCopy, setWorkingCopy] = useState<Partial<ResolverWorkingCopyEntity>>({});
  // No local stepValidation state (computed evaluator is used)
  const [sourceSchema, setSourceSchema] = useState<SchemaInfo | null>(null);
  const [targetSchema, setTargetSchema] = useState<SchemaInfo | null>(null);
  // No local validationResult state (Preview step manages its own state)
  const [isSaving, setIsSaving] = useState(false);

  // Initialize working copy from entity
  useEffect(() => {
    (async () => {
      try {
        const M = '@hierarchidb/ui-dialog' as string;
        const mod = await import(/* @vite-ignore */ M);
        MultiStepDialog = (mod as any).MultiStepDialog || (mod as any).default;
      } catch {}
    })();
    if (entity) {
      setWorkingCopy({
        ...entity,
        mappingRules: entity.mappingRules.map(rule => ({ ...rule })),
        validationRules: entity.validationRules.map(rule => ({ ...rule })),
        duplicateResolution: { ...entity.duplicateResolution },
        dataTransformations: entity.dataTransformations.map(transform => ({ ...transform })),
        previewConfig: entity.previewConfig ? { ...entity.previewConfig } : {
          sampleSize: 100,
          refreshInterval: 1000,
          highlightMappings: true,
          showValidationErrors: true,
        },
      });
    } else {
      // Initialize for new entity
      setWorkingCopy({
        nodeId,
        name: '',
        description: '',
        sourceSchema: '',
        targetSchema: '',
        mappingRules: [],
        validationRules: [],
        duplicateResolution: { strategy: 'ignore' },
        dataTransformations: [],
        previewConfig: {
          sampleSize: 100,
          refreshInterval: 1000,
          highlightMappings: true,
          showValidationErrors: true,
        },
      });
    }
  }, [entity, nodeId]);

  const updateWorkingCopy = useCallback(
    (updates: Partial<ResolverWorkingCopyEntity>) => {
      setWorkingCopy(prev => ({ ...prev, ...updates }));
    },
    [],
  );

  const handleStepValidation = useCallback((_step: number, _isValid: boolean) => {
    // no-op (kept for compatibility)
  }, []);

  const handleSave = useCallback(async () => {
    if (isSaving) return;

    setIsSaving(true);
    try {
      await onSave(workingCopy);
      onClose();
    } catch (error) {
      console.error('Failed to save Resolver:', error);
      // TODO: Show error notification
    } finally {
      setIsSaving(false);
    }
  }, [isSaving, workingCopy, onSave, onClose]);

  const handleCancel = useCallback(() => {
    setWorkingCopy({});
    setSourceSchema(null);
    setTargetSchema(null);
    onCancel();
  }, [onCancel]);

  // Display mode persistence per node
  const [displayMode, setDisplayModeState] = useState<'standard' | 'maximized' | 'fullscreen'>('standard');
  useEffect(() => {
    let mounted = true;
    (async () => {
      if (mounted) setDisplayModeState('standard');
    })();
    return () => { mounted = false; };
  }, [nodeId]);
  const persistMode = useCallback((_m: 'standard' | 'maximized' | 'fullscreen') => {}, [nodeId]);
  const steps: DialogStep[] = useMemo(() => [
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
      validate: async () => Boolean((workingCopy as any).name?.trim()),
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
      validate: async () => Boolean((workingCopy as any).sourceSchema) && Boolean((workingCopy as any).targetSchema),
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
      validate: async () => Array.isArray((workingCopy as any).mappingRules) && (workingCopy as any).mappingRules.length >= 0,
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
      validate: async () => Boolean((workingCopy as any).duplicateResolution),
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
  ], [workingCopy, updateWorkingCopy, handleStepValidation, sourceSchema, targetSchema]);

  const evaluator: StepStateEvaluator = useMemo(() => ({
    getFilledSteps: (data: any) => [
      Boolean(data?.name?.trim()),
      Boolean(data?.sourceSchema) && Boolean(data?.targetSchema),
      Array.isArray(data?.mappingRules),
      true,
      Boolean(data?.duplicateResolution),
      true,
    ],
    getNavigableSteps: (data: any) => {
      const f = [
        Boolean(data?.name?.trim()),
        Boolean(data?.sourceSchema) && Boolean(data?.targetSchema),
        Array.isArray(data?.mappingRules),
        true,
        Boolean(data?.duplicateResolution),
      ];
      return [true, f[0], f[1], f[2], f[3]] as boolean[];
    },
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }), []);

  const canSubmit = useCallback((data: any) => evaluator.getFilledSteps!(data).every(Boolean), [evaluator]);

  return (
    <MultiStepDialog
      open={open}
      mode={entity ? 'edit' : 'create'}
      title={entity ? 'Edit Property Resolver' : 'Create Property Resolver'}
      steps={steps}
      currentData={workingCopy}
      evaluateSteps={evaluator}
      evaluateSubmit={() => canSubmit(workingCopy)}
      onSubmit={handleSave}
      onCancel={handleCancel}
      enableA11yTestControls={process.env.NODE_ENV === 'test'}
      displayMode={displayMode}
      onDisplayModeChange={(m: 'standard' | 'maximized' | 'fullscreen') => { setDisplayModeState(m); persistMode(m); }}
    />
  );
};
