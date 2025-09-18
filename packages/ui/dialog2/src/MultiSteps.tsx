import Box from '@mui/material/Box';
import Step from '@mui/material/Step';
import StepLabel from '@mui/material/StepLabel';
import Stepper from '@mui/material/Stepper';
import Typography from '@mui/material/Typography';
import type { ComponentType, ReactElement, ReactNode } from 'react';

export interface MultiStepComponentProps {
  stepIndex: number;
  stepId?: string;
  label: string;
  isEnabled: boolean;
  isValidated: boolean;
}

export interface MultiStepDefinition {
  id?: string;
  label: string;
  component: ComponentType<MultiStepComponentProps>;
  enabled?: boolean;
  validated?: boolean;
}

export interface MultiStepsHeaderRenderProps {
  steps: ReadonlyArray<MultiStepDefinition>;
  activeStepIndex: number;
}

export interface MultiStepsProps {
  steps: ReadonlyArray<MultiStepDefinition>;
  activeStepIndex: number;
  emptyPlaceholder?: ReactNode;
  renderHeader?: (props: MultiStepsHeaderRenderProps) => ReactNode;
}

export const MultiSteps = ({
  steps,
  activeStepIndex,
  emptyPlaceholder = (
    <Typography color="text.secondary" variant="body2">
      No step content available.
    </Typography>
  ),
  renderHeader,
}: MultiStepsProps): ReactElement => {
  const stepCount = steps.length;
  const safeActiveIndex = clampIndex(activeStepIndex, stepCount);
  const activeStep = steps[safeActiveIndex];

  const headerProps: MultiStepsHeaderRenderProps = {
    steps,
    activeStepIndex: safeActiveIndex,
  };

  const ActiveComponent = activeStep?.component;
  const componentProps: MultiStepComponentProps | undefined = ActiveComponent
    ? {
        stepIndex: safeActiveIndex,
        stepId: activeStep?.id,
        label: activeStep?.label ?? `Step ${safeActiveIndex + 1}`,
        isEnabled: getEnabledFlag(activeStep),
        isValidated: getValidatedFlag(activeStep),
      }
    : undefined;

  const header = renderHeader ? renderHeader(headerProps) : renderDefaultHeader(headerProps);

  return (
    <Box display="flex" flexDirection="column" gap={3}>
      {header}
      <Box>{componentProps && ActiveComponent ? <ActiveComponent {...componentProps} /> : emptyPlaceholder}</Box>
    </Box>
  );
};

const clampIndex = (index: number, length: number): number => {
  if (length === 0) {
    return 0;
  }

  if (Number.isNaN(index) || index < 0) {
    return 0;
  }

  if (index >= length) {
    return length - 1;
  }

  return index;
};

const getEnabledFlag = (step?: MultiStepDefinition): boolean => {
  if (!step) {
    return true;
  }

  return step.enabled ?? true;
};

const getValidatedFlag = (step?: MultiStepDefinition): boolean => {
  if (!step) {
    return false;
  }

  return step.validated ?? false;
};

const renderDefaultHeader = ({ steps, activeStepIndex }: MultiStepsHeaderRenderProps): ReactNode => {
  return (
    <Stepper activeStep={activeStepIndex} alternativeLabel>
      {steps.map((step, index) => {
        const label = step.label ?? `Step ${index + 1}`;
        const isEnabled = getEnabledFlag(step);
        const isValidated = getValidatedFlag(step);
        const key = step.id ?? `${index}-${label}`;

        return (
          <Step key={key} completed={isValidated} disabled={!isEnabled}>
            <StepLabel error={!isEnabled && !isValidated}>{label}</StepLabel>
          </Step>
        );
      })}
    </Stepper>
  );
};

export default MultiSteps;
