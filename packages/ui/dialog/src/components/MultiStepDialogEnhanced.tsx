/**
 * Enhanced Multi-step dialog with auto-hide functionality
 */

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Box,
  Button,
  CircularProgress,
  Collapse,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Fade,
  IconButton,
  Stack,
  Typography,
} from '@mui/material';
import {
  Close as CloseIcon,
  Fullscreen as FullscreenIcon,
  FullscreenExit as FullscreenExitIcon,
  KeyboardArrowDown as ExpandIcon,
  KeyboardArrowUp as CollapseIcon,
} from '@mui/icons-material';
import { UnsavedChangesDialog } from './UnsavedChangesDialog';
import { DialogStepper } from './DialogStepper';
import type { FooterRenderProps, MultiStepDialogProps } from '../types/MultiStepDialog.types';

/**
 * Enhanced Multi-step dialog component with auto-hide
 */
export const MultiStepDialogEnhanced: React.FC<MultiStepDialogProps & {
  autoHideHeader?: boolean;
  autoHideFooter?: boolean;
  autoHideDelay?: number;
  currentData?: any;
  onDataChange?: (data: any) => void;
}> = ({
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
        autoHideHeader = true,
        autoHideFooter = true,
        autoHideDelay = 3000,
        currentData = {},
        // onDataChange,
      }) => {
  // State
  const [internalActiveStep, setInternalActiveStep] = useState(0);
  const [completedSteps, setCompletedSteps] = useState<Set<number>>(new Set());
  const [isFullscreen, setIsFullscreen] = useState(initialFullScreen);
  const [showUnsavedDialog, setShowUnsavedDialog] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [stepErrors, setStepErrors] = useState<Map<number, string>>(new Map());

  // Auto-hide states
  const [headerVisible, setHeaderVisible] = useState(true);
  const [footerVisible, setFooterVisible] = useState(true);
  const [mouseInHeader, setMouseInHeader] = useState(false);
  const [mouseInFooter, setMouseInFooter] = useState(false);
  const [lastActivity, setLastActivity] = useState(Date.now());

  // Use controlled or internal step
  const currentStep = controlledActiveStep ?? internalActiveStep;

  // Filter out skipped steps
  const visibleSteps = useMemo(
    () => steps.filter(step => !step.skip?.()),
    [steps],
  );

  // Get current step config
  const currentStepConfig = visibleSteps[currentStep];

  // Auto-hide logic for fullscreen mode
  useEffect(() => {
    if (!isFullscreen || !autoHideHeader) return;

    const timer = setTimeout(() => {
      if (Date.now() - lastActivity > autoHideDelay && !mouseInHeader) {
        setHeaderVisible(false);
      }
    }, autoHideDelay);

    return () => clearTimeout(timer);
  }, [isFullscreen, autoHideHeader, autoHideDelay, lastActivity, mouseInHeader]);

  useEffect(() => {
    if (!isFullscreen || !autoHideFooter) return;

    const timer = setTimeout(() => {
      if (Date.now() - lastActivity > autoHideDelay && !mouseInFooter) {
        setFooterVisible(false);
      }
    }, autoHideDelay);

    return () => clearTimeout(timer);
  }, [isFullscreen, autoHideFooter, autoHideDelay, lastActivity, mouseInFooter]);

  // Track user activity
  const handleActivity = useCallback(() => {
    setLastActivity(Date.now());
    if (isFullscreen) {
      setHeaderVisible(true);
      setFooterVisible(true);
    }
  }, [isFullscreen]);

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

  // Check capabilities using plugin-provided functions
  const canGoNext = useMemo(() => {
    if (loading || stepErrors.has(currentStep)) return false;

    // Check plugin-provided capability
    if (currentStepConfig?.capabilities?.canProceedToNext) {
      const result = currentStepConfig.capabilities.canProceedToNext(currentData);
      return result instanceof Promise ? false : result;
    }

    return true;
  }, [currentStep, stepErrors, loading, currentStepConfig, currentData]);

  const canGoPrevious = useMemo(() => {
    if (currentStep === 0 || loading) return false;

    // Check plugin-provided capability for going back
    if (currentStepConfig?.capabilities?.canBackToPrevious) {
      const result = currentStepConfig.capabilities.canBackToPrevious(currentData);
      return result instanceof Promise ? false : result;
    }

    return true;
  }, [currentStep, loading, currentStepConfig, currentData]);

  const canSave = useMemo(() => {
    if (loading) return false;

    // Check plugin-provided capability for saving
    if (currentStepConfig?.capabilities?.canSave) {
      const result = currentStepConfig.capabilities.canSave(currentData);
      return result instanceof Promise ? false : result;
    }

    // Default: can save if all required steps are completed
    return visibleSteps.every((step, index) => {
      if (step.optional) return true;
      if (index === currentStep) return !stepErrors.has(index);
      return completedSteps.has(index);
    });
  }, [visibleSteps, currentStep, completedSteps, stepErrors, loading, currentStepConfig, currentData]);

  const canStartBatch = useMemo(() => {
    if (loading) return false;

    // Check plugin-provided capability for batch
    if (currentStepConfig?.capabilities?.canStartBatch) {
      const result = currentStepConfig.capabilities.canStartBatch(currentData);
      return result instanceof Promise ? false : result;
    }

    return false;
  }, [loading, currentStepConfig, currentData]);

  // Handle step change
  const handleStepChange = useCallback(async (newStep: number) => {
    handleActivity();

    if (onStepTransition) {
      const canTransition = await onStepTransition(currentStep, newStep);
      if (!canTransition) return;
    }

    await currentStepConfig?.onLeave?.();

    if (onStepChange) {
      onStepChange(newStep);
    } else {
      setInternalActiveStep(newStep);
    }

    const newStepConfig = visibleSteps[newStep];
    await newStepConfig?.onEnter?.();
  }, [currentStep, currentStepConfig, onStepTransition, onStepChange, visibleSteps, handleActivity]);

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
    if (!canSave || isSubmitting) return;

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
  }, [canSave, isSubmitting, validateCurrentStep, onSubmit]);

  // Toggle fullscreen
  const toggleFullscreen = useCallback(() => {
    setIsFullscreen(!isFullscreen);
    handleActivity();
  }, [isFullscreen, handleActivity]);

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

  // Check if this is a batch dialog
  const isBatchDialog = visibleSteps.some(step => step.id?.includes('batch'));

  // Special button text for batch operations
  const getSubmitButtonText = () => {
    if (isSubmitting) return <CircularProgress size={20} />;

    // Show "Start Batch" for batch dialogs
    if (isBatchDialog) {
      return 'Start Batch';
    }

    return submitText;
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
        onMouseMove={handleActivity}
      >
        {/* Header with auto-hide */}
        <Collapse in={!isFullscreen || headerVisible} timeout={300}>
          <DialogTitle
            sx={{ pb: 1 }}
            onMouseEnter={() => setMouseInHeader(true)}
            onMouseLeave={() => setMouseInHeader(false)}
          >
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
                {isFullscreen && autoHideHeader && (
                  <IconButton onClick={() => setHeaderVisible(!headerVisible)} size="small">
                    {headerVisible ? <CollapseIcon /> : <ExpandIcon />}
                  </IconButton>
                )}
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
              currentData={currentData}

            />
          </DialogTitle>
        </Collapse>

        {/* Content */}
        <DialogContent
          dividers
          sx={{
            position: 'relative',
            minHeight: 200,
            pt: isFullscreen && !headerVisible ? 4 : undefined,
            pb: isFullscreen && !footerVisible ? 4 : undefined,
          }}
        >
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

        {/* Footer with auto-hide */}
        <Fade in={!isFullscreen || footerVisible} timeout={300}>
          <DialogActions
            onMouseEnter={() => setMouseInFooter(true)}
            onMouseLeave={() => setMouseInFooter(false)}
          >
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
                  {isFullscreen && autoHideFooter && (
                    <IconButton onClick={() => setFooterVisible(!footerVisible)} size="small">
                      {footerVisible ? <CollapseIcon /> : <ExpandIcon />}
                    </IconButton>
                  )}

                  {/* For batch dialogs, show both Next and Start Batch buttons */}
                  {isBatchDialog ? (
                    <>
                      {!isLastStep && (
                        <Button
                          onClick={handleNext}
                          disabled={!canGoNext || loading || isSubmitting}
                          variant="outlined"
                        >
                          {nextText}
                        </Button>
                      )}
                      <Button
                        onClick={handleSubmit}
                        disabled={!canStartBatch || isSubmitting}
                        variant="contained"
                      >
                        {getSubmitButtonText()}
                      </Button>
                    </>
                  ) : (
                    <>
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
                          disabled={!canSave || isSubmitting}
                          variant="contained"
                        >
                          {getSubmitButtonText()}
                        </Button>
                      )}
                    </>
                  )}
                </Stack>
              </Box>
            )}
          </DialogActions>
        </Fade>
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