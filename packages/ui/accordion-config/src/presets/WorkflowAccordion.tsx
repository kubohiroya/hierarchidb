import React from 'react';
import { StyledAccordion, type StyledAccordionProps } from '~/components/StyledAccordion';
import { Chip } from '@mui/material';
import { useWorkflowAccordionView } from './useWorkflowAccordionView.js';

export interface WorkflowStep {
  /** Step number or identifier */
  id: string | number;
  /** Step label (e.g., "Step 1", "Phase 1") */
  label?: string;
  /** Step status */
  status?: 'pending' | 'active' | 'completed' | 'error' | 'skipped';
  /** Custom badge color */
  badgeColor?: string;
}

export interface WorkflowAccordionProps extends Omit<StyledAccordionProps, 'icon'> {
  /** Workflow step configuration */
  step?: WorkflowStep;
  /** Whether to show step badge */
  showStepBadge?: boolean;
  /** Custom step renderer */
  renderStep?: (step: WorkflowStep) => React.ReactNode;
}

/**
 * Accordion designed for workflow/process steps
 * Can be used for wizards, multi-step forms, build processes, etc.
 */
export const WorkflowAccordion: React.FC<WorkflowAccordionProps> = ({
                                                                      step,
                                                                      showStepBadge = true,
                                                                      renderStep,
                                                                      ...accordionProps
                                                                    }) => {
  const {
    shouldRenderStepBadge,
    label,
    color,
    chipSx,
    variant,
  } = useWorkflowAccordionView({
    step,
    showStepBadge,
  });
  const stepElement = step && shouldRenderStepBadge
    ? (renderStep?.(step) ?? (
      <Chip
        label={label}
        color={color}
        size="small"
        variant={variant}
        sx={chipSx}
      />
    ))
    : null;

  return (
    <StyledAccordion
      {...accordionProps}
      icon={stepElement}
    />
  );
};
