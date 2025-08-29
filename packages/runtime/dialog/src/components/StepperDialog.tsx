/**
 * @fileoverview StepperDialog - Multi-step dialog with stepper navigation
 * Enhanced with fullscreen toggle and custom footer support
 */

import React, { useState, useMemo, useCallback } from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  IconButton,
  Typography,
  Stepper,
  Step,
  StepButton,
  Box,
  Stack,
  Button,
} from '@mui/material';
import {
  Close as CloseIcon,
  Fullscreen as FullscreenIcon,
  FullscreenExit as FullscreenExitIcon,
} from '@mui/icons-material';
import { UnsavedChangesDialog } from './UnsavedChangesDialog';

export interface StepConfiguration {
  label: string;
  content: React.ReactNode;
  validate?: () => boolean;
  optional?: boolean;
  icon?: React.ReactNode;
}

export interface CustomFooterProps {
  currentStep: number;
  isFirstStep: boolean;
  isLastStep: boolean;
  canGoNext: boolean;
  canGoPrevious: boolean;
  totalSteps: number;
  onNext: () => void;
  onBack: () => void;
  onCancel: () => void;
  onSubmit: () => void;
}

export interface StepperDialogProps {
  // Basic dialog props
  mode: 'create' | 'edit';
  open: boolean;
  nodeId?: string;
  parentId?: string;
  title: string;
  icon?: React.ReactNode;

  // Step configuration
  steps: StepConfiguration[];
  activeStep?: number; // For controlled mode
  onStepChange?: (step: number) => void;
  nonLinear?: boolean; // Allow jumping between steps

  // Data management
  hasUnsavedChanges?: boolean;
  supportsDraft?: boolean;

  // Dialog size and fullscreen
  maxWidth?: 'xs' | 'sm' | 'md' | 'lg' | 'xl' | false;
  fullScreen?: boolean;

  // Header customization
  headerActions?: React.ReactNode;

  // Footer customization
  customFooterContent?: (props: CustomFooterProps) => React.ReactNode;

  // Event handlers
  onSubmit: () => Promise<void> | void;
  onSaveDraft?: () => Promise<void> | void;
  onCancel: () => void;
  onClose?: () => void;
}

export const StepperDialog: React.FC<StepperDialogProps> = ({
  mode,
  open,
  nodeId,
  parentId: _parentId, // TODO: Use for create mode
  title,
  icon,
  steps,
  activeStep: controlledActiveStep,
  onStepChange,
  nonLinear = false,
  hasUnsavedChanges = false,
  supportsDraft = false,
  maxWidth = 'lg',
  fullScreen: initialFullScreen = false,
  headerActions,
  customFooterContent,
  onSubmit,
  onSaveDraft,
  onCancel,
  onClose,
}) => {
  // Internal state
  const [internalActiveStep, setInternalActiveStep] = useState(0);
  const [isFullscreen, setIsFullscreen] = useState(initialFullScreen);
  const [showUnsavedChangesDialog, setShowUnsavedChangesDialog] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Use controlled or internal step state
  const currentStep = controlledActiveStep ?? internalActiveStep;

  // Step navigation helpers
  const isFirstStep = currentStep === 0;
  const isLastStep = currentStep === steps.length - 1;
  const totalSteps = steps.length;

  // Validation for current and all previous steps
  const canGoNext = useMemo(() => {
    const currentStepConfig = steps[currentStep];
    return currentStepConfig?.validate?.() ?? true;
  }, [steps, currentStep]);

  const canGoPrevious = currentStep > 0;

  const canSubmit = useMemo(() => {
    // All steps must be valid for submission
    return steps.every((step, index) => {
      if (index > currentStep) return true; // Don't validate future steps
      return step.validate?.() ?? true;
    });
  }, [steps, currentStep]);

  // Step change handler
  const handleStepChange = useCallback(
    (newStep: number) => {
      if (onStepChange) {
        onStepChange(newStep);
      } else {
        setInternalActiveStep(newStep);
      }
    },
    [onStepChange]
  );

  // Navigation handlers
  const handleNext = useCallback(() => {
    if (!isLastStep && canGoNext) {
      handleStepChange(currentStep + 1);
    }
  }, [currentStep, isLastStep, canGoNext, handleStepChange]);

  const handleBack = useCallback(() => {
    if (canGoPrevious) {
      handleStepChange(currentStep - 1);
    }
  }, [currentStep, canGoPrevious, handleStepChange]);

  // Dialog close handler
  const handleClose = useCallback(() => {
    if (hasUnsavedChanges) {
      setShowUnsavedChangesDialog(true);
    } else {
      onClose?.() || onCancel();
    }
  }, [hasUnsavedChanges, onClose, onCancel]);

  // Submit handler
  const handleSubmit = useCallback(async () => {
    if (!canSubmit || isSubmitting) return;

    try {
      setIsSubmitting(true);
      await onSubmit();
    } catch (error) {
      console.error('Dialog submission failed:', error);
      // Error handling should be done by parent component
    } finally {
      setIsSubmitting(false);
    }
  }, [canSubmit, isSubmitting, onSubmit]);

  // Save draft handler
  const handleSaveDraft = useCallback(async () => {
    if (!onSaveDraft) return;

    try {
      await onSaveDraft();
      setShowUnsavedChangesDialog(false);
      onClose?.() || onCancel();
    } catch (error) {
      console.error('Save draft failed:', error);
    }
  }, [onSaveDraft, onClose, onCancel]);

  // Discard changes handler
  const handleDiscardChanges = useCallback(() => {
    setShowUnsavedChangesDialog(false);
    onClose?.() || onCancel();
  }, [onClose, onCancel]);

  // Fullscreen toggle
  const toggleFullscreen = useCallback(() => {
    setIsFullscreen(!isFullscreen);
  }, [isFullscreen]);

  // Step click handler (for non-linear navigation)
  const handleStepClick = useCallback(
    (stepIndex: number) => {
      if (!nonLinear) return;

      // Allow navigation to any completed step or the next incomplete step
      const canNavigateToStep =
        stepIndex <= currentStep || (stepIndex === currentStep + 1 && canGoNext);

      if (canNavigateToStep) {
        handleStepChange(stepIndex);
      }
    },
    [nonLinear, currentStep, canGoNext, handleStepChange]
  );

  // Custom footer props
  const footerProps: CustomFooterProps = {
    currentStep,
    isFirstStep,
    isLastStep,
    canGoNext,
    canGoPrevious,
    totalSteps,
    onNext: handleNext,
    onBack: handleBack,
    onCancel: handleClose,
    onSubmit: handleSubmit,
  };

  return (
    <>
      <Dialog
        open={open}
        onClose={handleClose}
        maxWidth={isFullscreen ? false : maxWidth}
        fullWidth={!isFullscreen}
        fullScreen={isFullscreen}
        disableEscapeKeyDown={hasUnsavedChanges}
      >
        {/* Dialog Title with Stepper */}
        <DialogTitle sx={{ pb: 1 }}>
          <Box
            sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 2 }}
          >
            <Stack direction="row" spacing={2} alignItems="center">
              {icon}
              <Typography variant="h6">{title}</Typography>
              {mode === 'edit' && (
                <Typography variant="caption" color="text.secondary">
                  ({nodeId})
                </Typography>
              )}
            </Stack>

            <Stack direction="row" spacing={1}>
              {/* Header actions (including fullscreen toggle) */}
              <IconButton
                onClick={toggleFullscreen}
                color="inherit"
                aria-label={isFullscreen ? 'Exit fullscreen' : 'Enter fullscreen'}
              >
                {isFullscreen ? <FullscreenExitIcon /> : <FullscreenIcon />}
              </IconButton>

              {headerActions}

              <IconButton onClick={handleClose} color="inherit" aria-label="Close dialog">
                <CloseIcon />
              </IconButton>
            </Stack>
          </Box>

          {/* Stepper */}
          <Stepper activeStep={currentStep} alternativeLabel={totalSteps > 4}>
            {steps.map((step, index) => (
              <Step key={step.label} completed={index < currentStep}>
                <StepButton
                  onClick={() => handleStepClick(index)}
                  disabled={!nonLinear || index > currentStep + 1}
                  optional={
                    step.optional ? (
                      <Typography variant="caption" color="text.secondary">
                        Optional
                      </Typography>
                    ) : undefined
                  }
                >
                  {step.label}
                </StepButton>
              </Step>
            ))}
          </Stepper>
        </DialogTitle>

        {/* Dialog Content */}
        <DialogContent sx={{ px: 0, flex: 1, minHeight: 0, overflow: 'hidden' }}>
          <Box sx={{ height: '100%' }}>{steps[currentStep]?.content}</Box>
        </DialogContent>

        {/* Dialog Actions */}
        <DialogActions sx={{ p: 0, justifyContent: 'stretch' }}>
          {customFooterContent ? (
            customFooterContent(footerProps)
          ) : (
            <Box
              sx={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                p: 2,
                width: '100%',
              }}
            >
              {/* Left side buttons */}
              <Button
                onClick={isFirstStep ? handleClose : handleBack}
                variant="outlined"
                size="large"
                disabled={isSubmitting}
              >
                {isFirstStep ? 'Cancel' : 'Back'}
              </Button>

              {/* Right side buttons */}
              <Stack direction="row" spacing={2}>
                {!isLastStep && (
                  <Button
                    onClick={handleNext}
                    variant="contained"
                    size="large"
                    disabled={!canGoNext || isSubmitting}
                  >
                    Next
                  </Button>
                )}

                {isLastStep && (
                  <Button
                    onClick={handleSubmit}
                    variant="contained"
                    size="large"
                    disabled={!canSubmit || isSubmitting}
                  >
                    {isSubmitting ? 'Saving...' : mode === 'create' ? 'Create' : 'Save'}
                  </Button>
                )}
              </Stack>
            </Box>
          )}
        </DialogActions>
      </Dialog>

      {/* Unsaved Changes Confirmation Dialog */}
      <UnsavedChangesDialog
        open={showUnsavedChangesDialog}
        title={`Discard ${title}?`}
        message={`You have unsaved changes. Are you sure you want to discard your changes?`}
        showSaveDraft={supportsDraft && !!onSaveDraft}
        onDiscard={handleDiscardChanges}
        onSaveDraft={handleSaveDraft}
        onCancel={() => setShowUnsavedChangesDialog(false)}
      />
    </>
  );
};
