import type React from 'react';
import { Step, StepButton, StepLabel, Stepper, CircularProgress, Stack, Typography } from '@mui/material';
import type { StepIconProps } from '@mui/material/StepIcon';
import { Link } from '@tanstack/react-router';
import type { DialogActionInFlight } from '../types.js';
import { StepIconComponent } from './StepIconComponent.js';
import type { Theme } from '@mui/material/styles';

type WorkerStepState = { id: string; enabled?: boolean; completed?: boolean; error?: string | null };
type WorkerDialogState = { steps?: WorkerStepState[] };

type StepIconWrapperProps = StepIconProps & {
  index: number;
  icon?: React.ReactNode;
  theme: Theme;
  canNavigate: boolean;
  isValidatedButDisabled: boolean;
};

const StepIconWrapper: React.FC<StepIconWrapperProps> = ({
  index,
  icon,
  theme,
  canNavigate,
  isValidatedButDisabled,
  ...iconProps
}) => (
  <StepIconComponent
    {...iconProps}
    index={index}
    icon={icon}
    theme={theme}
    canNavigate={canNavigate}
    isValidatedButDisabled={isValidatedButDisabled}
  />
);

export interface PluginDialogStepperProps {
  steps: { id: string; label?: string }[];
  activeStepIndex: number;
  enabledStepIndices: readonly number[];
  validatedStepIndices: readonly number[];
  buildStepLink: (idx: number) => string;
  handleStepClick: (event: React.MouseEvent, idx: number, canNavigate: boolean) => void;
  navigationLocked: boolean;
  workerStepMap?: Map<string, WorkerStepState> | null;
  dialogState?: WorkerDialogState | null;
  pendingAction?: DialogActionInFlight | null;
  icon?: React.ReactNode;
  theme: Theme;
}

export const PluginDialogStepper: React.FC<PluginDialogStepperProps> = ({
  steps,
  activeStepIndex,
  enabledStepIndices,
  validatedStepIndices,
  buildStepLink,
  handleStepClick,
  navigationLocked,
  workerStepMap,
  dialogState,
  pendingAction,
  icon,
  theme,
}) => {
  return (
    <Stepper nonLinear activeStep={activeStepIndex} alternativeLabel>
      {steps.map((step, index) => {
        const workerStep = workerStepMap?.get(step.id) ?? dialogState?.steps?.[index];
        const fallbackCanNavigate = enabledStepIndices.includes(index) || index === activeStepIndex;
        const canNavigate = workerStep?.enabled ?? fallbackCanNavigate;
        const completed = workerStep?.completed ?? validatedStepIndices.includes(index);
        const label = workerStep?.id ?? step.label ?? step.id;
        const stepLink = buildStepLink(index);
        const isActive = index === activeStepIndex;
        const previousWorkerStep = index > 0
          ? workerStepMap?.get(steps[index - 1]?.id ?? '') ?? dialogState?.steps?.[index - 1]
          : null;
        const previousCompleted = index === 0
          ? true
          : previousWorkerStep?.completed ?? validatedStepIndices.includes(index - 1);
        const isValidatedButDisabled = completed && !canNavigate && index > 0 && !previousCompleted;

        return (
          <Step key={step.id} completed={completed}>
            <StepButton
              component={Link}
              to={stepLink}
              disabled={!canNavigate || navigationLocked}
              preload="intent"
              onClick={(event) => handleStepClick(event, index, canNavigate)}
              aria-current={isActive ? 'step' : undefined}
              sx={{ padding: 0, margin: 0 }}
            >
              <StepLabel
                slots={{
                  stepIcon: (props) => (
                    <StepIconWrapper
                      {...props}
                      index={index}
                      icon={icon}
                      theme={theme}
                      canNavigate={canNavigate}
                      isValidatedButDisabled={isValidatedButDisabled}
                    />
                  ),
                }}
              >
                <Stack direction="row" alignItems="center" spacing={0.75}>
                  <Typography
                    variant="caption"
                    noWrap
                    sx={{
                      color: isActive ? 'primary.main' : 'text.secondary',
                      fontWeight: isActive ? 600 : 400,
                    }}
                    data-active-label={isActive ? 'true' : 'false'}
                  >
                    {label}
                  </Typography>
                  {pendingAction?.type === 'step' && pendingAction.index === index ? (
                    <CircularProgress size={12} thickness={5} color="inherit" />
                  ) : null}
                </Stack>
              </StepLabel>
            </StepButton>
          </Step>
        );
      })}
    </Stepper>
  );
};

PluginDialogStepper.displayName = 'PluginDialogStepper';
