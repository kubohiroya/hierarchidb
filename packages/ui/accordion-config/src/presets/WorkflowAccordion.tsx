import React from 'react';
import { StyledAccordion, StyledAccordionProps } from '../components/StyledAccordion.js';
import { Chip } from '@mui/material';
import type { ChipProps } from '@mui/material';

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

const getStatusColor = (status?: WorkflowStep['status']) => {
  switch (status) {
    case 'completed':
      return 'success';
    case 'active':
      return 'primary';
    case 'error':
      return 'error';
    case 'skipped':
      return 'default';
    default:
      return 'default';
  }
};

/**
 * Accordion designed for workflow/process steps
 * Can be used for wizards, multi-step forms, batch processes, etc.
 */
export const WorkflowAccordion: React.FC<WorkflowAccordionProps> = ({
                                                                      step,
                                                                      showStepBadge = true,
                                                                      renderStep,
                                                                      ...accordionProps
                                                                    }) => {
  const stepElement = React.useMemo(() => {
    if (!step || !showStepBadge) return null;

    if (renderStep) {
      return renderStep(step);
    }

    const label = step.label || `Step ${step.id}`;
    const color = step.badgeColor || getStatusColor(step.status);
    const muiColors: Array<ChipProps['color']> = ['default', 'primary', 'secondary', 'error', 'info', 'success', 'warning'];
    const muiColor = muiColors.includes(color as ChipProps['color']) ? (color as ChipProps['color']) : undefined;
    const chipSx = muiColor
      ? undefined
      : {
        backgroundColor: color,
        color: '#fff',
      };

    return (
      <Chip
        label={label}
        color={muiColor}
        size="small"
        variant={step.status === 'active' ? 'filled' : 'outlined'}
        sx={chipSx}
      />
    );
  }, [step, showStepBadge, renderStep]);

  return (
    <StyledAccordion
      {...accordionProps}
      icon={stepElement}
    />
  );
};
