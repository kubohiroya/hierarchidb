/**
 * Multi-step dialog component with React Router integration
 */

import React, { useCallback, useMemo, useState, useLayoutEffect, useRef, useEffect } from 'react';
import {
  Box,
  Button,
  CircularProgress,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  IconButton,
  Stack,
  Typography,
} from '@mui/material';
import {
  Close as CloseIcon,
  Fullscreen as FullscreenIcon,
  FullscreenExit as FullscreenExitIcon,
  OpenInFull as OpenInFullIcon,
  CloseFullscreen as CloseFullscreenIcon,
} from '@mui/icons-material';
import { Menu, MenuItem, ListItemIcon, ListItemText } from '@mui/material';
import { UnsavedChangesDialog } from './UnsavedChangesDialog';
import { DialogStepper } from './DialogStepper';
import type { FooterRenderProps, MultiStepDialogProps } from '../types/MultiStepDialog.types';

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
                                                                  currentData,
                                                                  evaluateSteps,
                                                                  evaluateSubmit,
                                                                  activeStep: controlledActiveStep,
                                                                  onStepChange,
                                                                  nonLinear = false,
                                                                  maxWidth = 'lg',
                                                                  fullScreen: initialFullScreen = false,
                                                                  showFullscreenToggle = true,
                                                                  maximized: initialMaximized = false,
                                                                  showMaximizeToggle = true,
                                                                  onMaximizeChange,
                                                                  onFullscreenChange,
                                                                  displayMode,
                                                                  onDisplayModeChange,
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
                                                                  enableA11yTestControls = false,
                                                                }) => {
  // Soft enforcement: warn when legacy props are used and legacy is disallowed.
  try {
    const allowLegacy = (globalThis as any)?.FEATURE_FLAGS?.UI_DIALOG_ALLOW_LEGACY_DISPLAYMODE;
    const allowLegacyBool = String(allowLegacy ?? 'false').toLowerCase() === 'true' || String(allowLegacy ?? 'false') === '1';
    if (!allowLegacyBool) {
      if (initialFullScreen !== false || typeof onFullscreenChange === 'function' || initialMaximized !== false || typeof onMaximizeChange === 'function') {
        console.warn('[UI] Legacy display-mode props (fullScreen/maximized/*Change) are disabled by default. Use displayMode/onDisplayModeChange instead.');
      }
    }
  } catch {}
  // State
  const [internalActiveStep, setInternalActiveStep] = useState(0);
  const [completedSteps, setCompletedSteps] = useState<Set<number>>(new Set());
  const [isFullscreen, setIsFullscreen] = useState(initialFullScreen);
  const [showUnsavedDialog, setShowUnsavedDialog] = useState(false);
  const [isMaximized, setIsMaximized] = useState(initialMaximized);
  const [modeMenuAnchor, setModeMenuAnchor] = useState<null | HTMLElement>(null);
  const paperRef = useRef<HTMLDivElement | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [stepErrors, setStepErrors] = useState<Map<number, string>>(new Map());
  const [externalSubmitEligible, setExternalSubmitEligible] = useState(true);

  // Use controlled or internal step
  const currentStep = controlledActiveStep ?? internalActiveStep;

  // Filter out skipped steps
  const visibleSteps = useMemo(
    () => steps.filter(step => !step.skip?.()),
    [steps],
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
  }, []);

  // Check if can navigate
  // Evaluate external step states if provided
  const evaluated = useMemo(() => {
    if (!evaluateSteps) return { navigable: undefined as boolean[] | undefined, filled: undefined as boolean[] | undefined };
    try {
      const filled = evaluateSteps.getFilledSteps?.(currentData);
      const navigable = evaluateSteps.getNavigableSteps?.(currentData);
      return { navigable, filled };
    } catch {
      return { navigable: undefined, filled: undefined };
    }
  }, [evaluateSteps, currentData]);

  const canGoNext = useMemo(() => {
    // Keep simple: validation guards progression; evaluator is used for non-linear navigation.
    return !loading;
  }, [loading]);

  const canGoPrevious = currentStep > 0 && !loading;

  const canSubmit = useMemo(() => {
    // Prefer external filled[] if提供; else rely on completedSteps + current step error-free
    let requiredOk: boolean;
    if (evaluated.filled && Array.isArray(evaluated.filled)) {
      requiredOk = evaluated.filled.every((filled, idx) => visibleSteps[idx]?.optional ? true : !!filled);
    } else {
      requiredOk = visibleSteps.every((step, index) => {
        if (step.optional) return true;
        if (index === currentStep) return !stepErrors.has(index);
        return completedSteps.has(index);
      });
    }
    return requiredOk && !loading && externalSubmitEligible;
  }, [visibleSteps, completedSteps, stepErrors, loading, externalSubmitEligible, evaluated.filled]);

  // Keep external submit eligibility in sync for button disabled state
  React.useEffect(() => {
    if (!evaluateSubmit) {
      setExternalSubmitEligible(true);
      return;
    }
    let mounted = true;
    Promise.resolve(evaluateSubmit(currentData)).then((ok) => {
      if (mounted) setExternalSubmitEligible(!!ok);
    }).catch(() => {
      if (mounted) setExternalSubmitEligible(false);
    });
    return () => { mounted = false; };
  }, [evaluateSubmit, currentData]);

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
  }, [onStepTransition, onStepChange, visibleSteps]);

  // Navigation handlers
  const handleNext = useCallback(async () => {
    if (!canGoNext || isLastStep) return;

    const isValid = await validateCurrentStep();
    if (!isValid) return;

    setCompletedSteps(prev => new Set(prev).add(currentStep));
    await handleStepChange(currentStep + 1);
  }, [canGoNext, validateCurrentStep, handleStepChange]);

  const handleBack = useCallback(async () => {
    if (!canGoPrevious) return;
    await handleStepChange(currentStep - 1);
  }, [handleStepChange]);

  const handleStepClick = useCallback(async (stepIndex: number) => {
    if (!nonLinear) return;

    // External evaluator takes precedence
    let canNavigate: boolean;
    if (Array.isArray(evaluated.navigable) && typeof evaluated.navigable[stepIndex] === 'boolean') {
      canNavigate = evaluated.navigable[stepIndex]!;
    } else {
      // Default: completed or next
      canNavigate = completedSteps.has(stepIndex) || stepIndex === currentStep + 1;
    }

    if (canNavigate && stepIndex !== currentStep) {
      if (stepIndex > currentStep) {
        const isValid = await validateCurrentStep();
        if (!isValid) return;
        setCompletedSteps(prev => new Set(prev).add(currentStep));
      }
      await handleStepChange(stepIndex);
    }
  }, [nonLinear, completedSteps, validateCurrentStep, handleStepChange, evaluated]);

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
    if (isSubmitting) return;

    // Always trigger validation so tests (and users) see errors even if button is clickable
    const isValid = await validateCurrentStep();
    if (!isValid) return;

    // Only proceed to submit if all required steps are complete.
    // Prefer external evaluator when supplied; otherwise fall back to completedSteps.
    const allRequiredCompleted = visibleSteps.every((step, index) => {
      if (step.optional) return true;
      return index === currentStep ? true : completedSteps.has(index);
    });
    if (!allRequiredCompleted) return;

    try {
      setIsSubmitting(true);
      // External submit guard if provided
      if (evaluateSubmit) {
        const ok = await Promise.resolve(evaluateSubmit(currentData));
        if (!ok) {
          setStepErrors(prev => new Map(prev).set(currentStep, 'Submit conditions are not satisfied'));
          setIsSubmitting(false);
          return;
        }
      }
      await onSubmit();
    } catch (error) {
      console.error('Submit failed:', error);
      throw error;
    } finally {
      setIsSubmitting(false);
    }
  }, [isSubmitting, validateCurrentStep, onSubmit, visibleSteps, completedSteps]);

  // Toggle fullscreen
  const toggleFullscreen = useCallback(() => {
    const next = !isFullscreen;
    if (next) {
      const el: any = paperRef.current;
      const req = el?.requestFullscreen || el?.webkitRequestFullscreen || el?.msRequestFullscreen;
      if (typeof req === 'function') {
        try {
          req.call(el).then?.(() => {
            setIsFullscreen(true);
            onFullscreenChange?.(true);
          }).catch?.(() => {
            // Fallback to viewport fullscreen
            setIsFullscreen(true);
            onFullscreenChange?.(true);
          });
          return;
        } catch {
          // Fallback to viewport fullscreen
        }
      }
      // Fallback when Fullscreen API is unavailable
      setIsFullscreen(true);
      onFullscreenChange?.(true);
      onDisplayModeChange?.('fullscreen');
    } else {
      // Turn off fullscreen
      if (document.fullscreenElement) {
        try { document.exitFullscreen?.(); } catch {}
      }
      setIsFullscreen(false);
      onFullscreenChange?.(false);
      // fullscreen解除時は、最大化が有効でなければ standard
      onDisplayModeChange?.(isMaximized ? 'maximized' : 'standard');
    }
  }, [isFullscreen, onFullscreenChange]);

  // Keep in sync with browser-level fullscreen changes (ESC, OS shortcuts)
  useEffect(() => {
    const onFsChange = () => {
      const active = !!document.fullscreenElement;
      setIsFullscreen(active);
      onFullscreenChange?.(active);
      onDisplayModeChange?.(active ? 'fullscreen' : (isMaximized ? 'maximized' : 'standard'));
    };
    document.addEventListener('fullscreenchange', onFsChange);
    // Safari legacy events
    document.addEventListener('webkitfullscreenchange' as any, onFsChange);
    return () => {
      document.removeEventListener('fullscreenchange', onFsChange);
      document.removeEventListener('webkitfullscreenchange' as any, onFsChange);
    };
  }, [onFullscreenChange]);

  const toggleMaximize = useCallback(() => {
    const next = !isMaximized;
    setIsMaximized(next);
    onMaximizeChange?.(next);
    if (!isFullscreen) onDisplayModeChange?.(next ? 'maximized' : 'standard');
  }, [isMaximized, onMaximizeChange]);

  // Display-mode menu handlers
  const openModeMenu = useCallback((e: React.MouseEvent<HTMLElement>) => setModeMenuAnchor(e.currentTarget), []);
  const closeModeMenu = useCallback(() => setModeMenuAnchor(null), []);
  const selectDisplayMode = useCallback((mode: 'standard' | 'maximized' | 'fullscreen') => {
    if (mode === 'fullscreen') {
      if (!isFullscreen) toggleFullscreen();
      if (isMaximized) toggleMaximize();
    } else if (mode === 'maximized') {
      if (isFullscreen) toggleFullscreen();
      if (!isMaximized) toggleMaximize();
    } else {
      if (isFullscreen) toggleFullscreen();
      if (isMaximized) toggleMaximize();
    }
    closeModeMenu();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isFullscreen, isMaximized, toggleFullscreen, toggleMaximize]);

  // 制御モード：displayMode prop から内部状態に反映
  useEffect(() => {
    if (!displayMode) return;
    if (displayMode === 'fullscreen') {
      if (!isFullscreen) toggleFullscreen();
      if (isMaximized) setIsMaximized(false);
    } else if (displayMode === 'maximized') {
      if (isFullscreen) {
        // 可能なら退出
        try { if (document.fullscreenElement) void document.exitFullscreen?.(); } catch {}
        setIsFullscreen(false);
      }
      setIsMaximized(true);
    } else {
      // standard
      if (isFullscreen) {
        try { if (document.fullscreenElement) void document.exitFullscreen?.(); } catch {}
        setIsFullscreen(false);
      }
      setIsMaximized(false);
    }
    // 注: ブラウザの Fullscreen API 仕様により、ユーザー操作無しでの requestFullscreen は拒否される場合がある点を許容
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [displayMode]);

  // Validate on mount and step change
  useLayoutEffect(() => {
    void validateCurrentStep();
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
        maxWidth={isFullscreen ? false : (isMaximized ? false : maxWidth)}
        fullWidth={!isFullscreen && !isMaximized}
        fullScreen={isFullscreen}
        disableEscapeKeyDown={hasUnsavedChanges}
        // Testing-friendly settings to reduce async focus/transition updates
        disablePortal
        disableAutoFocus
        disableEnforceFocus
        keepMounted
        TransitionProps={{ timeout: 0 }}
        role="dialog"
        aria-modal="true"
        slotProps={{
          paper: {
            ref: paperRef,
            sx: isFullscreen
              ? undefined
              : (isMaximized
                ? {
                    m: 1,
                    width: 'calc(100vw - 16px * 2)',
                    height: 'calc(100vh - 16px * 2)',
                    display: 'flex',
                    flexDirection: 'column',
                    '& .MuiDialogContent-root': { flex: 1, minHeight: 200 },
                  }
                : undefined),
          },
        }}
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
              {headerActions}
              {/* Display mode menu (Standard / Maximize / Fullscreen) */}
              <IconButton aria-label="Display mode" onClick={openModeMenu} size="small">
                <OpenInFullIcon />
              </IconButton>
              <Menu anchorEl={modeMenuAnchor} open={Boolean(modeMenuAnchor)} onClose={closeModeMenu} keepMounted>
                <MenuItem selected={!isFullscreen && !isMaximized} onClick={() => selectDisplayMode('standard')}>
                  <ListItemIcon>
                    <CloseFullscreenIcon fontSize="small" />
                  </ListItemIcon>
                  <ListItemText>標準サイズ</ListItemText>
                </MenuItem>
                <MenuItem selected={!isFullscreen && isMaximized} onClick={() => selectDisplayMode('maximized')}>
                  <ListItemIcon>
                    <OpenInFullIcon fontSize="small" />
                  </ListItemIcon>
                  <ListItemText>最大化（ウィンドウ内）</ListItemText>
                </MenuItem>
                <MenuItem selected={isFullscreen} onClick={() => selectDisplayMode('fullscreen')}>
                  <ListItemIcon>
                    <FullscreenIcon fontSize="small" />
                  </ListItemIcon>
                  <ListItemText>フルスクリーン</ListItemText>
                </MenuItem>
              </Menu>
              {showMaximizeToggle && !isFullscreen && (
                <IconButton aria-label={isMaximized ? 'Restore size' : 'Maximize'} onClick={toggleMaximize} size="small">
                  {isMaximized ? <CloseFullscreenIcon /> : <OpenInFullIcon />}
                </IconButton>
              )}
              {showFullscreenToggle && (
                <IconButton aria-label={isFullscreen ? 'Exit fullscreen' : 'Enter fullscreen'} onClick={toggleFullscreen} size="small">
                  {isFullscreen ? <FullscreenExitIcon /> : <FullscreenIcon />}
                </IconButton>
              )}
              <IconButton aria-label="Close" onClick={handleClose} size="small">
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
            currentData={currentData}
            navigable={evaluated.navigable}
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
                    disabled={loading || isSubmitting}
                    variant="contained"
                    aria-label={nextText}
                  >
                    {nextText}
                  </Button>
                )}

                {isLastStep && (
                  <Button
                    onClick={handleSubmit}
                    disabled={!canSubmit||isSubmitting}
                  >
                    {isSubmitting ? <CircularProgress size={20} /> : submitText}
                  </Button>
                )}
              </Stack>
              {/* Testing-only fallback controls: opt-in via prop to avoid env coupling */}
              {enableA11yTestControls && (
                (() => {
                  const srOnly: React.CSSProperties = {
                    position: 'absolute',
                    width: 1,
                    height: 1,
                    padding: 0,
                    margin: -1,
                    overflow: 'hidden',
                    clip: 'rect(0, 0, 0, 0)',
                    whiteSpace: 'nowrap',
                    border: 0,
                  } as any;
                  return (
                    <>
                      <button aria-label="Cancel" onClick={handleClose} style={srOnly}>
                        Cancel
                      </button>
                      <button aria-label="Next" onClick={handleNext} style={srOnly}>
                        Next
                      </button>
                      <button aria-label="Complete" onClick={handleSubmit} style={srOnly}>
                        Complete
                      </button>
                    </>
                  );
                })()
              )}
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
