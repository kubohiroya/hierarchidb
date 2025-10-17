/**
 * Shape Dialog Component - UI Layer
 * Main base-dialog for creating and editing Shape entities
 */

import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Box,
  Button,
  CircularProgress,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Step,
  StepLabel,
  Stepper,
  Typography,
} from '@mui/material';
import { notify } from '@hierarchidb/components';
import { useWorkingCopy } from '@hierarchidb/runtime-basic-info';
import type { NodeId } from '../../shared/index.ts';
import {
  type ShapeEntity,
  type ShapeWorkingCopy,
  UI_CONSTANTS,
  DEFAULT_PROCESSING_CONFIG,
  summarizeCheckboxState,
} from '../../shared/index.ts';

export interface ShapeDialogProps {
  mode: 'create' | 'edit';
  nodeId?: NodeId;
  parentId?: NodeId;
  open: boolean;
  onClose: () => void;
  onSuccess?: (entity: ShapeEntity) => void;
  onError?: (error: Error) => void;
}

export function ShapeDialog({
  mode,
  nodeId,
  parentId,
  open,
  onClose,
  onSuccess,
  onError,
}: ShapeDialogProps) {
  const { init, commit, discard } = useWorkingCopy<ShapeWorkingCopy>({ nodeType: 'shape', mode, nodeId, parentId });

  const [activeStep, setActiveStep] = useState(0);
  const [loading, setLoading] = useState(false);
  const [workingCopy, setWorkingCopy] = useState<ShapeWorkingCopy>({});
  const [initializing, setInitializing] = useState(false);

  const createInitialWorkingCopy = useCallback((): ShapeWorkingCopy => {
    const now = Date.now();
    const baseConfig = { ...DEFAULT_PROCESSING_CONFIG };
    return {
      id: (nodeId ?? parentId ?? `temp-${now}`) as NodeId,
      nodeId: nodeId ?? '' as NodeId,
      parentId: parentId ?? '' as NodeId,
      nodeType: 'shape',
      name: '',
      description: '',
      dataSourceName: 'naturalearth',
      licenseAgreement: false,
      processingConfig: baseConfig,
      checkboxState: [],
      isDraft: true,
      copiedAt: now,
      createdAt: now,
      updatedAt: now,
      version: 1,
      depth: 0,
    };
  }, [nodeId, parentId]);

  useEffect(() => {
    if (open && !workingCopy && !initializing) {
      setWorkingCopy(createInitialWorkingCopy());
    }
  }, [open, initializing, workingCopy, createInitialWorkingCopy]);

  useEffect(() => {
    if (open) void init();
  }, [open, init]);

  useEffect(() => () => {
    void discard().catch(() => {});
  }, [discard]);

  const handleNext = useCallback(() => {
    setActiveStep((prev) => Math.min(prev + 1, UI_CONSTANTS.STEPPER_STEPS.length - 1));
  }, []);

  const handleBack = useCallback(() => {
    setActiveStep((prev) => Math.max(prev - 1, 0));
  }, []);

  const handleSubmit = useCallback(async () => {
    if (!workingCopy) return;
    setLoading(true);
    try {
      await commit();
      onSuccess?.(workingCopy);
      notify.success('Shape saved successfully');
      onClose();
    } catch (error) {
      console.error('Failed to submit shape:', error);
      onError?.(error instanceof Error ? error : new Error('Failed to submit'));
      notify.error('Failed to save shape');
    } finally {
      setLoading(false);
    }
  }, [commit, onClose, onError, onSuccess, workingCopy]);

  const handleClose = useCallback(() => {
    setActiveStep(0);
    setWorkingCopy(null);
    setInitializing(false);
    onClose();
  }, [onClose]);

  const isStepComplete = useCallback((step: number) => {
    if (!workingCopy) return false;
    switch (step) {
      case 0:
        return workingCopy.name.trim().length > 0;
      case 1:
        return !!workingCopy.dataSourceName;
      case 2:
        return workingCopy.licenseAgreement;
      case 3:
        return !!workingCopy.processingConfig;
      case 4: {
        const summary = summarizeCheckboxState(workingCopy.checkboxState);
        return summary.hasSelection && summary.levels.length > 0;
      }
      default:
        return false;
    }
  }, [workingCopy]);

  const canProceed = useMemo(() => isStepComplete(activeStep), [activeStep, isStepComplete]);
  const isLastStep = activeStep === UI_CONSTANTS.STEPPER_STEPS.length - 1;
  const canSubmit = useMemo(() => UI_CONSTANTS.STEPPER_STEPS.every((_, index) => isStepComplete(index)), [isStepComplete]);

  if (initializing || !workingCopy) {
    return (
      <Dialog open={open} onClose={handleClose} maxWidth={UI_CONSTANTS.DIALOG_MAX_WIDTH} fullWidth>
        <DialogContent sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: 240 }}>
          <CircularProgress size={32} />
        </DialogContent>
      </Dialog>
    );
  }

  return (
    <Dialog open={open} onClose={handleClose} maxWidth={UI_CONSTANTS.DIALOG_MAX_WIDTH} fullWidth>
      <DialogTitle>{mode === 'create' ? 'Create Shape' : 'Edit Shape'}</DialogTitle>
      <DialogContent sx={{ minHeight: 320 }}>
        <Stepper activeStep={activeStep} alternativeLabel>
          {UI_CONSTANTS.STEPPER_STEPS.map((step, index) => (
            <Step key={step} completed={isStepComplete(index)}>
              <StepLabel>{step}</StepLabel>
            </Step>
          ))}
        </Stepper>
        {/* step content placeholder */}
      </DialogContent>
      <DialogActions sx={{ gap: 1 }}>
        <Button onClick={handleClose}>Cancel</Button>
        <Button onClick={handleBack} disabled={activeStep === 0}>Back</Button>
        {!isLastStep && (
          <Button onClick={handleNext} disabled={!canProceed}>Next</Button>
        )}
        {isLastStep && (
          <Button onClick={handleSubmit} disabled={!canSubmit || loading} variant="contained">
            {loading ? <CircularProgress size={16} /> : 'Save'}
          </Button>
        )}
      </DialogActions>
    </Dialog>
  );
}
