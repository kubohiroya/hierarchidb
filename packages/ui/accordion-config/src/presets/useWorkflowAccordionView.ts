import type { ChipProps } from '@mui/material';
import { useMemo } from 'react';
import type { WorkflowStep } from './WorkflowAccordion.js';

interface UseWorkflowAccordionViewParams {
  step?: WorkflowStep;
  showStepBadge: boolean;
}

interface UseWorkflowAccordionViewResult {
  shouldRenderStepBadge: boolean;
  label: string;
  color?: ChipProps['color'];
  chipSx?: {
    backgroundColor: string;
    color: string;
  };
  variant: 'filled' | 'outlined';
}

const MUI_COLORS: Array<ChipProps['color']> = [
  'default',
  'primary',
  'secondary',
  'error',
  'info',
  'success',
  'warning',
];

function resolveStatusColor(status?: WorkflowStep['status']): string {
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
}

export function useWorkflowAccordionView({
  step,
  showStepBadge,
}: UseWorkflowAccordionViewParams): UseWorkflowAccordionViewResult {
  return useMemo(() => {
    if (!step || !showStepBadge) {
      return {
        shouldRenderStepBadge: false,
        label: '',
        color: undefined,
        chipSx: undefined,
        variant: 'outlined' as const,
      };
    }

    const label = step.label ?? `Step ${step.id}`;
    const resolvedColor = step.badgeColor ?? resolveStatusColor(step.status);
    const color = MUI_COLORS.includes(resolvedColor as ChipProps['color'])
      ? (resolvedColor as ChipProps['color'])
      : undefined;

    return {
      shouldRenderStepBadge: true,
      label,
      color,
      chipSx: color
        ? undefined
        : {
            backgroundColor: resolvedColor,
            color: '#fff',
          },
      variant: step.status === 'active' ? 'filled' : 'outlined',
    };
  }, [showStepBadge, step]);
}
