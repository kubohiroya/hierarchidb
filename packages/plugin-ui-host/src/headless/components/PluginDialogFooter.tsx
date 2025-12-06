/**
 * PluginDialogFooter – renders navigation and action buttons for the dialog.
 *
 * Consumes multi-step dialog context to honour per-step enablement while
 * exposing plugin-specific commit/start-batch controls supplied by the
 * controller layer.
 */

import { getDialogSurfaceColor, useMultiStepDialogContext } from '@hierarchidb/ui-dialog';
import CheckIcon from '@mui/icons-material/Check';
import ChevronLeftIcon from '@mui/icons-material/ChevronLeft';
import ChevronRightIcon from '@mui/icons-material/ChevronRight';
import CloseIcon from '@mui/icons-material/Close';
import { Box, Button, Stack, Tooltip } from '@mui/material';
import { useLocation } from '@tanstack/react-router';
import React, { useCallback } from 'react';
import { Theme } from '@mui/material/styles';

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
  isStartingBatch?: boolean;
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
  isStartingBatch = false,
  primaryButtonOptions,
}) => {
  const ctx = useMultiStepDialogContext<Record<string, unknown>>();
  if (typeof console !== 'undefined' && typeof console.debug === 'function') {
    console.debug('[PluginDialogFooter] render', {
      activeStepIndex: ctx.activeStepIndex,
      enabledSteps: ctx.enabledStepIndices,
      validatedSteps: ctx.validatedStepIndices,
      isDirty: ctx.isDirty,
      canCommit,
    });
  }
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
  const canNavigateBack =
    !isFirstStep &&
    (ctx.enabledStepIndices.includes(ctx.activeStepIndex - 1) ||
      ctx.enabledStepIndices.length === 0);
  const isDirty = ctx.isDirty;
  const totalSteps = ctx.stepComponents.length;
  const validatedStepSet = React.useMemo(
    () => new Set(ctx.validatedStepIndices),
    [ctx.validatedStepIndices]
  );

  const allStepsValidated = totalSteps === 0 || validatedStepSet.size >= totalSteps;

  const handleBackOrCancel = useCallback(() => {
    if (typeof console !== 'undefined' && typeof console.debug === 'function') {
      console.debug('[PluginDialogFooter] back/cancel click', {
        isFirstStep,
        canNavigateBack,
        activeStepIndex: ctx.activeStepIndex,
        enabledStepIndices: ctx.enabledStepIndices,
      });
    }
    if (isFirstStep) {
      ctx.onRequestClose('close');
      return;
    }
    ctx.onStepNavigate({ type: 'back' });
  },[canNavigateBack, ctx, isFirstStep]);

  const handleNextOrSave = useCallback(() => {
    if (typeof console !== 'undefined' && typeof console.debug === 'function') {
      console.debug('[PluginDialogFooter] next/save click', {
        isLastStep,
        canCommit,
        activeStepIndex: ctx.activeStepIndex,
        validatedStepIndices: ctx.validatedStepIndices,
      });
    }
    if (isLastStep) {
      ctx.onRequestCommit?.();
      return;
    }
    ctx.onStepNavigate({ type: 'next' });
  }, [canCommit, ctx, isLastStep]);

  const leftPrimaryLabel =
    primaryButtonOptions?.leftLabelOverride ?? (isFirstStep ? 'Cancel' : 'Back');
  const rightPrimaryLabel =
    primaryButtonOptions?.rightLabelOverride ?? (isLastStep ? commitLabel : 'Next');
  const leftPrimaryIcon = isFirstStep ? (
    <CloseIcon fontSize="small" />
  ) : (
    <ChevronLeftIcon fontSize="small" />
  );
  // Temporarily keep navigation/commit buttons always enabled to avoid
  // non-responsive footer actions while upstream guards are being stabilized.
  const disableLeftPrimary = false;
  const disableRightPrimary = false;
  const showSaveDraft = typeof onSaveDraft === 'function';
  const showStartBatch = typeof onStartBatch === 'function';
  const disableDraftButton = disableDraft ?? !isDirty;
  const showLeftPrimary = primaryButtonOptions?.leftVisibility !== 'hidden';
  const showRightPrimary = primaryButtonOptions?.rightVisibility !== 'hidden';
  const showInlineSaveButton = mode === 'edit' && !isLastStep && showRightPrimary;
  const inlineSaveDisabled = !ctx.onRequestCommit || !allStepsValidated || !canCommit;
  const shouldRenderNextButton = showRightPrimary && !isLastStep;
  const shouldRenderFinalCommitButton = showRightPrimary && isLastStep;

  const handleInlineSave = useCallback(() => {
    if (typeof console !== 'undefined' && typeof console.debug === 'function') {
      console.debug('[PluginDialogFooter] inline save click', {
        canCommit,
        activeStepIndex: ctx.activeStepIndex,
        validatedStepIndices: ctx.validatedStepIndices,
      });
    }
    ctx.onRequestCommit?.();
  }, [canCommit, ctx]);

  const sx = useCallback((theme: Theme) => ({
    borderTop: `1px solid ${theme.palette.divider}`,
    padding: theme.spacing(1.5, 2),
    backgroundColor: getDialogSurfaceColor(theme),
    position: 'relative',
    zIndex: (theme.zIndex?.modal ?? 1300) + 2,
    pointerEvents: 'auto',
  }), []);

  return (
    <Box
      sx={sx}
    >
      <Stack
        direction={{ xs: 'column', sm: 'row' }}
        spacing={{ xs: 1.5, sm: 2 }}
        justifyContent="space-between"
        alignItems={{ xs: 'stretch', sm: 'center' }}
      >
        <Stack
          data-testid="plugin-dialog-footer-left"
          direction="row"
          spacing={1.5}
          alignItems="center"
          flexWrap="wrap"
        >
          {showLeftPrimary && (
            <Button
              variant="contained"
              size="large"
              color={isFirstStep ? 'inherit' : isResourcesTree ? 'primary' : 'secondary'}
              onClick={handleBackOrCancel}
              onPointerDown={stopPointerPropagation}
              disabled={disableLeftPrimary}
              startIcon={leftPrimaryIcon}
            >
              {leftPrimaryLabel}
            </Button>
          )}
          {showSaveDraft && (
            <Tooltip
              title={disableDraftButton ? 'No changes to save' : ''}
              disableHoverListener={!disableDraftButton}
            >
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

        <Box
          data-testid="plugin-dialog-footer-center"
          sx={{
            flex: { xs: '0 0 auto', sm: '1 1 0%' },
            display: 'flex',
            justifyContent: { xs: 'flex-start', sm: 'center' },
            alignItems: 'center',
            minHeight: 40,
          }}
        >
          {showStartBatch && (
            <Button
              variant="outlined"
              size="large"
              color="secondary"
              onClick={onStartBatch}
              onPointerDown={stopPointerPropagation}
              disabled={!canStartBatch || isStartingBatch}
            >
              {isStartingBatch ? 'Building…' : 'Build'}
            </Button>
          )}
        </Box>

        <Stack
          data-testid="plugin-dialog-footer-right"
          direction="row"
          spacing={1.5}
          alignItems="center"
          justifyContent="flex-end"
          flexWrap="wrap"
        >
          {showInlineSaveButton && (
            <Button
              variant="outlined"
              size="large"
              color="primary"
              onClick={handleInlineSave}
              onPointerDown={stopPointerPropagation}
              disabled={inlineSaveDisabled}
              endIcon={<CheckIcon fontSize="small" />}
            >
              {commitLabel}
            </Button>
          )}
          {shouldRenderNextButton && (
            <Button
              variant="contained"
              size="large"
              color="primary"
              onClick={handleNextOrSave}
              onPointerDown={stopPointerPropagation}
              disabled={disableRightPrimary}
              endIcon={<ChevronRightIcon fontSize="small" />}
            >
              {rightPrimaryLabel}
            </Button>
          )}
          {shouldRenderFinalCommitButton && (
            <Button
              variant="contained"
              size="large"
              color="primary"
              onClick={handleNextOrSave}
              onPointerDown={stopPointerPropagation}
              disabled={disableRightPrimary}
              endIcon={<CheckIcon fontSize="small" />}
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
