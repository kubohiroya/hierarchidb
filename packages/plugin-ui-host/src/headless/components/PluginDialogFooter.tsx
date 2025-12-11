/**
 * PluginDialogFooter – renders navigation and action buttons for the dialog.
 *
 * Consumes multi-step dialog context to honour per-step enablement while
 * exposing plugin-specific commit/start-batch controls supplied by the
 * controller layer.
 */

import { getDialogSurfaceColor, useDialogContext } from '@hierarchidb/ui-dialog';
import CheckIcon from '@mui/icons-material/Check';
import ChevronLeftIcon from '@mui/icons-material/ChevronLeft';
import ChevronRightIcon from '@mui/icons-material/ChevronRight';
import CloseIcon from '@mui/icons-material/Close';
import { Box, Button, CircularProgress, Stack, Tooltip } from '@mui/material';
import { useLocation } from '@tanstack/react-router';
import React, { forwardRef, useCallback } from 'react';
import { Theme } from '@mui/material/styles';
import type { ButtonProps } from '@mui/material';
import type { DialogActionInFlight } from '../types.js';

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
  pendingAction?: DialogActionInFlight | null;
}

const stopPointerPropagation = (event: React.PointerEvent | React.MouseEvent) => {
  event.stopPropagation();
};

type LoadingButtonProps = ButtonProps & { loading?: boolean };

const LoadingButton = forwardRef<HTMLButtonElement, LoadingButtonProps>(function LoadingButton(
  { loading = false, disabled, startIcon, endIcon, children, ...rest },
  ref
) {
  const spinner = (
    <CircularProgress
      size={16}
      thickness={5}
      color="inherit"
    />
  );
  const computedEndIcon = loading ? spinner : endIcon;
  return (
    <Button
      {...rest}
      ref={ref}
      disabled={disabled || loading}
      startIcon={startIcon}
      endIcon={computedEndIcon}
      data-loading={loading ? 'true' : undefined}
    >
      {children}
    </Button>
  );
});

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
  pendingAction,
}) => {
  const ctx = useDialogContext<Record<string, unknown>>();
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
  const isDirty = ctx.isDirty;
  const totalSteps = ctx.stepComponents.length;
  const validatedStepSet = React.useMemo(
    () => new Set(ctx.validatedStepIndices),
    [ctx.validatedStepIndices]
  );

  const allStepsValidated = totalSteps === 0 || validatedStepSet.size >= totalSteps;

  const handleBackOrCancel = useCallback(() => {
    if (isFirstStep) {
      ctx.onRequestClose('close');
      return;
    }
    ctx.onStepNavigate({ type: 'back' });
  },[ctx, isFirstStep]);

  const handleNextOrSave = useCallback(() => {
    if (isLastStep) {
      ctx.onRequestCommit?.();
      return;
    }
    ctx.onStepNavigate({ type: 'next' });
  }, [ctx, isLastStep]);

  const leftPrimaryLabel =
    primaryButtonOptions?.leftLabelOverride ?? (isFirstStep ? 'Cancel' : 'Back');
  const rightPrimaryLabel =
    primaryButtonOptions?.rightLabelOverride ?? (isLastStep ? commitLabel : 'Next');
  const leftPrimaryIcon = isFirstStep ? (
    <CloseIcon fontSize="small" />
  ) : (
    <ChevronLeftIcon fontSize="small" />
  );
  const hasPendingAction = Boolean(pendingAction);
  const leftActionType = isFirstStep ? 'cancel' : 'back';
  const rightActionType = isLastStep ? 'commit' : 'next';
  const disableLeftPrimary = hasPendingAction;
  const disableRightPrimary = hasPendingAction;
  const showSaveDraft = typeof onSaveDraft === 'function';
  const showStartBatch = typeof onStartBatch === 'function';
  const disableDraftButton = (disableDraft ?? !isDirty) || hasPendingAction;
  const showLeftPrimary = primaryButtonOptions?.leftVisibility !== 'hidden';
  const showRightPrimary = primaryButtonOptions?.rightVisibility !== 'hidden';
  const showInlineSaveButton = mode === 'edit' && !isLastStep && showRightPrimary;
  const inlineSaveDisabled =
    !ctx.onRequestCommit || !allStepsValidated || !canCommit || hasPendingAction;
  const shouldRenderNextButton = showRightPrimary && !isLastStep;
  const shouldRenderFinalCommitButton = showRightPrimary && isLastStep;

  const handleInlineSave = useCallback(() => {
    ctx.onRequestCommit?.();
  }, [ctx]);

  const sx = useCallback((theme: Theme) => ({
    borderTop: `1px solid ${theme.palette.divider}`,
    padding: theme.spacing(1.5, 2),
    backgroundColor: getDialogSurfaceColor(theme),
    position: 'relative',
    // Keep footer at the dialog surface z-index (modal) so popper menus can overlay it.
    zIndex: theme.zIndex?.modal ?? 1300,
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
            <LoadingButton
              variant="contained"
              size="large"
              color={isFirstStep ? 'inherit' : isResourcesTree ? 'primary' : 'secondary'}
              onClick={handleBackOrCancel}
              onPointerDown={stopPointerPropagation}
              disabled={disableLeftPrimary}
              loading={pendingAction?.type === leftActionType}
              startIcon={leftPrimaryIcon}
            >
              {leftPrimaryLabel}
            </LoadingButton>
          )}
          {showSaveDraft && (
            <Tooltip
              title={disableDraftButton ? 'No changes to save' : ''}
              disableHoverListener={!disableDraftButton}
            >
              <span>
                <LoadingButton
                  variant="outlined"
                  size="large"
                  onClick={onSaveDraft}
                  onPointerDown={stopPointerPropagation}
                  disabled={disableDraftButton}
                  loading={pendingAction?.type === 'save-draft'}
                  endIcon={<CheckIcon fontSize="small" />}
                >
                  {saveDraftLabel}
                </LoadingButton>
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
            <LoadingButton
              variant="outlined"
              size="large"
              color="secondary"
              onClick={onStartBatch}
              onPointerDown={stopPointerPropagation}
              disabled={!canStartBatch || isStartingBatch || hasPendingAction}
              loading={isStartingBatch}
            >
              {isStartingBatch ? 'Building…' : 'Build'}
            </LoadingButton>
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
            <LoadingButton
              variant="outlined"
              size="large"
              color="primary"
              onClick={handleInlineSave}
              onPointerDown={stopPointerPropagation}
              disabled={inlineSaveDisabled}
              loading={pendingAction?.type === 'commit'}
              endIcon={<CheckIcon fontSize="small" />}
            >
              {commitLabel}
            </LoadingButton>
          )}
          {shouldRenderNextButton && (
            <LoadingButton
              variant="contained"
              size="large"
              color="primary"
              onClick={handleNextOrSave}
              onPointerDown={stopPointerPropagation}
              disabled={disableRightPrimary}
              loading={pendingAction?.type === rightActionType}
              endIcon={<ChevronRightIcon fontSize="small" />}
            >
              {rightPrimaryLabel}
            </LoadingButton>
          )}
          {shouldRenderFinalCommitButton && (
            <LoadingButton
              variant="contained"
              size="large"
              color="primary"
              onClick={handleNextOrSave}
              onPointerDown={stopPointerPropagation}
              disabled={disableRightPrimary}
              loading={pendingAction?.type === rightActionType}
              endIcon={<CheckIcon fontSize="small" />}
            >
              {rightPrimaryLabel}
            </LoadingButton>
          )}
        </Stack>
      </Stack>
    </Box>
  );
};

PluginDialogFooter.displayName = 'PluginDialogFooter';
