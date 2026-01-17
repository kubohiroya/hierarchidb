/**
 * PluginDialogFooter – renders navigation and action buttons for the dialog.
 *
 * Consumes multi-step dialog context to honour per-step enablement while
 * exposing plugin-specific commit/start-batch controls supplied by the
 * controller layer.
 */

import { getDialogSurfaceColor } from '@hierarchidb/ui-dialog';
import CheckIcon from '@mui/icons-material/Check';
import ChevronLeftIcon from '@mui/icons-material/ChevronLeft';
import ChevronRightIcon from '@mui/icons-material/ChevronRight';
import CloseIcon from '@mui/icons-material/Close';
import ConstructionIcon from '@mui/icons-material/Construction';
import { Box, Button, CircularProgress, Stack, Tooltip } from '@mui/material';
import React, { forwardRef, useCallback, useEffect, useRef, useState } from 'react';
import type { Theme } from '@mui/material/styles';
import type { ButtonProps } from '@mui/material';
import type { DialogActionInFlight } from '../types.js';
import { useTranslation } from 'react-i18next';
import { usePluginDialogFooterLogic } from './hooks/usePluginDialogFooterLogic.js';

export interface PluginDialogFooterPrimaryButtonOptions {
  leftVisibility?: 'auto' | 'hidden';
  rightVisibility?: 'auto' | 'hidden';
  leftLabelOverride?: string;
  rightLabelOverride?: string;
}

export interface PluginDialogFooterProps {
  mode: 'create' | 'edit' | 'preview';
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

const PluginDialogFooterInner: React.FC<PluginDialogFooterProps> = ({
  mode,
  canCommit,
  onSaveDraft,
  saveDraftLabel,
  disableDraft,
  onStartBatch,
  canStartBatch = true,
  isStartingBatch = false,
  primaryButtonOptions,
  pendingAction,
}) => {
  // console.count('PluginDialogFooter render');
  const { t } = useTranslation('common');
  const commitLabel = t('dialogs.pluginDialog.buttons.save', 'Save');
  const {
    ctx,
    isResourcesTree,
    isFirstStep,
    isLastStep,
    isDirty,
    allStepsValidated,
    handleBackOrCancel,
    handleNextOrSave,
    canNavigateNext,
  } = usePluginDialogFooterLogic();
  const isFullScreen = ctx.displayMode === 'full-screen';
  const [footerVisible, setFooterVisible] = useState(!isFullScreen);

  useEffect(() => {
    setFooterVisible(!isFullScreen);
  }, [isFullScreen]);

  const handleSensorEnter = useCallback(() => {
    if (!isFullScreen) return;
    setFooterVisible(true);
  }, [isFullScreen]);

  const handleFooterMouseLeave = useCallback(() => {
    if (!isFullScreen) return;
    setFooterVisible(false);
  }, [isFullScreen]);

  const leftPrimaryLabel =
    primaryButtonOptions?.leftLabelOverride ??
    (isFirstStep
      ? t('dialogs.pluginDialog.buttons.cancel', 'Cancel')
      : t('dialogs.pluginDialog.buttons.back', 'Back'));
  const rightPrimaryLabel =
    primaryButtonOptions?.rightLabelOverride ??
    (isLastStep ? commitLabel : t('dialogs.pluginDialog.buttons.next', 'Next'));
  const leftPrimaryIcon = isFirstStep ? (
    <CloseIcon fontSize="small" />
  ) : (
    <ChevronLeftIcon fontSize="small" />
  );
  const hasPendingAction = Boolean(pendingAction);
  const leftActionType = isFirstStep ? 'cancel' : 'back';
  const rightActionType = isLastStep ? 'commit' : 'next';
  const disableLeftPrimary = hasPendingAction;
  const disableRightPrimary = hasPendingAction || (!isLastStep && !canNavigateNext);
  const showSaveDraft = typeof onSaveDraft === 'function';
  const showStartBatch = typeof onStartBatch === 'function';
  const disableDraftButton = (disableDraft ?? !isDirty) || hasPendingAction;
  const showLeftPrimary = primaryButtonOptions?.leftVisibility !== 'hidden';
  const showRightPrimary = primaryButtonOptions?.rightVisibility !== 'hidden';
  const showInlineSaveButton = mode === 'edit' && !isLastStep && showRightPrimary;
  const inlineSaveDisabled =
    !ctx.onRequestCommit || !allStepsValidated || !canCommit || hasPendingAction || !isDirty;
  const shouldRenderNextButton = showRightPrimary && !isLastStep;
  const shouldRenderFinalCommitButton = showRightPrimary && isLastStep;

  const handleInlineSave = useCallback(() => {
    ctx.onRequestCommit?.();
  }, [ctx]);

  const sx = useCallback((theme: Theme) => ({
    display: footerVisible ? 'block' : 'none',
    borderTop: `1px solid ${theme.palette.divider}`,
    padding: theme.spacing(1.5, 2),
    backgroundColor: getDialogSurfaceColor(theme),
    position: 'relative',
    // Keep footer at the dialog surface z-index (modal) so popper menus can overlay it.
    zIndex: theme.zIndex?.modal ?? 1300,
    pointerEvents: 'auto',
  }), [footerVisible]);

  const debugRef = useRef<Record<string, unknown>>({});
  useEffect(() => {
    const prev = debugRef.current;
    const changes: string[] = [];
    const nextSnapshot = {
      activeStepIndex: ctx.activeStepIndex,
      enabledStepIndices: ctx.enabledStepIndices?.join(','),
      validatedStepIndices: ctx.validatedStepIndices?.join(','),
      isDirty: ctx.isDirty,
      pendingActionType: pendingAction?.type ?? null,
      canNavigateNext,
    };
    Object.entries(nextSnapshot).forEach(([key, value]) => {
      if (prev[key] !== value) {
        changes.push(`${key}:${String(prev[key])}→${String(value)}`);
      }
    });
    if (changes.length) {
      // console.debug('[PluginDialogFooter diff]', changes.join(' | '));
      debugRef.current = nextSnapshot;
    }
  }, [
    canNavigateNext,
    ctx.activeStepIndex,
    ctx.enabledStepIndices,
    ctx.isDirty,
    ctx.validatedStepIndices,
    pendingAction?.type,
  ]);

  return (
    <>
      {isFullScreen && (
        <Box
          onMouseEnter={handleSensorEnter}
          sx={{
            position: 'fixed',
            bottom: 0,
            left: 0,
            right: 0,
            height: 16,
            zIndex: (theme: Theme) => (theme.zIndex?.modal ?? 1300) + 2,
            backgroundColor: 'transparent',
            pointerEvents: 'auto',
          }}
        />
      )}
      <Box
        sx={sx}
        onMouseLeave={handleFooterMouseLeave}
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
              title={
                disableDraftButton
                  ? t('dialogs.pluginDialog.tooltips.saveDraftDisabled', 'No changes to save')
                  : ''
              }
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
                  {saveDraftLabel ?? t('dialogs.pluginDialog.buttons.saveDraft', 'Save Draft')}
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
              endIcon={<ConstructionIcon fontSize="small" />}
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
              disabled={disableRightPrimary || !canCommit || !allStepsValidated || !isDirty}
              loading={pendingAction?.type === rightActionType}
              endIcon={<CheckIcon fontSize="small" />}
            >
              {rightPrimaryLabel}
            </LoadingButton>
          )}
        </Stack>
      </Stack>
      </Box>
    </>
  );
};

PluginDialogFooterInner.displayName = 'PluginDialogFooter';
export const PluginDialogFooter = React.memo(
  PluginDialogFooterInner,
  (prev, next) =>
    prev.mode === next.mode &&
    prev.canCommit === next.canCommit &&
    prev.onSaveDraft === next.onSaveDraft &&
    prev.saveDraftLabel === next.saveDraftLabel &&
    prev.disableDraft === next.disableDraft &&
    prev.onStartBatch === next.onStartBatch &&
    prev.canStartBatch === next.canStartBatch &&
    prev.isStartingBatch === next.isStartingBatch &&
    prev.primaryButtonOptions === next.primaryButtonOptions &&
    prev.pendingAction === next.pendingAction,
);
