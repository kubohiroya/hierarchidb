/**
  * @file MultiStepDialog.tsx
 * @description
  */

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { NodeId } from '@hierarchidb/common-type';
import {
  Alert,
  Box,
  Button,
  CircularProgress,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Fade,
  IconButton,
  Slide,
  Stack,
  Step,
  StepButton,
  StepLabel,
  Stepper,
  Typography,
} from '@mui/material';
import {
  Check,
  Close,
  Fullscreen as FullscreenIcon,
  FullscreenExit as FullscreenExitIcon,
  NavigateBefore,
  NavigateNext,
} from '@mui/icons-material';
import { TransitionProps } from '@mui/material/transitions';
import { useWizard, WizardProvider } from './StepWizardContext';
import type { DialogStepDefinition } from '../services/DialogStepRegistry';

// ============================================================================
// ============================================================================

/**
    */
export type IconGroupDisplayMode = 'hidden' | 'always' | 'hover';

/**
    */
export interface IconGroupSettings {
  /**
      */
  normalMode: IconGroupDisplayMode;
  /**
      */
  fullscreenMode: IconGroupDisplayMode;
}

/**
    */
export interface MultiStepDialogProps {
  /**
      */
  open: boolean;
  /**
      */
  onClose: () => void;
  /**
      */
  onComplete: (data: Record<string, unknown>) => Promise<void>;
  /**
      */
  steps: DialogStepDefinition[];
  /**
      */
  title?: string;
  /**
      */
  initialData?: Record<string, unknown>;
  /**
      */
  maxWidth?: 'xs' | 'sm' | 'md' | 'lg' | 'xl';
  /**
      */
  fullWidth?: boolean;
  /**
      */
  allowStepNavigation?: boolean;
  /**
      */
  transition?: 'fade' | 'slide';
  /**
   * IDPeerEntity
   */
  nodeId?: NodeId;
  /**
   * PeerEntity
   */
  nodeType?: string;
  /**
      */
  iconGroupSettings?: IconGroupSettings;
  /**
   * URL
   */
  initialStepFromUrl?: number;
  /**
   * URL
   */
  initialFullscreenFromUrl?: boolean;
  /**
   * URL
   */
  initialMapParamsFromUrl?: { zoom: number; lng: number; lat: number };
  /**
      */
  onStepChange?: (step: number) => void;
  /**
      */
  onFullscreenChange?: (isFullscreen: boolean) => void;
  /**
      */
  onMapParamsChange?: (params: { zoom: number; lng: number; lat: number } | undefined) => void;
}

// ============================================================================
// ============================================================================

const SlideTransition = (function Transition(
  props: TransitionProps & {
    children: React.ReactElement<any, any>;
  },
  ref: React.Ref<unknown>,
) {
  return <Slide direction="up" ref={ref} {...props} />;
});

// ============================================================================
// ============================================================================

/**
    */
function StepContentRenderer() {
  const { state, actions, stepDefinitions } = useWizard();
  const currentStepDef = stepDefinitions.find(s => s.stepNumber === state.currentStep);

  if (!currentStepDef) {
    return <Typography>Step not found</Typography>;
  }

  const StepComponent = currentStepDef.component;
  const stepState = state.steps.get(state.currentStep);

  const handleChange = useCallback((data: any) => {
    actions.updateStepData(state.currentStep, data);
  }, [actions, state.currentStep]);

  const handleNext = useCallback((data: any) => {
    actions.updateStepData(state.currentStep, data);
    actions.goToNext();
  }, [actions, state.currentStep]);

  const handlePrevious = useCallback(() => {
    actions.goPrevious();
  }, [actions]);

  return (
    <Box sx={{ minHeight: 300, position: 'relative' }}>
      {state.isLoading && (
        <Box
          sx={{
            position: 'absolute',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            bgcolor: 'rgba(255, 255, 255, 0.7)',
            zIndex: 1,
          }}
        >
          <CircularProgress />
        </Box>
      )}

      <Fade in key={state.currentStep}>
        <Box>
          <StepComponent
            data={stepState?.data || {}}
            onChange={handleChange}
            onNext={handleNext}
            onPrevious={handlePrevious}
            errors={stepState?.errors || []}
            isLoading={state.isLoading}
          />
        </Box>
      </Fade>
    </Box>
  );
}

/**
    */
function StepNavigation({ allowStepNavigation = false }: { allowStepNavigation?: boolean }) {
  const { state, actions, helpers, stepDefinitions } = useWizard();

  const handleStepClick = (stepNumber: number) => {
    if (allowStepNavigation && helpers.canGoToStep(stepNumber)) {
      actions.goToStep(stepNumber);
    }
  };

  return (
    <Stepper activeStep={state.currentStep - 1} sx={{ pt: 3, pb: 5 }}>
      {stepDefinitions.map((step) => {
        const stepState = state.steps.get(step.stepNumber);
        const canNavigate = allowStepNavigation && helpers.canGoToStep(step.stepNumber);

        return (
          <Step key={step.stepNumber} completed={stepState?.isCompleted}>
            {allowStepNavigation ? (
              <StepButton
                onClick={() => handleStepClick(step.stepNumber)}
                disabled={!canNavigate}
              >
                <StepLabel
                  error={stepState?.errors && stepState.errors.length > 0}
                  optional={
                    step.isOptional ? (
                      <Typography variant="caption">Optional</Typography>
                    ) : undefined
                  }
                >
                  {step.title}
                </StepLabel>
              </StepButton>
            ) : (
              <StepLabel
                error={stepState?.errors && stepState.errors.length > 0}
                optional={
                  step.isOptional ? (
                    <Typography variant="caption">Optional</Typography>
                  ) : undefined
                }
              >
                {step.title}
              </StepLabel>
            )}
          </Step>
        );
      })}
    </Stepper>
  );
}

/**
    */
function DialogActionsContent({ onComplete, onClose }: {
  onComplete: (data: Record<string, unknown>) => Promise<void>;
  onClose: () => void
}) {
  const { state, actions, helpers, stepDefinitions } = useWizard();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  const isLastStep = useMemo(() => {
    const sortedSteps = [...stepDefinitions].sort((a, b) => a.stepNumber - b.stepNumber);
    return state.currentStep === sortedSteps[sortedSteps.length - 1]?.stepNumber;
  }, [state.currentStep, stepDefinitions]);

  const handleNext = async () => {
    const currentStepDef = stepDefinitions.find(s => s.stepNumber === state.currentStep);
    const stepState = state.steps.get(state.currentStep);

    if (currentStepDef?.validation) {
      const result = await currentStepDef.validation.validate(stepState?.data || {});
      actions.validateStep(state.currentStep, result);

      if (!result.isValid) {
        return;
      }
    }

    actions.completeStep(state.currentStep);

    if (isLastStep) {
      setIsSubmitting(true);
      setSubmitError(null);

      try {
        await onComplete(helpers.getAllData());
        actions.complete();
        onClose();
      } catch (error) {
        setSubmitError(error instanceof Error ? error.message : 'An error occurred');
      } finally {
        setIsSubmitting(false);
      }
    } else {
      actions.goToNext();
    }
  };

  return (
    <>
      {submitError && (
        <Alert severity="error" sx={{ mr: 2 }}>
          {submitError}
        </Alert>
      )}

      <Button
        onClick={() => actions.goPrevious()}
        disabled={!helpers.canGoPrevious() || isSubmitting}
        startIcon={<NavigateBefore />}
      >
        Previous
      </Button>

      <Box sx={{ flex: '1 0 auto' }} />

      <Button
        onClick={onClose}
        disabled={isSubmitting}
      >
        Cancel
      </Button>

      <Button
        onClick={handleNext}
        variant="contained"
        disabled={isSubmitting}
        startIcon={isSubmitting ? <CircularProgress size={20} /> : isLastStep ? <Check /> : <NavigateNext />}
      >
        {isLastStep ? 'Complete' : 'Next'}
      </Button>
    </>
  );
}

//import { useDialogMode } from '../hooks/useDialogMode.ts.bak';

// ============================================================================
// ============================================================================

/**
    */
export function MultiStepDialog({
                                  open,
                                  onClose,
                                  onComplete,
                                  steps,
                                  title = 'Multi-Step Dialog',
                                  initialData = {},
                                  maxWidth = 'md',
                                  fullWidth = true,
                                  allowStepNavigation = false,
                                  transition = 'fade',
                                  nodeId,
                                  nodeType,
                                  iconGroupSettings: initialIconGroupSettings,
                                  initialStepFromUrl,
                                  initialFullscreenFromUrl,
                                  initialMapParamsFromUrl,
                                  onStepChange,
                                  onFullscreenChange,
                                  onMapParamsChange,
                                }: MultiStepDialogProps) {
  if (steps.length === 0) {
    return null;
  }

  //  PeerEntity
  const {
    dialogMode: savedDialogMode,
    setDialogMode: saveDialogMode,
    resumeStep: savedResumeStep,
    setResumeStep,
    clearResumeStep,
    mapParams: savedMapParams,
    setMapParams,
  } = useDialogMode(
    nodeId,
    nodeType,
    'normal',
  );

  const defaultIconGroupSettings: IconGroupSettings = initialIconGroupSettings ?? {
    normalMode: 'always',
    fullscreenMode: 'hover',
  };

  //  URL : URL > PeerEntity >
  const initialFullscreen = initialFullscreenFromUrl !== undefined
    ? initialFullscreenFromUrl
    : savedDialogMode === 'full';

  //  : URL > PeerEntity >
  const initialStep = initialStepFromUrl || savedResumeStep || 1;

  //  : URL > PeerEntity
  const initialMapParams = initialMapParamsFromUrl || savedMapParams;

  const [isFullscreen, setIsFullscreen] = useState(initialFullscreen);
  const [iconGroupSettings] = useState<IconGroupSettings>(
    initialIconGroupSettings ?? defaultIconGroupSettings,
  );
  const [isHovering, setIsHovering] = useState(false);
  const [isHeaderVisible, setIsHeaderVisible] = useState(!initialFullscreen);
  const [isFooterVisible, setIsFooterVisible] = useState(!initialFullscreen);
  const [currentStep, setCurrentStep] = useState(initialStep);
  const dialogRef = useRef<HTMLDivElement>(null);
  const hoverTimeoutRef = useRef<ReturnType<typeof setTimeout>>();
  const headerTimeoutRef = useRef<ReturnType<typeof setTimeout>>();
  const footerTimeoutRef = useRef<ReturnType<typeof setTimeout>>();

  const toggleFullscreen = useCallback(() => {
    const newFullscreen = !isFullscreen;
    setIsFullscreen(newFullscreen);

    if (newFullscreen) {
      setIsHeaderVisible(false);
      setIsFooterVisible(false);
    } else {
      setIsHeaderVisible(true);
      setIsFooterVisible(true);
    }

    //  PeerEntity
    if (nodeId && nodeType) {
      saveDialogMode(newFullscreen ? 'full' : 'normal');
    }

    if (onFullscreenChange) {
      onFullscreenChange(newFullscreen);
    }
  }, [isFullscreen, nodeId, nodeType, saveDialogMode, onFullscreenChange]);

  const shouldShowIconGroup = useMemo(() => {
    const currentMode = isFullscreen ? iconGroupSettings.fullscreenMode : iconGroupSettings.normalMode;

    switch (currentMode) {
      case 'hidden':
        return false;
      case 'always':
        return true;
      case 'hover':
        return isHovering;
      default:
        return true;
    }
  }, [isFullscreen, iconGroupSettings, isHovering]);

  const handleMouseMove = useCallback((e: React.MouseEvent) => {
    if (!isFullscreen) {
      return;
    }

    const headerThreshold = 60;
    const footerThreshold = 60;
    const windowHeight = window.innerHeight;

    if (e.clientY < headerThreshold) {
      if (!isHeaderVisible) {
        setIsHeaderVisible(true);
        setIsHovering(true);
      }

      if (headerTimeoutRef.current) {
        clearTimeout(headerTimeoutRef.current);
      }

      //  3
      headerTimeoutRef.current = setTimeout(() => {
        setIsHeaderVisible(false);
        setIsHovering(false);
      }, 3000);
    }

    if (e.clientY > windowHeight - footerThreshold) {
      if (!isFooterVisible) {
        setIsFooterVisible(true);
      }

      if (footerTimeoutRef.current) {
        clearTimeout(footerTimeoutRef.current);
      }

      //  3
      footerTimeoutRef.current = setTimeout(() => {
        setIsFooterVisible(false);
      }, 3000);
    }
  }, [isFullscreen, isHeaderVisible, isFooterVisible]);

  const handleMouseLeave = useCallback(() => {
    if (hoverTimeoutRef.current) {
      clearTimeout(hoverTimeoutRef.current);
    }
    if (headerTimeoutRef.current) {
      clearTimeout(headerTimeoutRef.current);
    }
    if (footerTimeoutRef.current) {
      clearTimeout(footerTimeoutRef.current);
    }

    if (isFullscreen) {
      setIsHovering(false);
      setIsHeaderVisible(false);
      setIsFooterVisible(false);
    }
  }, [isFullscreen]);

  useEffect(() => {
    return () => {
      if (hoverTimeoutRef.current) {
        clearTimeout(hoverTimeoutRef.current);
      }
      if (headerTimeoutRef.current) {
        clearTimeout(headerTimeoutRef.current);
      }
      if (footerTimeoutRef.current) {
        clearTimeout(footerTimeoutRef.current);
      }
    };
  }, []);

  //  resumeStep
  useEffect(() => {
    if (nodeId && nodeType && currentStep !== savedResumeStep) {
      setResumeStep(currentStep);
    }
  }, [currentStep, nodeId, nodeType, savedResumeStep, setResumeStep]);

  //  resumeStep
  const handleDialogClose = useCallback(() => {
    //  resumeStep
    if (nodeId && nodeType) {
      setResumeStep(currentStep);
    }
    onClose();
  }, [currentStep, nodeId, nodeType, setResumeStep, onClose]);

  //  resumeStep
  const handleDialogComplete = useCallback(async (data: Record<string, unknown>) => {
    //  resumeStepmapParams
    if (nodeId && nodeType) {
      await clearResumeStep();
      await setMapParams(undefined);
    }
    await onComplete(data);
  }, [nodeId, nodeType, clearResumeStep, setMapParams, onComplete]);

  const handleMapParamsChange = useCallback((params: { zoom: number; lng: number; lat: number } | undefined) => {
    //  PeerEntity
    if (nodeId && nodeType) {
      setMapParams(params);
    }
    if (onMapParamsChange) {
      onMapParamsChange(params);
    }
  }, [nodeId, nodeType, setMapParams, onMapParamsChange]);

  const TransitionComponent = transition === 'slide' ? SlideTransition : Fade;

  return (
    <Dialog
      ref={dialogRef}
      open={open}
      onClose={handleDialogClose}
      maxWidth={isFullscreen ? false : maxWidth}
      fullWidth={!isFullscreen && fullWidth}
      fullScreen={isFullscreen}
      TransitionComponent={TransitionComponent}
      onMouseMove={handleMouseMove}
      onMouseLeave={handleMouseLeave}
    >
      <WizardProvider
        stepDefinitions={steps}
        initialData={{
          ...initialData,
          mapInitialParams: initialMapParams,
          onMapParamsChange: handleMapParamsChange,
        }}
        initialStep={currentStep}
        onStepChange={onStepChange}
      >
        <DialogTitle
          sx={{
            position: isFullscreen ? 'fixed' : 'relative',
            top: isFullscreen ? (isHeaderVisible ? 0 : -80) : 'auto',
            left: 0,
            right: 0,
            zIndex: isFullscreen ? 1300 : 'auto',
            transition: 'top 0.3s ease-in-out',
            backgroundColor: isFullscreen ? 'background.paper' : 'transparent',
            boxShadow: isFullscreen && isHeaderVisible ? '0 2px 8px rgba(0,0,0,0.15)' : 'none',
          }}
        >
          <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <Typography variant="h6">{title}</Typography>

            {/*
*/}
            <Fade in={shouldShowIconGroup}>
              <Stack
                direction="row"
                spacing={1}
                sx={{
                  position: isFullscreen && iconGroupSettings.fullscreenMode === 'hover' ? 'absolute' : 'relative',
                  right: isFullscreen && iconGroupSettings.fullscreenMode === 'hover' ? 16 : 0,
                  top: isFullscreen && iconGroupSettings.fullscreenMode === 'hover' ? 16 : 0,
                  backgroundColor: isFullscreen && iconGroupSettings.fullscreenMode === 'hover'
                    ? 'rgba(255, 255, 255, 0.95)'
                    : 'transparent',
                  borderRadius: 1,
                  padding: isFullscreen && iconGroupSettings.fullscreenMode === 'hover' ? 1 : 0,
                  boxShadow: isFullscreen && iconGroupSettings.fullscreenMode === 'hover'
                    ? '0 2px 8px rgba(0,0,0,0.15)'
                    : 'none',
                }}
              >
                <IconButton
                  onClick={toggleFullscreen}
                  color="inherit"
                  aria-label={isFullscreen ? 'Exit fullscreen' : 'Enter fullscreen'}
                  size="small"
                >
                  {isFullscreen ? <FullscreenExitIcon /> : <FullscreenIcon />}
                </IconButton>
                <IconButton
                  aria-label="close"
                  onClick={onClose}
                  color="inherit"
                  size="small"
                >
                  <Close />
                </IconButton>
              </Stack>
            </Fade>
          </Box>
        </DialogTitle>

        <DialogContent
          sx={{
            paddingTop: isFullscreen ? '80px' : undefined,
            paddingBottom: isFullscreen ? '80px' : undefined,
            height: isFullscreen ? '100vh' : 'auto',
            overflow: 'auto',
          }}
        >
          {/*
*/}
          <Box
            sx={{
              opacity: isFullscreen ? (isHeaderVisible ? 1 : 0) : 1,
              transition: 'opacity 0.3s ease-in-out',
              pointerEvents: isFullscreen && !isHeaderVisible ? 'none' : 'auto',
            }}
          >
            <StepNavigation allowStepNavigation={allowStepNavigation} />
          </Box>
          <StepContentRenderer />
        </DialogContent>

        <DialogActions
          sx={{
            p: 2,
            position: isFullscreen ? 'fixed' : 'relative',
            bottom: isFullscreen ? (isFooterVisible ? 0 : -80) : 'auto',
            left: 0,
            right: 0,
            zIndex: isFullscreen ? 1300 : 'auto',
            transition: 'bottom 0.3s ease-in-out',
            backgroundColor: isFullscreen ? 'background.paper' : 'transparent',
            boxShadow: isFullscreen && isFooterVisible ? '0 -2px 8px rgba(0,0,0,0.15)' : 'none',
            borderTop: isFullscreen && isFooterVisible ? '1px solid' : 'none',
            borderColor: 'divider',
          }}
        >
          <DialogActionsContent onComplete={handleDialogComplete} onClose={handleDialogClose} />
        </DialogActions>
      </WizardProvider>
    </Dialog>
  );
}

export default MultiStepDialog;
