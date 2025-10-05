/**
 * PluginDialogFooter – renders navigation and action buttons for the dialog.
 *
 * Consumes multi-step dialog context to honour per-step enablement while
 * exposing plugin-specific commit/start-batch controls supplied by the
 * controller layer.
 */
import React from 'react';
import { Box, Button, Stack, Tooltip } from '@mui/material';
import { useLocation } from '@tanstack/react-router';
import { useMultiStepDialogContext, getDialogSurfaceColor } from '@hierarchidb/ui-dialog';

export interface PluginDialogFooterPrimaryButtonOptions {
  leftVisibility?: 'auto' | 'hidden';
  rightVisibility?: 'auto' | 'hidden';
  leftLabelOverride?: string;
  rightLabelOverride?: string;
}

export interface PluginDialogFooterProps {
  mode: 'create' | 'edit';
  canCommit: boolean;
  onSaveDraft?: () => void;
  saveDraftLabel?: string;
  disableDraft?: boolean;
  onStartBatch?: () => void;
  canStartBatch?: boolean;
  primaryButtonOptions?: PluginDialogFooterPrimaryButtonOptions;
}

const stopPointerPropagation = (event: React.PointerEvent | React.MouseEvent) => {
  event.stopPropagation();
};

export const PluginDialogFooter: React.FC<PluginDialogFooterProps> = ({
  mode,
  canCommit,
  onSaveDraft,
  saveDraftLabel = 'Save Draft',
  disableDraft,
  onStartBatch,
  canStartBatch = true,
  primaryButtonOptions,
}) => {
  const ctx = useMultiStepDialogContext<Record<string, unknown>>();
  const location = useLocation();
  const isResourcesTree = React.useMemo(() => {
    const segments = location.pathname.split('/').filter(Boolean);
    if (segments.length < 2) return false;
    const treeId = segments[1]?.toLowerCase();
    return treeId === 'r';
  }, [location.pathname]);

  const commitLabel = mode === 'create' ? 'Create' : 'Save';
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

  const leftPrimaryLabel = primaryButtonOptions?.leftLabelOverride ?? (isFirstStep ? 'Cancel' : 'Back');
  const rightPrimaryLabel = primaryButtonOptions?.rightLabelOverride ?? (isLastStep ? commitLabel : 'Next');
  const disableLeftPrimary = isFirstStep ? false : !canNavigateBack;
  const disableRightPrimary = isLastStep ? !canCommit : !canNavigateNext;
  const showSaveDraft = typeof onSaveDraft === 'function';
  const showStartBatch = typeof onStartBatch === 'function';
  const disableDraftButton = disableDraft ?? !isDirty;
  const showLeftPrimary = primaryButtonOptions?.leftVisibility !== 'hidden';
  const showRightPrimary = primaryButtonOptions?.rightVisibility !== 'hidden';

  return (
    <Box
      sx={(theme) => ({
        borderTop: `1px solid ${theme.palette.divider}`,
        padding: theme.spacing(1.5, 2),
        backgroundColor: getDialogSurfaceColor(theme),
      })}
    >
      <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2} justifyContent="space-between" alignItems={{ xs: 'stretch', sm: 'center' }}>
        <Stack direction="row" spacing={1.5} alignItems="center">
          {showLeftPrimary && (
            <Button
              variant="contained"
              size="large"
              color={(isFirstStep ? 'inherit' : isResourcesTree ? 'primary' : 'secondary')}
              onClick={handleBackOrCancel}
              onPointerDown={stopPointerPropagation}
              disabled={disableLeftPrimary}
            >
              {leftPrimaryLabel}
            </Button>
          )}
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
          {showRightPrimary && (
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
          )}
        </Stack>
      </Stack>
    </Box>
  );
};

PluginDialogFooter.displayName = 'PluginDialogFooter';
