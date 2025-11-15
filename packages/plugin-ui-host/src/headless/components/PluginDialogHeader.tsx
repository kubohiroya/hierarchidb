import type { MultiStepDialogState, NodeId } from '@hierarchidb/common-types';
import { getDialogSurfaceColor, useMultiStepDialogContext } from '@hierarchidb/ui-dialog';
import {
  Check as CheckIcon,
  Close as CloseIcon,
  FullscreenExit as FullscreenExitIcon,
  Fullscreen as FullscreenIcon,
  OpenInFull as OpenInFullIcon,
} from '@mui/icons-material';
import {
  Box,
  IconButton,
  Stack,
  Step,
  StepButton,
  StepLabel,
  Stepper,
  Tooltip,
  Typography,
} from '@mui/material';
import { alpha, useTheme } from '@mui/material/styles';
import { Link, useLocation } from '@tanstack/react-router';
import type React from 'react';
import { useCallback, useMemo } from 'react';

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
  const theme = useTheme();

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

  const buildStepLink = useCallback(
    (index: number) => {
      const rawSearch = location.searchStr ? location.searchStr.slice(1) : '';
      const params = new URLSearchParams(rawSearch);
      params.set('d_step', String(index));
      const query = params.toString();
      return `${location.pathname}${query ? `?${query}` : ''}${location.hash ?? ''}`;
    },
    [location.pathname, location.searchStr, location.hash]
  );

  const handleStepClick = useCallback(
    (event: React.MouseEvent | React.KeyboardEvent, index: number, canNavigate: boolean) => {
      if (!canNavigate || index === ctx.activeStepIndex) {
        event.preventDefault();
        return;
      }
      ctx.onStepNavigate({ type: 'direct', targetIndex: index });
    },
    [ctx]
  );

  const StepStatusIcon = useCallback(
    (props: { active?: boolean; completed?: boolean; icon?: React.ReactNode }) => {
      const { active, completed, icon: iconProp } = props;
      const baseColor = completed ? theme.palette.success.main : theme.palette.background.paper;
      const textColor = completed ? theme.palette.common.white : theme.palette.text.primary;
      const borderColor = active ? theme.palette.primary.main : theme.palette.divider;
      const boxShadow = active
        ? `0 0 0 2px ${alpha(
            theme.palette.primary.main,
            theme.palette.mode === 'dark' ? 0.5 : 0.3
          )}`
        : 'none';

      return (
        <Box
          data-testid={`plugin-dialog-step-icon-${iconProp}`}
          data-active={active ? 'true' : 'false'}
          data-validated={completed ? 'true' : 'false'}
          sx={{
            width: 30,
            height: 30,
            borderRadius: '50%',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            backgroundColor: baseColor,
            color: textColor,
            border: '2px solid',
            borderColor,
            fontWeight: 600,
            fontSize: 13,
            transition: theme.transitions.create(['background-color', 'border-color', 'color'], {
              duration: theme.transitions.duration.short,
            }),
            boxShadow,
          }}
        >
          {completed ? <CheckIcon fontSize="inherit" /> : iconProp}
        </Box>
      );
    },
    [theme]
  );

  return (
    <Box
      data-dialog-drag-handle="true"
      onPointerDown={dragHandlePointerDown}
      sx={(theme) => ({
        display: 'flex',
        alignItems: 'flex-start',
        justifyContent: 'space-between',
        padding: theme.spacing(1.5, 2, 0.1, 2),
        borderBottom: `1px solid ${theme.palette.divider}`,
        userSelect: 'none',
        gap: theme.spacing(1.5),
        cursor: ctx.displayMode === 'full-screen' ? 'default' : 'move',
        backgroundColor:
          theme.palette.mode === 'dark'
            ? alpha(theme.palette.common.white, 0.04)
            : getDialogSurfaceColor(theme),
        transition: theme.transitions.create('background-color', {
          duration: theme.transitions.duration.shorter,
        }),
        '&:hover': {
          backgroundColor:
            theme.palette.mode === 'dark'
              ? alpha(theme.palette.common.white, 0.1)
              : theme.palette.action.hover,
        },
      })}
    >
      <Stack direction="column" spacing={1} sx={{ minWidth: 0, flex: 1, pr: 2 }}>
        <Stack
          direction="row"
          spacing={1.5}
          alignItems="center"
          sx={(_theme) => ({
            borderRadius: 8,
            minWidth: 0,
          })}
        >
          {icon && (
            <Box
              component="span"
              sx={{
                display: 'inline-flex',
                alignItems: 'center',
                marginLeft: '8px !important',
              }}
            >
              {icon}
            </Box>
          )}
          <Box sx={{ minWidth: 0 }}>
            <Typography variant="h6" noWrap>
              {title}
            </Typography>
            {headerSubtitle && (
              <Typography variant="body2" color="text.secondary" noWrap>
                {headerSubtitle}
              </Typography>
            )}
          </Box>
        </Stack>
        {ctx.stepComponents.length > 1 && (
          <Box
            sx={{
              cursor: 'default',
              margin: 0,
              padding: 0,
            }}
            onPointerDown={stopPointerPropagation}
            onMouseEnter={stopPointerPropagation}
            onMouseLeave={stopPointerPropagation}
            onMouseMove={stopPointerPropagation}
            onMouseOver={stopPointerPropagation}
            onMouseOut={stopPointerPropagation}
          >
            <Stepper nonLinear activeStep={ctx.activeStepIndex} alternativeLabel>
              {ctx.stepComponents.map((step, index) => {
                const workerStep = workerStepMap?.get(step.id) ?? dialogState?.steps?.[index];
                const fallbackCanNavigate =
                  ctx.enabledStepIndices.includes(index) || index === ctx.activeStepIndex;
                const canNavigate = workerStep?.enabled ?? fallbackCanNavigate;
                const completed = workerStep?.completed ?? ctx.validatedStepIndices.includes(index);
                const label = workerStep?.title ?? step.label ?? step.id;
                const stepLink = buildStepLink(index);
                const isActive = index === ctx.activeStepIndex;
                return (
                  <Step key={step.id} completed={completed}>
                    <StepButton
                      component={Link}
                      to={stepLink}
                      disabled={!canNavigate}
                      preload="intent"
                      onClick={(
                        event
                      ) => handleStepClick(event, index, canNavigate)}
                      aria-current={isActive ? 'step' : undefined}
                      sx={{ padding: 0, margin: 0 }}
                    >
                      <StepLabel StepIconComponent={StepStatusIcon as never}>
                        <Typography
                          variant="caption"
                          noWrap
                          sx={{
                            color: isActive ? 'primary.main' : 'text.secondary',
                            fontWeight: isActive ? 600 : 400,
                          }}
                          data-active-label={isActive ? 'true' : 'false'}
                        >
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
                {ctx.displayMode === 'maximize' ? (
                  <FullscreenExitIcon fontSize="small" />
                ) : (
                  <OpenInFullIcon fontSize="small" />
                )}
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
                {ctx.displayMode === 'full-screen' ? (
                  <FullscreenExitIcon fontSize="small" />
                ) : (
                  <FullscreenIcon fontSize="small" />
                )}
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
