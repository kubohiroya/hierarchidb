import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { TextField, Stack } from '@mui/material';
import { Folder as FolderIcon } from '@mui/icons-material';
import type { DialogStepDefinition, NodeId, PeerEntity } from '@hierarchidb/common-type';
import type { FolderCreateData, FolderEditData, FolderDisplayData } from '../types.js';
import { wrapDialogStepComponent } from '@hierarchidb/plugins-base-plugin';
import { folderExtensionRegistry } from '../api/FolderDialogExtensionAPI.js';
import BaseDialog from './BaseDialog.js';

interface FolderStepData {
  name: string;
  description?: string;
}

export interface ExtensibleFolderDialogProps {
  mode: 'create' | 'edit';
  parentId?: NodeId;
  nodeId?: NodeId;
  currentData?: FolderDisplayData;
  onSubmit: (data: FolderCreateData | FolderEditData) => Promise<void>;
  onCancel: () => void;
  open?: boolean;
  additionalSteps?: DialogStepDefinition[];
  icon?: React.ReactNode;
  title?: string;
}

const validateBaseStep = (data: FolderStepData): string[] => {
  const errors: string[] = [];
  const trimmedName = data.name?.trim() ?? '';
  if (!trimmedName) {
    errors.push('Folder name is required');
  } else if (trimmedName.length > 255) {
    errors.push('Folder name is too long (max 255 characters)');
  } else if (!/^[^<>:"/\\|?*]+$/.test(trimmedName)) {
    errors.push('Folder name contains invalid characters');
  }
  if (data.description && data.description.length > 1000) {
    errors.push('Description is too long (max 1000 characters)');
  }
  return errors;
};

const defaultIcon = <FolderIcon fontSize="large" data-testid="folder-dialog-icon" />;

export const ExtensibleFolderDialog: React.FC<ExtensibleFolderDialogProps> = ({
  mode,
  currentData,
  onSubmit,
  onCancel,
  open = true,
  additionalSteps = [],
  icon = defaultIcon,
  title,
}) => {
  const dialogTitle = title ?? (mode === 'edit' ? 'Edit Folder' : 'Create New Folder');

const FolderBaseStepComponent: React.FC<{ data: FolderStepData; onChange: (next: FolderStepData) => void; errors: string[] }> = ({ data, onChange, errors }) => {
  const nameError = errors.find((e) => e.toLowerCase().includes('name'));
  const descriptionError = errors.find((e) => e.toLowerCase().includes('description'));

  return (
  <Stack spacing={2} paddingY={1}>
    <TextField
      autoFocus
      fullWidth
      label="Folder Name"
      value={data.name}
      onChange={(e) => onChange({ ...data, name: e.target.value })}
      placeholder="Enter folder name"
      error={!!nameError}
      helperText={nameError ?? 'Enter a name for the folder'}
    />
    <TextField
      fullWidth
      multiline
      minRows={3}
      label="Description"
      value={data.description ?? ''}
      onChange={(e) => onChange({ ...data, description: e.target.value })}
      placeholder="Enter description (optional)"
      error={!!descriptionError}
      helperText={descriptionError ?? 'Optional description'}
    />
  </Stack>
  );
};

const BaseStepComponent = wrapDialogStepComponent(FolderBaseStepComponent);

const baseStepDefinition: DialogStepDefinition = useMemo(() => ({
  stepNumber: 1,
  title: 'Basic Information',
  component: BaseStepComponent,
}), [BaseStepComponent]);

  const sortedSteps = useMemo(() => {
    const byNumber = new Map<number, DialogStepDefinition>();
    byNumber.set(baseStepDefinition.stepNumber, baseStepDefinition);
    additionalSteps.forEach((step) => byNumber.set(step.stepNumber, step));
    return Array.from(byNumber.values()).sort((a, b) => a.stepNumber - b.stepNumber);
  }, [additionalSteps, baseStepDefinition]);

  const stepNumbers = useMemo(() => sortedSteps.map((step) => step.stepNumber), [sortedSteps]);

  const [activeStepIndex, setActiveStepIndex] = useState(0);
  const [baseData, setBaseData] = useState<FolderStepData>(() => ({
    name: mode === 'edit' && currentData ? currentData.name : '',
    description: mode === 'edit' && currentData ? currentData.description ?? '' : '',
  }));
  const [extensionState, setExtensionState] = useState<Record<number, Record<string, unknown>>>({});
  const [errors, setErrors] = useState<string[]>([]);
  const handleExtensionChange = useCallback((stepNumber: number, next: Record<string, unknown>) => {
    setExtensionState((prev) => ({ ...prev, [stepNumber]: next }));
  }, []);

  const baseStepValid = useMemo(() => validateBaseStep(baseData).length === 0, [baseData]);

  const handleBack = useCallback(() => {
    setActiveStepIndex((idx) => Math.max(idx - 1, 0));
  }, []);

  const extensionPayload = useMemo(() => Object.assign({}, ...Object.values(extensionState)), [extensionState]);

  const peerEntity = useMemo<PeerEntity<Record<string, unknown>>>(() => {
    const candidate = currentData as unknown as PeerEntity<Record<string, unknown>> | undefined;
    const fallbackId = candidate?.id ?? ('folder-draft-id' as NodeId);
    const fallbackNodeId = candidate?.nodeId ?? ('folder-draft-node' as NodeId);
    const fallbackCreatedAt = candidate?.createdAt ?? Date.now();
    const fallbackUpdatedAt = candidate?.updatedAt ?? Date.now();
    const fallbackVersion = candidate?.version ?? 0;

    return {
      id: fallbackId,
      nodeId: fallbackNodeId,
      createdAt: fallbackCreatedAt,
      updatedAt: fallbackUpdatedAt,
      version: fallbackVersion,
      name: baseData.name,
      description: baseData.description,
      ...extensionPayload,
    };
  }, [baseData.description, baseData.name, currentData, extensionPayload]);

  const stepEvaluation = useMemo(() => {
    const enabledMap = new Map<number, boolean>();
    const validatedMap = new Map<number, boolean>();

    stepNumbers.forEach((num, index) => {
      if (index === 0) {
        enabledMap.set(num, true);
        validatedMap.set(num, baseStepValid);
      } else {
        enabledMap.set(num, baseStepValid);
        validatedMap.set(num, true);
      }
    });

    const evaluators = folderExtensionRegistry.getDialogEvaluators();
    for (const evaluator of evaluators) {
      try {
        const enabledResults = evaluator.getEnabledSteps(peerEntity, stepNumbers);
        stepNumbers.forEach((num, idx) => {
          const current = enabledMap.get(num) ?? true;
          const candidate = enabledResults?.[idx];
          enabledMap.set(num, current && (candidate !== false));
        });

        const validatedResults = evaluator.getValidatedSteps(peerEntity, stepNumbers);
        stepNumbers.forEach((num, idx) => {
          const current = validatedMap.get(num) ?? true;
          const candidate = validatedResults?.[idx];
          validatedMap.set(num, current && (candidate !== false));
        });
      } catch (error) {
        console.warn('[ExtensibleFolderDialog] step evaluator failed', error);
      }
    }

    sortedSteps.forEach((step) => {
      if (!step.dependsOn?.length) return;
      const depsSatisfied = step.dependsOn.every((dep) => validatedMap.get(dep) !== false);
      if (!depsSatisfied) {
        enabledMap.set(step.stepNumber, false);
      }
    });

    return { enabledMap, validatedMap };
  }, [baseStepValid, peerEntity, sortedSteps, stepNumbers]);

  const enabledByIndex = useMemo(
    () => sortedSteps.map((step) => stepEvaluation.enabledMap.get(step.stepNumber) !== false),
    [sortedSteps, stepEvaluation.enabledMap],
  );

  const validatedByIndex = useMemo(
    () => sortedSteps.map((step) => stepEvaluation.validatedMap.get(step.stepNumber) !== false),
    [sortedSteps, stepEvaluation.validatedMap],
  );

  const [submitEligibility, setSubmitEligibility] = useState(true);

  useEffect(() => {
    let cancelled = false;
    const submitEvaluators = folderExtensionRegistry.getSubmitEvaluators();
    if (!submitEvaluators.length) {
      setSubmitEligibility(true);
      return;
    }

    Promise.all(submitEvaluators.map((fn) => Promise.resolve(fn(peerEntity))))
      .then((results) => {
        if (!cancelled) {
          setSubmitEligibility(results.every(Boolean));
        }
      })
      .catch((error) => {
        console.warn('[ExtensibleFolderDialog] submit evaluator failed', error);
        if (!cancelled) {
          setSubmitEligibility(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [peerEntity]);

  const canSubmitDialog = useMemo(
    () => baseStepValid && validatedByIndex.every(Boolean) && submitEligibility,
    [baseStepValid, submitEligibility, validatedByIndex],
  );

  const handleNext = useCallback(() => {
    if (activeStepIndex === 0) {
      const validationErrors = validateBaseStep(baseData);
      setErrors(validationErrors);
      if (validationErrors.length > 0) return;
    }
    const nextIndex = Math.min(activeStepIndex + 1, sortedSteps.length - 1);
    if (!enabledByIndex[nextIndex]) return;
    setActiveStepIndex(nextIndex);
  }, [activeStepIndex, baseData, enabledByIndex, sortedSteps.length]);

  const handleComplete = useCallback(async () => {
    const validationErrors = validateBaseStep(baseData);
    setErrors(validationErrors);
    if (validationErrors.length > 0 || !canSubmitDialog) return;

    const trimmedName = baseData.name.trim();
    const description = baseData.description?.trim() || undefined;

    if (mode === 'edit' && currentData) {
      const changes: FolderEditData = {};
      if (trimmedName !== currentData.name) {
        changes.name = trimmedName;
      }
      if ((description ?? '') !== (currentData.description ?? '')) {
        changes.description = description;
      }
      const payload = Object.keys(extensionPayload).length > 0
        ? { ...extensionPayload, ...changes }
        : changes;
      await onSubmit(payload);
    } else {
      const payload: FolderCreateData = { name: trimmedName };
      if (description) payload.description = description;
      const merged = Object.keys(extensionPayload).length > 0
        ? { ...payload, ...extensionPayload }
        : payload;
      await onSubmit(merged);
    }
  }, [baseData, canSubmitDialog, currentData, extensionPayload, mode, onSubmit]);

  const renderStepContent = useCallback(
    (step: DialogStepDefinition | undefined) => {
      if (!step) return null;
      if (step.stepNumber === baseStepDefinition.stepNumber) {
        return <FolderBaseStepComponent data={baseData} onChange={setBaseData} errors={errors} />;
      }

      const StepComponent = step.component as React.ComponentType<{
        data: Record<string, unknown>;
        onChange: (next: Record<string, unknown>) => void;
      }>;
      if (!StepComponent) return null;
      const stepData = extensionState[step.stepNumber] ?? {};
      return (
        <StepComponent
          data={stepData}
          onChange={(next) => handleExtensionChange(step.stepNumber, next)}
        />
      );
    },
    [baseData, baseStepDefinition, errors, extensionState, handleExtensionChange],
  );

  const canNext = activeStepIndex < sortedSteps.length - 1
    ? Boolean(enabledByIndex[Math.min(activeStepIndex + 1, sortedSteps.length - 1)])
    : false;

  return (
    <BaseDialog
      title={dialogTitle}
      icon={icon}
      steps={sortedSteps}
      activeStepIndex={activeStepIndex}
      open={open}
      errors={errors}
      onCancel={onCancel}
      onBack={handleBack}
      onNext={handleNext}
      onComplete={handleComplete}
      canBack={activeStepIndex !== 0}
      canNext={canNext}
      canComplete={canSubmitDialog}
      renderStepContent={renderStepContent}
    />
  );
};

ExtensibleFolderDialog.displayName = 'ExtensibleFolderDialog';

export default ExtensibleFolderDialog;
