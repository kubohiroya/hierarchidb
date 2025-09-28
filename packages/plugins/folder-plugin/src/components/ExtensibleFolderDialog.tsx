import type React from 'react';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Box, Button, Stack, Step, StepButton, StepLabel, Stepper, TextField, Typography } from '@mui/material';
import { Folder as FolderIcon } from '@mui/icons-material';
import type { DialogStepDefinition, NodeId, PeerEntity } from '@hierarchidb/common-type';
import type { FolderCreateData, FolderEditData, FolderDisplayData } from '../types.js';
import { folderExtensionRegistry } from '../api/FolderDialogExtensionAPI.js';
import {
  HeadlessMultiStepDialog,
  useMultiStepDialogContext,
  type StepComponentDescriptor,
  type StepComponentProps,
  type StepNavigationEvent,
} from '@hierarchidb/ui-dialog';

interface FolderStepData {
  name: string;
  description?: string;
}

interface FolderBaseStepProps {
  value: FolderStepData;
  onChange: (next: FolderStepData) => void;
  errors: ReadonlyArray<string>;
}

const FolderBaseStep: React.FC<FolderBaseStepProps> = ({ value, onChange, errors }) => {
  const nameError = errors.find((error) => error.toLowerCase().includes('name'));
  const descriptionError = errors.find((error) => error.toLowerCase().includes('description'));

  return (
    <Stack spacing={2} paddingY={1}>
      <TextField
        autoFocus
        fullWidth
        label="Folder Name"
        value={value.name}
        onChange={(event) => onChange({ ...value, name: event.target.value })}
        placeholder="Enter folder name"
        error={Boolean(nameError)}
        helperText={nameError ?? 'Enter a name for the folder'}
      />
      <TextField
        fullWidth
        multiline
        minRows={3}
        label="Description"
        value={value.description ?? ''}
        onChange={(event) => onChange({ ...value, description: event.target.value })}
        placeholder="Enter description (optional)"
        error={Boolean(descriptionError)}
        helperText={descriptionError ?? 'Optional description'}
      />
    </Stack>
  );
};

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

interface FolderDialogState {
  base: FolderStepData;
  extensions: Record<number, Record<string, unknown>>;
}

const defaultIcon = <FolderIcon fontSize="large" data-testid="folder-dialog-icon" />;

const FolderDialogHeader: React.FC<{ title: string; icon: React.ReactNode }> = ({ title, icon }) => {
  const ctx = useMultiStepDialogContext<FolderDialogState>();
  const showStepper = ctx.stepComponents.length > 1;

  const handleStepClick = useCallback((index: number, canNavigate: boolean) => {
    if (!canNavigate || index === ctx.activeStepIndex) {
      return;
    }
    ctx.onStepNavigate({ type: 'direct', targetIndex: index });
  }, [ctx]);

  return (
    <Box
      sx={(theme) => ({
        borderBottom: `1px solid ${theme.palette.divider}`,
        padding: theme.spacing(1.5, 2),
        backgroundColor: theme.palette.background.paper,
      })}
    >
      <Stack direction="row" spacing={1.5} alignItems="center" sx={{ mb: showStepper ? 1 : 0 }}>
        {icon}
        <Typography variant="h6" noWrap>
          {title}
        </Typography>
      </Stack>
      {showStepper && (
        <Stepper nonLinear activeStep={ctx.activeStepIndex} alternativeLabel>
          {ctx.stepComponents.map((step, index) => {
            const canNavigate = ctx.enabledStepIndices.includes(index) || index === ctx.activeStepIndex;
            const completed = ctx.validatedStepIndices.includes(index);
            return (
              <Step key={step.id} completed={completed}>
                <StepButton
                  disabled={!canNavigate}
                  onClick={(event) => {
                    event.preventDefault();
                    handleStepClick(index, canNavigate);
                  }}
                >
                  <StepLabel>{step.label}</StepLabel>
                </StepButton>
              </Step>
            );
          })}
        </Stepper>
      )}
    </Box>
  );
};

const FolderDialogFooter: React.FC<{ mode: 'create' | 'edit'; canCommit: boolean }> = ({ mode, canCommit }) => {
  const ctx = useMultiStepDialogContext<FolderDialogState>();
  const isFirstStep = ctx.activeStepIndex === 0;
  const isLastStep = ctx.activeStepIndex >= ctx.stepComponents.length - 1;
  const nextIndex = Math.min(ctx.activeStepIndex + 1, ctx.stepComponents.length - 1);
  const canNavigateNext = !isLastStep && ctx.enabledStepIndices.includes(nextIndex);

  const handleSecondary = () => {
    if (isFirstStep) {
      ctx.onRequestClose('close');
      return;
    }
    ctx.onStepNavigate({ type: 'back' });
  };

  const handlePrimary = () => {
    if (isLastStep) {
      ctx.onRequestCommit?.();
      return;
    }
    if (canNavigateNext) {
      ctx.onStepNavigate({ type: 'next' });
    }
  };

  const primaryLabel = isLastStep ? (mode === 'create' ? 'Create' : 'Save') : 'Next';

  return (
    <Box
      sx={(theme) => ({
        borderTop: `1px solid ${theme.palette.divider}`,
        padding: theme.spacing(1.5, 2),
        backgroundColor: theme.palette.background.paper,
      })}
    >
      <Stack
        direction={{ xs: 'column', sm: 'row' }}
        spacing={2}
        justifyContent="space-between"
        alignItems={{ xs: 'stretch', sm: 'center' }}
      >
        <Button
          variant="contained"
          color={isFirstStep ? 'inherit' : 'secondary'}
          onClick={handleSecondary}
        >
          {isFirstStep ? 'Cancel' : 'Back'}
        </Button>
        <Stack direction="row" spacing={1.5} alignItems="center" justifyContent="flex-end">
          <Button
            variant="contained"
            color="primary"
            onClick={handlePrimary}
            disabled={isLastStep ? !canCommit : !canNavigateNext}
          >
            {primaryLabel}
          </Button>
        </Stack>
      </Stack>
    </Box>
  );
};

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

  const baseStepDefinition: DialogStepDefinition = useMemo(() => ({
    stepNumber: 1,
    title: 'Basic Information',
    component: () => null,
  }), []);

  const sortedSteps = useMemo(() => {
    const byNumber = new Map<number, DialogStepDefinition>();
    byNumber.set(baseStepDefinition.stepNumber, baseStepDefinition);
    additionalSteps.forEach((step) => byNumber.set(step.stepNumber, step));
    return Array.from(byNumber.values()).sort((a, b) => a.stepNumber - b.stepNumber);
  }, [additionalSteps, baseStepDefinition]);

  const createInitialBaseData = useCallback((): FolderStepData => ({
    name: mode === 'edit' && currentData ? currentData.name : '',
    description: mode === 'edit' && currentData ? currentData.description ?? '' : '',
  }), [currentData, mode]);

  const [dialogState, setDialogState] = useState<FolderDialogState>(() => ({
    base: createInitialBaseData(),
    extensions: {},
  }));
  const [activeStepIndex, setActiveStepIndex] = useState(0);
  const [baseErrors, setBaseErrors] = useState<string[]>([]);
  const [submitEligibility, setSubmitEligibility] = useState(true);
  const initialBaseRef = useRef<FolderStepData>(dialogState.base);
  const previousOpenRef = useRef<boolean>(open);

  const resetState = useCallback(() => {
    const nextBase = createInitialBaseData();
    setDialogState({ base: nextBase, extensions: {} });
    initialBaseRef.current = nextBase;
    setActiveStepIndex(0);
    setBaseErrors([]);
  }, [createInitialBaseData]);

  useEffect(() => {
    const wasOpen = previousOpenRef.current;
    previousOpenRef.current = open;
    if (open && !wasOpen) {
      resetState();
    }
  }, [open, resetState]);

  useEffect(() => {
    if (baseErrors.length === 0) {
      return;
    }
    const currentErrors = validateBaseStep(dialogState.base);
    if (currentErrors.join('||') !== baseErrors.join('||')) {
      setBaseErrors(currentErrors);
    }
  }, [dialogState.base, baseErrors]);

  const handleStatePatch = useCallback((patch: Partial<FolderDialogState>) => {
    setDialogState((prev) => ({
      base: patch.base ?? prev.base,
      extensions: patch.extensions ? { ...prev.extensions, ...patch.extensions } : prev.extensions,
    }));
  }, []);

  const extensionPayload = useMemo(
    () => Object.assign({}, ...Object.values(dialogState.extensions)),
    [dialogState.extensions],
  );

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
      name: dialogState.base.name,
      description: dialogState.base.description,
      ...extensionPayload,
    };
  }, [currentData, dialogState.base.description, dialogState.base.name, extensionPayload]);

  const stepNumbers = useMemo(() => sortedSteps.map((step) => step.stepNumber), [sortedSteps]);

  const stepEvaluation = useMemo(() => {
    const enabledMap = new Map<number, boolean>();
    const validatedMap = new Map<number, boolean>();

    const baseValid = validateBaseStep(dialogState.base).length === 0;

    stepNumbers.forEach((num, index) => {
      if (index === 0) {
        enabledMap.set(num, true);
        validatedMap.set(num, baseValid);
      } else {
        enabledMap.set(num, baseValid);
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
          enabledMap.set(num, current && candidate !== false);
        });

        const validatedResults = evaluator.getValidatedSteps(peerEntity, stepNumbers);
        stepNumbers.forEach((num, idx) => {
          const current = validatedMap.get(num) ?? true;
          const candidate = validatedResults?.[idx];
          validatedMap.set(num, current && candidate !== false);
        });
      } catch (error) {
        console.warn('[ExtensibleFolderDialog] step evaluator failed', error);
      }
    }

    sortedSteps.forEach((step) => {
      if (!step.dependsOn?.length) return;
      const dependenciesSatisfied = step.dependsOn.every((dep) => validatedMap.get(dep) !== false);
      if (!dependenciesSatisfied) {
        enabledMap.set(step.stepNumber, false);
      }
    });

    return { enabledMap, validatedMap };
  }, [dialogState.base, peerEntity, sortedSteps, stepNumbers]);

  const enabledByIndex = useMemo(
    () => sortedSteps.map((step) => stepEvaluation.enabledMap.get(step.stepNumber) !== false),
    [sortedSteps, stepEvaluation.enabledMap],
  );

  const validatedByIndex = useMemo(
    () => sortedSteps.map((step) => stepEvaluation.validatedMap.get(step.stepNumber) !== false),
    [sortedSteps, stepEvaluation.validatedMap],
  );

  const enabledStepIndices = useMemo(
    () => enabledByIndex.reduce<number[]>((indices, enabled, index) => {
      if (enabled) indices.push(index);
      return indices;
    }, []),
    [enabledByIndex],
  );

  const validatedStepIndices = useMemo(
    () => validatedByIndex.reduce<number[]>((indices, valid, index) => {
      if (valid) indices.push(index);
      return indices;
    }, []),
    [validatedByIndex],
  );

  const committableStepIndices = useMemo(() => validatedStepIndices, [validatedStepIndices]);

  useEffect(() => {
    let cancelled = false;
    const submitEvaluators = folderExtensionRegistry.getSubmitEvaluators();
    if (!submitEvaluators.length) {
      setSubmitEligibility(true);
      return;
    }

    Promise.all(submitEvaluators.map((evaluator) => Promise.resolve(evaluator(peerEntity))))
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

  const canSubmitDialog = useMemo(() => (
    validateBaseStep(dialogState.base).length === 0 &&
    validatedByIndex.every(Boolean) &&
    submitEligibility
  ), [dialogState.base, submitEligibility, validatedByIndex]);

  const invalidMessageMap = useMemo<Record<string, string>>(() => (
    baseErrors.length ? { base: baseErrors.join(', ') } : {}
  ) as Record<string, string>, [baseErrors]);

  const handleNavigation = useCallback((event: StepNavigationEvent) => {
    switch (event.type) {
      case 'back':
        setActiveStepIndex((index) => Math.max(index - 1, 0));
        break;
      case 'next': {
        if (activeStepIndex === 0) {
          const validationErrors = validateBaseStep(dialogState.base);
          setBaseErrors(validationErrors);
          if (validationErrors.length > 0) {
            return;
          }
        }
        const nextIndex = Math.min(activeStepIndex + 1, sortedSteps.length - 1);
        if (!enabledByIndex[nextIndex]) return;
        setActiveStepIndex(nextIndex);
        break;
      }
      case 'direct': {
        if (event.targetIndex === activeStepIndex) return;
        if (event.targetIndex > activeStepIndex && activeStepIndex === 0) {
          const validationErrors = validateBaseStep(dialogState.base);
          setBaseErrors(validationErrors);
          if (validationErrors.length > 0) {
            return;
          }
        }
        if (!enabledByIndex[event.targetIndex]) return;
        setActiveStepIndex(event.targetIndex);
        break;
      }
      default:
        break;
    }
  }, [activeStepIndex, dialogState.base, enabledByIndex, sortedSteps.length]);

  const handleSubmit = useCallback(async () => {
    const validationErrors = validateBaseStep(dialogState.base);
    setBaseErrors(validationErrors);
    if (validationErrors.length > 0 || !canSubmitDialog) {
      return;
    }

    const trimmedName = dialogState.base.name.trim();
    const description = dialogState.base.description?.trim() || undefined;

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
  }, [canSubmitDialog, currentData, dialogState.base, extensionPayload, mode, onSubmit]);

  const handleCommit = useCallback(() => {
    void handleSubmit();
  }, [handleSubmit]);

  const isDirty = useMemo(() => (
    JSON.stringify(dialogState.base) !== JSON.stringify(initialBaseRef.current)
    || Object.keys(dialogState.extensions).length > 0
  ), [dialogState.base, dialogState.extensions]);

  useEffect(() => {
    if (!open) {
      setActiveStepIndex(0);
    }
  }, [open]);

  const stepDescriptors = useMemo<ReadonlyArray<StepComponentDescriptor<FolderDialogState>>>(() => (
    sortedSteps.map((step, index) => {
      const stepId = step.stepNumber === baseStepDefinition.stepNumber ? 'base' : `ext-${step.stepNumber}`;
      if (index === 0) {
        return {
          id: stepId,
          label: step.title ?? 'Basic Information',
          component: ({ data, onChange }: StepComponentProps<FolderDialogState>) => (
            <Box sx={{ padding: 2 }}>
              <FolderBaseStep
                value={data.base}
                onChange={(next) => onChange({ base: next })}
                errors={baseErrors}
              />
            </Box>
          ),
        } satisfies StepComponentDescriptor<FolderDialogState>;
      }

      const stepNumber = step.stepNumber;
      return {
        id: stepId,
        label: step.title ?? `Step ${step.stepNumber}`,
        component: ({ data, onChange }: StepComponentProps<FolderDialogState>) => {
          const stepData = data.extensions[stepNumber] ?? {};
          const element = step.component({
            data: stepData,
            onChange: (next: Record<string, unknown>) => onChange({ extensions: { [stepNumber]: next } }),
          } as Record<string, unknown>) as React.ReactNode;
          return <Box sx={{ padding: 2 }}>{element}</Box>;
        },
      } satisfies StepComponentDescriptor<FolderDialogState>;
    })
  ), [baseErrors, sortedSteps, baseStepDefinition.stepNumber]);

  return (
    <HeadlessMultiStepDialog<FolderDialogState>
      open={open}
      stepComponents={stepDescriptors}
      stepData={dialogState}
      onStepDataChange={handleStatePatch}
      activeStepIndex={activeStepIndex}
      onStepNavigate={handleNavigation}
      enabledStepIndices={enabledStepIndices}
      validatedStepIndices={validatedStepIndices}
      committableStepIndices={committableStepIndices}
      invalidMessageMap={invalidMessageMap}
      onRequestClose={onCancel}
      onRequestCommit={handleCommit}
      isDirty={isDirty}
      renderHeader={() => (
        <FolderDialogHeader title={dialogTitle} icon={icon} />
      )}
      renderFooter={() => (
        <FolderDialogFooter mode={mode} canCommit={canSubmitDialog} />
      )}
    />
  );
};

ExtensibleFolderDialog.displayName = 'ExtensibleFolderDialog';

export default ExtensibleFolderDialog;
