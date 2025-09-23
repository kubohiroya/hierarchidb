import React from 'react';
import { Box, Button, Stack, Tooltip } from '@mui/material';
import { useMultiStepDialogContext } from '@hierarchidb/ui-dialog';

export interface PluginDialogFooterProps {
  intent: 'create' | 'edit';
  canCommit: boolean;
  onSaveDraft?: () => void;
  saveDraftLabel?: string;
  disableDraft?: boolean;
  onStartBatch?: () => void;
  canStartBatch?: boolean;
}

const stopPointerPropagation = (event: React.PointerEvent | React.MouseEvent) => {
  event.stopPropagation();
};

export const PluginDialogFooter: React.FC<PluginDialogFooterProps> = ({
  intent,
  canCommit,
  onSaveDraft,
  saveDraftLabel = 'Save Draft',
  disableDraft,
  onStartBatch,
  canStartBatch = true,
}) => {
  const ctx = useMultiStepDialogContext<Record<string, unknown>>();

  const commitLabel = intent === 'create' ? 'Create' : 'Save';
  const isFirstStep = ctx.activeStepIndex === 0;
  const isLastStep = ctx.activeStepIndex >= ctx.stepComponents.length - 1;
  const canNavigateBack = !isFirstStep && (ctx.enabledStepIndices.includes(ctx.activeStepIndex - 1) || ctx.enabledStepIndices.length === 0);
  const canNavigateNext = !isLastStep && (ctx.enabledStepIndices.includes(ctx.activeStepIndex + 1) || ctx.enabledStepIndices.length === 0);
  const isDirty = ctx.isDirty;

  const handleBackOrCancel = () => {
    if (isFirstStep) {
      ctx.onRequestClose('close');
      return;
    }
    ctx.onStepNavigate({ type: 'back' });
  };

  const handleNextOrSave = () => {
    console.debug("[Folder-create]");
    if (isLastStep) {
      ctx.onRequestCommit?.();
      return;
    }
    ctx.onStepNavigate({ type: 'next' });
  };

  const leftPrimaryLabel = isFirstStep ? 'Cancel' : 'Back';
  const rightPrimaryLabel = isLastStep ? commitLabel : 'Next';
  const disableLeftPrimary = isFirstStep ? false : !canNavigateBack;
  const disableRightPrimary = isLastStep ? !canCommit : !canNavigateNext;
  const showSaveDraft = typeof onSaveDraft === 'function';
  const showStartBatch = typeof onStartBatch === 'function';
  const disableDraftButton = disableDraft ?? !isDirty;

  return (
    <Box
      sx={(theme) => ({
        borderTop: `1px solid ${theme.palette.divider}`,
        padding: theme.spacing(1.5, 2),
        backgroundColor: theme.palette.background.paper,
      })}
    >
      <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2} justifyContent="space-between" alignItems={{ xs: 'stretch', sm: 'center' }}>
        <Stack direction="row" spacing={1.5} alignItems="center">
          <Button
            variant="contained"
            size="large"
            color={isFirstStep ? 'inherit' : 'secondary'}
            onClick={handleBackOrCancel}
            onPointerDown={stopPointerPropagation}
            disabled={disableLeftPrimary}
          >
            {leftPrimaryLabel}
          </Button>
          {showSaveDraft && (
            <Tooltip title={disableDraftButton ? 'No changes to save' : ''} disableHoverListener={!disableDraftButton}>
              <span>
                <Button
                  variant="outlined"
                  size="large"
                  onClick={onSaveDraft}
                  onPointerDown={stopPointerPropagation}
                  disabled={disableDraftButton}
                >
                  {saveDraftLabel}
                </Button>
              </span>
            </Tooltip>
          )}
        </Stack>

        <Stack direction="row" spacing={1.5} alignItems="center" justifyContent="flex-end">
          {showStartBatch && (
            <Button
              variant="outlined"
              size="large"
              color="secondary"
              onClick={onStartBatch}
              onPointerDown={stopPointerPropagation}
              disabled={!canStartBatch}
            >
              Start Batch
            </Button>
          )}
          <Button
            variant="contained"
            size="large"
            color="primary"
            onClick={handleNextOrSave}
            onPointerDown={stopPointerPropagation}
            disabled={disableRightPrimary}
          >
            {rightPrimaryLabel}
          </Button>
        </Stack>
      </Stack>
    </Box>
  );
};

PluginDialogFooter.displayName = 'PluginDialogFooter';
