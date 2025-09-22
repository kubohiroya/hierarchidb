import React, { useCallback, useMemo, useState } from 'react';
import { Box, Button, Typography, TextField, Stack } from '@mui/material';
import { Folder as FolderIcon } from '@mui/icons-material';
import type { DialogStepDefinition, NodeId } from '@hierarchidb/common-type';
import type { FolderCreateData, FolderEditData, FolderDisplayData } from '../types.js';
import { wrapDialogStepComponent } from '../base/wrapDialogStepComponent.js';

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

  const [activeStepIndex, setActiveStepIndex] = useState(0);
  const [baseData, setBaseData] = useState<FolderStepData>(() => ({
    name: mode === 'edit' && currentData ? currentData.name : '',
    description: mode === 'edit' && currentData ? currentData.description ?? '' : '',
  }));
  const [extensionState, setExtensionState] = useState<Record<number, Record<string, unknown>>>({});
  const [errors, setErrors] = useState<string[]>([]);
  const currentStep = sortedSteps[activeStepIndex];

  const handleExtensionChange = useCallback((stepNumber: number, next: Record<string, unknown>) => {
    setExtensionState((prev) => ({ ...prev, [stepNumber]: next }));
  }, []);

  const canSubmitBase = useMemo(() => validateBaseStep(baseData).length === 0, [baseData]);

  const handleBack = useCallback(() => {
    setActiveStepIndex((idx) => Math.max(idx - 1, 0));
  }, []);

  const handleNext = useCallback(() => {
    if (activeStepIndex === 0) {
      const validationErrors = validateBaseStep(baseData);
      setErrors(validationErrors);
      if (validationErrors.length > 0) return;
    }
    setActiveStepIndex((idx) => Math.min(idx + 1, sortedSteps.length - 1));
  }, [activeStepIndex, baseData, sortedSteps.length]);

  const extensionPayload = useMemo(() => Object.assign({}, ...Object.values(extensionState)), [extensionState]);

  const handleComplete = useCallback(async () => {
    const validationErrors = validateBaseStep(baseData);
    setErrors(validationErrors);
    if (validationErrors.length > 0) return;

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
  }, [baseData, currentData, extensionPayload, mode, onSubmit]);

  if (!open) return null;

  const StepComponent = currentStep?.component as React.ComponentType<any> | undefined;
  const stepKey = currentStep?.stepNumber ?? 0;
  const extensionDataForStep = extensionState[stepKey] ?? {};
  const validationErrors = errors;

  return (
    <Box
      role="dialog"
      aria-modal="true"
      sx={(theme) => ({
        borderWidth: 1,
        borderStyle: 'solid',
        borderColor: theme.palette.divider,
        borderRadius: 2,
        padding: 3,
        maxWidth: 520,
        margin: '24px auto',
        backgroundColor: theme.palette.background.paper,
        boxShadow: theme.shadows[8],
      })}
    >
      <Stack direction="row" spacing={2} alignItems="center" mb={2}>
        {icon}
        <Typography variant="h5">{dialogTitle}</Typography>
      </Stack>

      <Box component="ol" sx={{ listStyle: 'none', padding: 0, display: 'flex', gap: 2, mb: 3 }}>
        {sortedSteps.map((step, idx) => (
          <Box
            key={step.stepNumber}
            component="li"
            sx={(theme) => ({
              padding: '8px 12px',
              borderRadius: 1,
              backgroundColor: idx === activeStepIndex
                ? theme.palette.primary.main
                : theme.palette.action.selected,
              color: idx === activeStepIndex
                ? theme.palette.primary.contrastText
                : theme.palette.text.primary,
              fontWeight: 600,
            })}
          >
            {step.title ?? `Step ${step.stepNumber}`}
          </Box>
        ))}
      </Box>

      {errors.length > 0 && (
        <Box
          mb={2}
          sx={(theme) => ({
            color: theme.palette.error.main,
          })}
        >
          {errors.map((err, i) => (
            <Typography key={i} variant="body2">{err}</Typography>
          ))}
        </Box>
      )}

      <Box mb={3}>
        {activeStepIndex === 0 ? (
          <FolderBaseStepComponent data={baseData} onChange={setBaseData} errors={validationErrors} />
        ) : StepComponent ? (
          <StepComponent
            data={extensionDataForStep}
            onChange={(next: Record<string, unknown>) => handleExtensionChange(stepKey, next)}
          />
        ) : null}
      </Box>

      <Stack direction="row" spacing={2} justifyContent="flex-end">
        <Button variant="text" onClick={onCancel}>Cancel</Button>
        <Button variant="outlined" onClick={handleBack} disabled={activeStepIndex === 0}>Back</Button>
        {activeStepIndex < sortedSteps.length - 1 ? (
          <Button variant="contained" onClick={handleNext}>
            Next
          </Button>
        ) : (
          <Button variant="contained" onClick={handleComplete} disabled={!canSubmitBase}>
            Complete
          </Button>
        )}
      </Stack>
    </Box>
  );
};

ExtensibleFolderDialog.displayName = 'ExtensibleFolderDialog';

export default ExtensibleFolderDialog;
