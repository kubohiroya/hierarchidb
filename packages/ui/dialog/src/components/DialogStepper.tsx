/**
 * Dialog stepper component with direct link support
 */

import React from 'react';
import { Step, StepButton, StepLabel, Stepper, Typography } from '@mui/material';
// import { useLocation, Link } from 'react-router-dom';
import type { StepperProps } from '../types/MultiStepDialog.types';

/**
 * Dialog stepper component
 */
export const DialogStepper: React.FC<StepperProps & {
  currentData?: any;
  // baseUrl?: string;
  /** Optional externally-evaluated navigability array */
  navigable?: boolean[];
}> = ({
        steps,
        activeStep,
        completedSteps,
        onStepClick,
        nonLinear = false,
        alternativeLabel = false,
        currentData = {},
        navigable,
        // baseUrl,
      }) => {
  // const location = useLocation();

  // Build URL for each step (currently unused)
  // const getStepUrl = useMemo(() => {
  //   if (!baseUrl) return () => null;
  //   
  //   return (stepIndex: number) => {
  //     // Parse current URL and update step parameter
  //     const url = new URL(window.location.href);
  //     url.searchParams.set('step', String(stepIndex + 1)); // 1-based index for URLs
  //     return url.pathname + url.search;
  //   };
  // }, [baseUrl]);

  // Check if a step can be navigated to
  const canNavigateToStep = (stepIndex: number) => {
    const step = steps[stepIndex];
    if (!step) return false;

    // If external navigability is provided, honor it first
    if (Array.isArray(navigable) && typeof navigable[stepIndex] === 'boolean') {
      return navigable[stepIndex]!;
    }

    // If step has capabilities, check canNavigateTo
    if (step.capabilities?.canNavigateTo) {
      return step.capabilities.canNavigateTo(activeStep, currentData);
    }

    // Default behavior: can navigate to completed steps or next step
    return completedSteps.has(stepIndex) || stepIndex === activeStep + 1;
  };

  return (
    <Stepper
      activeStep={activeStep}
      alternativeLabel={alternativeLabel}
      sx={{ pt: 2 }}
    >
      {steps.map((step, index) => {
        const isCompleted = completedSteps.has(index);
        const isActive = index === activeStep;
        const canNavigate = nonLinear && canNavigateToStep(index);
        // const stepUrl = getStepUrl(index);

        return (
          <Step key={step.id} completed={isCompleted}>
            {canNavigate && onStepClick ? (
              <StepButton
                onClick={() => onStepClick(index)}
                optional={
                  step.optional ? (
                    <Typography variant="caption">Optional</Typography>
                  ) : undefined
                }
                icon={step.icon}
                disabled={!canNavigate}
              >
                {step.label}
              </StepButton>
            ) : (
              <StepLabel
                optional={
                  step.optional ? (
                    <Typography variant="caption">Optional</Typography>
                  ) : undefined
                }
                icon={step.icon}
                error={!isCompleted && !isActive && index < activeStep}
                sx={{
                  cursor: canNavigate ? 'pointer' : 'default',
                  opacity: canNavigate ? 1 : 0.5,
                }}
              >
                {step.label}
              </StepLabel>
            )}
          </Step>
        );
      })}
    </Stepper>
  );
};
