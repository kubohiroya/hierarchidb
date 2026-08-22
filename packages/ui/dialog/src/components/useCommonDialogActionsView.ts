import { useMemo } from 'react';
import type { CommonDialogActionsProps } from './CommonDialogActions.js';

export interface UseCommonDialogActionsViewResult {
  shouldRender: boolean;
  submitLabel: string;
  submitDisabled: boolean;
}

export function useCommonDialogActionsView({
  displayMode = 'normal',
  mode,
  isValid = true,
  isSubmitting = false,
}: Pick<
  CommonDialogActionsProps,
  'displayMode' | 'mode' | 'isValid' | 'isSubmitting'
>): UseCommonDialogActionsViewResult {
  const submitLabel = useMemo(() => {
    if (isSubmitting) return 'Saving...';
    return mode === 'create' ? 'Create' : 'Save';
  }, [isSubmitting, mode]);

  return {
    shouldRender: displayMode === 'full-screen',
    submitLabel,
    submitDisabled: !isValid || isSubmitting,
  };
}
