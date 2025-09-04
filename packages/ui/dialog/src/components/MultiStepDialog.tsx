/**
 * Multi-step dialog component with React Router integration
 */

import React, { useState, useCallback, useMemo, useEffect } from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Box,
  IconButton,
  Typography,
  Button,
  Stack,
  CircularProgress,
} from '@mui/material';
import {
  Close as CloseIcon,
  Fullscreen as FullscreenIcon,
  FullscreenExit as FullscreenExitIcon,
} from '@mui/icons-material';
import { UnsavedChangesDialog } from './UnsavedChangesDialog';
import { DialogStepper } from './DialogStepper';
import type {
  MultiStepDialogProps,
  FooterRenderProps,
} from '../types/MultiStepDialog.types';

/**
 * Multi-step dialog component
 */
export const MultiStepDialog: React.FC<MultiStepDialogProps> = ({
  open,
  mode,
  title,
  subtitle,
  icon,
  steps,
  activeStep: controlledActiveStep,
  onStepChange,
  nonLinear = false,
  maxWidth = 'lg',
  fullScreen: initialFullScreen = false,
  showFullscreenToggle = true,
  onFullscreenChange,
  hasUnsavedChanges = false,
  supportsDraft = false,
  onSubmit,
  onSaveDraft,
  onCancel,
  onClose,
  renderFooter,
  headerActions,
  onStepTransition,
  loading = false,
  submitText = mode === 'create' ? 'Create' : 'Save',
  cancelText = 'Cancel',
  backText = 'Back',
  nextText = 'Next',
}) => {
  // State
  const [internalActiveStep, setInternalActiveStep] = useState(0);
  const [completedSteps, setCompletedSteps] = useState<Set<number>>(new Set());
  const [isFullscreen, setIsFullscreen] = useState(initialFullScreen);
  const [showUnsavedDialog, setShowUnsavedDialog] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [stepErrors, setStepErrors] = useState<Map<number, string>>(new Map());

  // Use controlled or internal step
  const currentStep = controlledActiveStep ?? internalActiveStep;

  // Filter out skipped steps
  const visibleSteps = useMemo(
    () => steps.filter(step => !step.skip?.()),
    [steps]
  );

  // Get current step config
  const currentStepConfig = visibleSteps[currentStep];

  // Navigation helpers
  const isFirstStep = currentStep === 0;
  const isLastStep = currentStep === visibleSteps.length - 1;

  // Validation
  const validateCurrentStep = useCallback(async () => {
    if (!currentStepConfig?.validate) return true;
    
    try {
      const isValid = await currentStepConfig.validate();
      if (!isValid) {
        setStepErrors(prev => new Map(prev).set(currentStep, 'Please complete this step'));
      } else {
        setStepErrors(prev => {
          const next = new Map(prev);
          next.delete(currentStep);
          return next;
        });
      }
      return isValid;
    } catch (error) {
      console.error('Step validation error:', error);
      setStepErrors(prev => new Map(prev).set(currentStep, 'Validation failed'));
      return false;
    }
  }, [currentStepConfig, currentStep]);

  // Check if can navigate
  const canGoNext = useMemo(() => {
    return !stepErrors.has(currentStep) && !loading;
  }, [currentStep, stepErrors, loading]);

  const canGoPrevious = currentStep > 0 && !loading;

  const canSubmit = useMemo(() => {
    // All non-optional steps must be completed
    return visibleSteps.every((step, index) => {
      if (step.optional) return true;
      if (index === currentStep) return !stepErrors.has(index);
      return completedSteps.has(index);
    }) && !loading;
  }, [visibleSteps, currentStep, completedSteps, stepErrors, loading]);

  // Handle step change
  const handleStepChange = useCallback(async (newStep: number) => {
    // Call transition hook if provided
    if (onStepTransition) {
      const canTransition = await onStepTransition(currentStep, newStep);
      if (!canTransition) return;
    }

    // Call onLeave for current step
    await currentStepConfig?.onLeave?.();

    // Update step
    if (onStepChange) {
      onStepChange(newStep);
    } else {
      setInternalActiveStep(newStep);
    }

    // Call onEnter for new step
    const newStepConfig = visibleSteps[newStep];
    await newStepConfig?.onEnter?.();
  }, [currentStep, currentStepConfig, onStepTransition, onStepChange, visibleSteps]);

  // Navigation handlers
  const handleNext = useCallback(async () => {
    if (!canGoNext || isLastStep) return;

    const isValid = await validateCurrentStep();
    if (!isValid) return;

    setCompletedSteps(prev => new Set(prev).add(currentStep));
    await handleStepChange(currentStep + 1);
  }, [canGoNext, isLastStep, validateCurrentStep, currentStep, handleStepChange]);

  const handleBack = useCallback(async () => {
    if (!canGoPrevious) return;
    await handleStepChange(currentStep - 1);
  }, [canGoPrevious, currentStep, handleStepChange]);

  const handleStepClick = useCallback(async (stepIndex: number) => {
    if (!nonLinear) return;
    
    // Can navigate to completed steps or the next step
    const canNavigate = completedSteps.has(stepIndex) || 
                       stepIndex === currentStep + 1;
    
    if (canNavigate && stepIndex !== currentStep) {
      if (stepIndex > currentStep) {
        const isValid = await validateCurrentStep();
        if (!isValid) return;
        setCompletedSteps(prev => new Set(prev).add(currentStep));
      }
      await handleStepChange(stepIndex);
    }
  }, [nonLinear, completedSteps, currentStep, validateCurrentStep, handleStepChange]);

  // Close handlers
  const handleClose = useCallback(() => {
    if (hasUnsavedChanges) {
      setShowUnsavedDialog(true);
    } else {
      onClose?.() || onCancel();
    }
  }, [hasUnsavedChanges, onClose, onCancel]);

  const handleDiscard = useCallback(() => {
    setShowUnsavedDialog(false);
    onClose?.() || onCancel();
  }, [onClose, onCancel]);

  const handleSaveDraft = useCallback(async () => {
    if (!onSaveDraft) return;
    
    try {
      setIsSubmitting(true);
      await onSaveDraft();
      setShowUnsavedDialog(false);
      onClose?.() || onCancel();
    } catch (error) {
      console.error('Save draft failed:', error);
    } finally {
      setIsSubmitting(false);
    }
  }, [onSaveDraft, onClose, onCancel]);

  // Submit handler
  const handleSubmit = useCallback(async () => {
    if (!canSubmit || isSubmitting) return;

    const isValid = await validateCurrentStep();
    if (!isValid) return;

    try {
      setIsSubmitting(true);
      await onSubmit();
    } catch (error) {
      console.error('Submit failed:', error);
      throw error;
    } finally {
      setIsSubmitting(false);
    }
  }, [canSubmit, isSubmitting, validateCurrentStep, onSubmit]);

  // Toggle fullscreen
  const toggleFullscreen = useCallback(() => {
    const next = !isFullscreen;
    setIsFullscreen(next);
    onFullscreenChange?.(next);
  }, [isFullscreen, onFullscreenChange]);

  // Validate on mount and step change
  useEffect(() => {
    validateCurrentStep();
  }, [currentStep]); // eslint-disable-line react-hooks/exhaustive-deps

  // Footer props
  const footerProps: FooterRenderProps = {
    currentStep,
    totalSteps: visibleSteps.length,
    isFirstStep,
    isLastStep,
    canGoNext,
    canGoPrevious,
    onNext: handleNext,
    onBack: handleBack,
    onSubmit: handleSubmit,
    onCancel: handleClose,
    loading: loading || isSubmitting,
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
        {/* Header */}
        <DialogTitle sx={{ pb: 1 }}>
          <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 2 }}>
            <Stack direction="row" spacing={2} alignItems="center">
              {icon}
              <Box>
                <Typography variant="h6">{title}</Typography>
                {subtitle && (
                  <Typography variant="caption" color="text.secondary">
                    {subtitle}
                  </Typography>
                )}
              </Box>
            </Stack>

            <Stack direction="row" spacing={1}>
              {showFullscreenToggle && (
                <IconButton onClick={toggleFullscreen} size="small">
                  {isFullscreen ? <FullscreenExitIcon /> : <FullscreenIcon />}
                </IconButton>
              )}
              {headerActions}
              <IconButton onClick={handleClose} size="small">
                <CloseIcon />
              </IconButton>
            </Stack>
          </Box>

          {/* Stepper */}
          <DialogStepper
            steps={visibleSteps}
            activeStep={currentStep}
            completedSteps={completedSteps}
            onStepClick={nonLinear ? handleStepClick : undefined}
            nonLinear={nonLinear}
            alternativeLabel={visibleSteps.length > 4}
          />
        </DialogTitle>

        {/* Content */}
        <DialogContent dividers sx={{ position: 'relative', minHeight: 200 }}>
          {loading && (
            <Box
              sx={{
                position: 'absolute',
                inset: 0,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                bgcolor: 'background.paper',
                zIndex: 1,
              }}
            >
              <CircularProgress />
            </Box>
          )}
          
          <Box sx={{ opacity: loading ? 0.5 : 1 }}>
            {currentStepConfig?.component}
          </Box>
          
          {stepErrors.has(currentStep) && (
            <Typography color="error" variant="caption" sx={{ mt: 1, display: 'block' }}>
              {stepErrors.get(currentStep)}
            </Typography>
          )}
        </DialogContent>

        {/* Footer */}
        <DialogActions>
          {renderFooter ? (
            renderFooter(footerProps)
          ) : (
            <Box sx={{ display: 'flex', justifyContent: 'space-between', width: '100%', p: 2 }}>
              <Button
                onClick={isFirstStep ? handleClose : handleBack}
                disabled={loading || isSubmitting}
                variant="outlined"
              >
                {isFirstStep ? cancelText : backText}
              </Button>

              <Stack direction="row" spacing={2}>
                {!isLastStep && (
                  <Button
                    onClick={handleNext}
                    disabled={!canGoNext || loading || isSubmitting}
                    variant="contained"
                  >
                    {nextText}
                  </Button>
                )}
                
                {isLastStep && (
                  <Button
                    onClick={handleSubmit}
                    disabled={!canSubmit || isSubmitting}
                    variant="contained"
                  >
                    {isSubmitting ? <CircularProgress size={20} /> : submitText}
                  </Button>
                )}
              </Stack>
            </Box>
          )}
        </DialogActions>
      </Dialog>

      {/* Unsaved changes dialog */}
      <UnsavedChangesDialog
        open={showUnsavedDialog}
        title="Discard Changes?"
        message="You have unsaved changes. Are you sure you want to discard them?"
        showSaveDraft={supportsDraft && !!onSaveDraft}
        onDiscard={handleDiscard}
        onSaveDraft={handleSaveDraft}
        onCancel={() => setShowUnsavedDialog(false)}
      />
    </>
  );
};
