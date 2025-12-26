import type React from 'react';
import { Step, StepButton, StepLabel, Stepper, CircularProgress, Stack, Typography } from '@mui/material';
import type { DialogActionInFlight } from '../types.js';
import { StepStatusIcon } from './StepStatusIcon.js';
import type { Theme } from '@mui/material/styles';

type WorkerStepState = { id: string; enabled?: boolean; completed?: boolean; error?: string | null };
type WorkerDialogState = { steps?: WorkerStepState[] };
type StepDataSnapshot = Record<string, unknown>;

const getProcessingStatus = (data?: StepDataSnapshot | null): string | undefined => {
  if (!data || typeof data !== 'object') return undefined;
  const draftData = (data as { draftData?: unknown }).draftData;
  if (draftData && typeof draftData === 'object') {
    const nestedStatus = (draftData as { processingStatus?: unknown }).processingStatus;
    if (typeof nestedStatus === 'string') return nestedStatus;
  }
  const directStatus = (data as { processingStatus?: unknown }).processingStatus;
  return typeof directStatus === 'string' ? directStatus : undefined;
};

const isBuildRunning = (data?: StepDataSnapshot | null): boolean => {
  const status = getProcessingStatus(data);
  if (!status) return false;
  return ['processing', 'running'].includes(status);
};

export interface PluginDialogStepperProps {
  steps: { id: string; label?: string }[];
  activeStepIndex: number;
  enabledStepIndices: readonly number[];
  validatedStepIndices: readonly number[];
  handleStepClick: (event: React.MouseEvent, idx: number, canNavigate: boolean) => void;
  navigationLocked: boolean;
  workerStepMap?: Map<string, WorkerStepState> | null;
  dialogState?: WorkerDialogState | null;
  pendingAction?: DialogActionInFlight | null;
  stepData?: StepDataSnapshot | null;
  theme: Theme;
}

export const PluginDialogStepper: React.FC<PluginDialogStepperProps> = ({
  steps,
  activeStepIndex,
  enabledStepIndices,
  validatedStepIndices,
  handleStepClick,
  navigationLocked,
  workerStepMap,
  dialogState,
  pendingAction,
  stepData,
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
        const isActive = index === activeStepIndex;
        const previousWorkerStep = index > 0
          ? workerStepMap?.get(steps[index - 1]?.id ?? '') ?? dialogState?.steps?.[index - 1]
          : null;
        const previousCompleted = index === 0
          ? true
          : previousWorkerStep?.completed ?? validatedStepIndices.includes(index - 1);
        const isValidatedButDisabled = completed && !canNavigate && index > 0 && !previousCompleted;
        const showBuildProgress = step.id === 'build' && isActive && isBuildRunning(stepData) && !completed;

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
