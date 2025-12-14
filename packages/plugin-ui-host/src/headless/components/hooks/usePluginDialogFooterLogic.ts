import { useMemo, useCallback } from 'react';
import { useDialogContext } from '@hierarchidb/ui-dialog';
import { useLocation } from '@tanstack/react-router';

export function usePluginDialogFooterLogic() {
  const ctx = useDialogContext<Record<string, unknown>>();
  const location = useLocation();

  const isResourcesTree = useMemo(() => {
    const segments = location.pathname.split('/').filter(Boolean);
    if (segments.length < 2) return false;
    const treeId = segments[1]?.toLowerCase();
    return treeId === 'r';
  }, [location.pathname]);

  const isFirstStep = ctx.activeStepIndex === 0;
  const isLastStep = ctx.activeStepIndex >= ctx.stepComponents.length - 1;
  const totalSteps = ctx.stepComponents.length;
  const isDirty = ctx.isDirty;
  const validatedStepSet = useMemo(() => new Set(ctx.validatedStepIndices), [ctx.validatedStepIndices]);
  const allStepsValidated = totalSteps === 0 || validatedStepSet.size >= totalSteps || (isDirty && totalSteps > 0);

  const handleBackOrCancel = useCallback(() => {
    if (isFirstStep) {
      ctx.onRequestClose('close');
      return;
    }
    ctx.onStepNavigate({ type: 'back' });
  }, [ctx, isFirstStep]);

  const handleNextOrSave = useCallback(() => {
    if (isLastStep) {
      ctx.onRequestCommit?.();
      return;
    }
    ctx.onStepNavigate({ type: 'next' });
  }, [ctx, isLastStep]);

  const nextStepIndex = ctx.activeStepIndex + 1;
  const canNavigateNext = ctx.enabledStepIndices?.includes(nextStepIndex);
  const hasPendingAction = false;
  const disableRightPrimary = hasPendingAction || (!isLastStep && !canNavigateNext);
  const showRightPrimary = true;
  const showLeftPrimary = true;
  const showStartBatch = false;

  return {
    ctx,
    isResourcesTree,
    isFirstStep,
    isLastStep,
    isDirty,
    allStepsValidated,
    handleBackOrCancel,
    handleNextOrSave,
    canNavigateNext,
    disableRightPrimary,
    showRightPrimary,
    showLeftPrimary,
    showStartBatch,
  };
}
