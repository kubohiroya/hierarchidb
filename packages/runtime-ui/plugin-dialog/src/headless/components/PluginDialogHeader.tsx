import type React from 'react';
import { useCallback, useMemo } from 'react';
import {
  Box,
  IconButton,
  Stack,
  Tooltip,
  Typography,
  Stepper,
  Step,
  StepButton,
  StepLabel,
} from '@mui/material';
import {
  Close as CloseIcon,
  Fullscreen as FullscreenIcon,
  FullscreenExit as FullscreenExitIcon,
  OpenInFull as OpenInFullIcon,
} from '@mui/icons-material';
import { useMultiStepDialogContext, getDialogSurfaceColor } from '@hierarchidb/ui-dialog';
import { Link, useLocation } from 'react-router-dom';
import { alpha } from '@mui/material/styles';
import type { MultiStepDialogState, NodeId } from '@hierarchidb/common-type';

export interface PluginDialogHeaderProps {
  title: string;
  subtitle?: string;
  icon?: React.ReactNode;
  dialogState?: MultiStepDialogState | null;
  nodeType?: string;
  nodeId?: NodeId;
}

const stopPointerPropagation = (event: React.PointerEvent | React.MouseEvent) => {
  event.stopPropagation();
};

export const PluginDialogHeader: React.FC<PluginDialogHeaderProps> = ({
  title,
  subtitle,
  icon,
  dialogState,
}) => {
  const ctx = useMultiStepDialogContext<Record<string, unknown>>();
  const location = useLocation();

  const workerStepMap = useMemo(() => {
    if (!dialogState?.steps?.length) {
      return null;
    }
    const map = new Map<string, MultiStepDialogState['steps'][number]>();
    dialogState.steps.forEach((step) => {
      map.set(step.id, step);
    });
    return map;
  }, [dialogState?.steps]);


  const toggleMaximize = useCallback(() => {
    const next = ctx.displayMode === 'maximize' ? 'normal' : 'maximize';
    ctx.onDisplayModeChange?.(next);
  }, [ctx]);

  const toggleFullscreen = useCallback(() => {
    const next = ctx.displayMode === 'full-screen' ? 'normal' : 'full-screen';
    ctx.onDisplayModeChange?.(next);
  }, [ctx]);

  const dragHandlePointerDown = ctx.onDragHandlePointerDown;

  const headerSubtitle = useMemo(() => {
    if (subtitle && ctx.stepComponents.length <= 1) return subtitle;
    return undefined;
  }, [subtitle, ctx.stepComponents.length]);

  const buildStepLink = useCallback((index: number) => {
    const params = new URLSearchParams(location.search);
    params.set('d_step', String(index));
    const query = params.toString();
    return `${location.pathname}${query ? `?${query}` : ''}${location.hash ?? ''}`;
  }, [location.pathname, location.search, location.hash]);

  const handleStepClick = useCallback((event: React.MouseEvent | React.KeyboardEvent, index: number, canNavigate: boolean) => {
    if (!canNavigate || index === ctx.activeStepIndex) {
      event.preventDefault();
      return;
    }
    ctx.onStepNavigate({ type: 'direct', targetIndex: index });
  }, [ctx]);

  return (
    <Box
      sx={(theme) => ({
        display: 'flex',
        alignItems: 'flex-start',
        justifyContent: 'space-between',
        padding: theme.spacing(1.5, 2),
        borderBottom: `1px solid ${theme.palette.divider}`,
        cursor: ctx.displayMode === 'full-screen' ? 'default' : 'move',
        userSelect: 'none',
        backgroundColor: getDialogSurfaceColor(theme),
        transition: theme.transitions.create(['background-color'], { duration: theme.transitions.duration.shorter }),
        '&:hover': {
          backgroundColor:
            theme.palette.mode === 'dark'
              ? alpha(theme.palette.common.white, 0.08)
              : theme.palette.action.hover,
        },
      })}
      onPointerDown={dragHandlePointerDown}
      data-dialog-drag-handle="true"
    >
      <Stack direction="column" spacing={1} sx={{ minWidth: 0, flex: 1, pr: 2 }}>
        <Stack direction="row" spacing={1.5} alignItems="center" sx={{ minWidth: 0 }}>
          {icon && (
            <Box component="span" sx={{ display: 'inline-flex', alignItems: 'center' }}>
              {icon}
            </Box>
          )}
          <Box sx={{ minWidth: 0 }}>
            <Typography variant="h6" noWrap>{title}</Typography>
            {headerSubtitle && (
              <Typography variant="body2" color="text.secondary" noWrap>
                {headerSubtitle}
              </Typography>
            )}
          </Box>
        </Stack>
        {ctx.stepComponents.length > 1 && (
          <Box onPointerDown={stopPointerPropagation}>
            <Stepper nonLinear activeStep={ctx.activeStepIndex} alternativeLabel>
              {ctx.stepComponents.map((step, index) => {
                const workerStep = workerStepMap?.get(step.id) ?? dialogState?.steps?.[index];
                const fallbackCanNavigate = ctx.enabledStepIndices.includes(index) || index === ctx.activeStepIndex;
                const canNavigate = workerStep?.enabled ?? fallbackCanNavigate;
                const completed = workerStep?.completed ?? ctx.validatedStepIndices.includes(index);
                const label = workerStep?.title ?? step.label ?? step.id;
                const stepLink = buildStepLink(index);
                return (
                  <Step key={step.id} completed={completed}>
                    <StepButton
                      component={Link}
                      to={stepLink}
                      disabled={!canNavigate}
                      onClick={(event) => handleStepClick(event, index, canNavigate)}
                    >
                      <StepLabel>
                        <Typography variant="caption" noWrap>
                          {label}
                        </Typography>
                      </StepLabel>
                    </StepButton>
                  </Step>
                );
              })}
            </Stepper>
          </Box>
        )}
      </Stack>

      <Stack direction="row" spacing={1.5} alignItems="center">
        <Stack direction="row" spacing={0.5} alignItems="center">
          <Tooltip title={ctx.displayMode === 'maximize' ? 'Restore size' : 'Maximize'}>
            <span>
              <IconButton
                size="small"
                color={ctx.displayMode === 'maximize' ? 'primary' : 'default'}
                onClick={toggleMaximize}
                onPointerDown={stopPointerPropagation}
                disabled={!ctx.onDisplayModeChange}
              >
                {ctx.displayMode === 'maximize' ? <FullscreenExitIcon fontSize="small" /> : <OpenInFullIcon fontSize="small" />}
              </IconButton>
            </span>
          </Tooltip>
          <Tooltip title={ctx.displayMode === 'full-screen' ? 'Exit full screen' : 'Full screen'}>
            <span>
              <IconButton
                size="small"
                color={ctx.displayMode === 'full-screen' ? 'primary' : 'default'}
                onClick={toggleFullscreen}
                onPointerDown={stopPointerPropagation}
                disabled={!ctx.onDisplayModeChange}
              >
                {ctx.displayMode === 'full-screen' ? <FullscreenExitIcon fontSize="small" /> : <FullscreenIcon fontSize="small" />}
              </IconButton>
            </span>
          </Tooltip>
          <Tooltip title="Close dialog">
            <IconButton
              size="small"
              onClick={() => ctx.onRequestClose('close')}
              onPointerDown={stopPointerPropagation}
              aria-label="Close dialog"
            >
              <CloseIcon fontSize="small" />
            </IconButton>
          </Tooltip>
        </Stack>
      </Stack>
    </Box>
  );
};

PluginDialogHeader.displayName = 'PluginDialogHeader';
