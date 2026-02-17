import {
  Stack,
  Step,
  StepButton,
  StepLabel,
  Stepper,
  Typography,
} from '@mui/material';
import type { Theme } from '@mui/material/styles';
import type React from 'react';
import { StepStatusIcon } from './StepStatusIcon.js';

type WorkerStepState = {
  id: string;
  enabled?: boolean;
  completed?: boolean;
  error?: string | null;
};
type WorkerDialogState = { steps?: WorkerStepState[] };

export interface PluginDialogStepperProps {
  steps: { id: string; label?: string }[];
  activeStepIndex: number;
  enabledStepIndices: readonly number[];
  validatedStepIndices: readonly number[];
  handleStepClick: (event: React.MouseEvent, idx: number, canNavigate: boolean) => void;
  navigationLocked: boolean;
  workerStepMap?: Map<string, WorkerStepState> | null;
  dialogState?: WorkerDialogState | null;
  buildStepRunning?: boolean;
  theme: Theme;
}

const stripStepNumberPrefix = (label: string): string => label.replace(/^\s*\d+\.\s*/, '').trim();

const formatIndexedStepLabel = (label: string, stepIndex: number): string =>
  `${stepIndex + 1}. ${stripStepNumberPrefix(label)}`;

export const PluginDialogStepper: React.FC<PluginDialogStepperProps> = ({
  steps,
  activeStepIndex,
  enabledStepIndices,
  validatedStepIndices,
  handleStepClick,
  navigationLocked,
  workerStepMap,
  dialogState,
  buildStepRunning = false,
  theme,
}) => {
  return (
    <Stepper nonLinear activeStep={activeStepIndex} alternativeLabel>
      {steps.map((step, index) => {
        const workerStep = workerStepMap?.get(step.id) ?? dialogState?.steps?.[index];
        const fallbackCanNavigate = enabledStepIndices.includes(index) || index === activeStepIndex;
        const canNavigate = workerStep?.enabled ?? fallbackCanNavigate;
        const completed = workerStep?.completed ?? validatedStepIndices.includes(index);
        const baseLabel = step.label ?? step.id;
        const label = formatIndexedStepLabel(baseLabel, index);
        const isActive = index === activeStepIndex;
        const previousWorkerStep =
          index > 0
            ? (workerStepMap?.get(steps[index - 1]?.id ?? '') ?? dialogState?.steps?.[index - 1])
            : null;
        const previousCompleted =
          index === 0
            ? true
            : (previousWorkerStep?.completed ?? validatedStepIndices.includes(index - 1));
        const isValidatedButDisabled = completed && !canNavigate && index > 0 && !previousCompleted;
        const showBuildProgress =
          step.id === 'build' && isActive && buildStepRunning && !completed;

        return (
          <Step key={step.id} completed={completed}>
            <StepButton
              disabled={!canNavigate || navigationLocked}
              onClick={(event) => handleStepClick(event, index, canNavigate)}
              aria-current={isActive ? 'step' : undefined}
              sx={{ padding: 0, margin: 0 }}
            >
              <StepLabel
                slots={{
                  stepIcon: (props) => {
                    const iconIndex =
                      typeof props.icon === 'number' ? Number(props.icon) - 1 : index;
                    return (
                      <StepStatusIcon
                        {...props}
                        theme={theme}
                        stepIndex={iconIndex}
                        stepLabel={baseLabel}
                        canNavigate={canNavigate}
                        variant={isValidatedButDisabled ? 'validated-disabled' : undefined}
                        inProgress={showBuildProgress}
                      />
                    );
                  },
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
