import type { NodeId } from '@hierarchidb/core-types';
import { getDialogSurfaceColor } from '@hierarchidb/ui-dialog';
import { InfoOutlined as InfoOutlinedIcon } from '@mui/icons-material';
import { Box, IconButton, Stack, Tooltip, Typography } from '@mui/material';
import { alpha, useTheme } from '@mui/material/styles';
import type React from 'react';
import { useCallback, useEffect, useMemo, useState } from 'react';
import type { DialogActionInFlight } from '../types.js';
import { usePluginDialogHeaderLogic } from './hooks/usePluginDialogHeaderLogic.js';
import {
  PluginDialogCloseButton,
  PluginDialogFullScreenButton,
  PluginDialogMaximizeButton,
  PluginDialogMinimizeButton,
} from './PluginDialogControls.js';
import { PluginDialogStepper } from './PluginDialogStepper.js';

type WorkerStepState = {
  id: string;
  enabled?: boolean;
  completed?: boolean;
  error?: string | null;
};
type WorkerDialogState = { steps?: WorkerStepState[] };
export interface PluginDialogHeaderProps {
  title: string;
  subtitle?: string;
  icon?: React.ReactNode;
  dialogState?: WorkerDialogState | null;
  nodeType?: string;
  nodeId?: NodeId;
  pendingAction?: DialogActionInFlight | null;
  pluginDescription?: string;
}

const stopPointerPropagation = (event: React.PointerEvent | React.MouseEvent) => {
  event.stopPropagation();
};

const HEADER_HOVER_ZONE_HEIGHT = 24;

export const PluginDialogHeader: React.FC<PluginDialogHeaderProps> = ({
  title,
  subtitle,
  icon,
  dialogState,
  pendingAction,
  pluginDescription,
}) => {
  const {
    ctx,
    workerStepMap,
    navigationLocked,
    toggleMaximize,
    toggleFullscreen,
    toggleMinimize,
    handleStepClick,
  } = usePluginDialogHeaderLogic({ dialogState, pendingAction });
  const theme = useTheme();
  const isFullScreen = ctx.displayMode === 'full-screen';
  const [headerVisible, setHeaderVisible] = useState(!isFullScreen);

  useEffect(() => {
    setHeaderVisible(!isFullScreen);
  }, [isFullScreen]);

  const handleSensorEnter = useCallback(() => {
    if (!isFullScreen) return;
    setHeaderVisible(true);
  }, [isFullScreen]);

  const handleHeaderMouseLeave = useCallback(() => {
    if (!isFullScreen) return;
    setHeaderVisible(false);
  }, [isFullScreen]);

  const dragHandlePointerDown = ctx.onDragHandlePointerDown;
  const canMinimize = Boolean(ctx.onMinimizeChange);
  const isMinimized = Boolean(ctx.isMinimized);
  const hideFrameControls = Boolean(ctx.frameless && ctx.transparent);

  const headerSubtitle = useMemo(() => {
    if (subtitle && ctx.stepComponents.length <= 1) return subtitle;
    return undefined;
  }, [subtitle, ctx.stepComponents.length]);

  const handleHeaderDoubleClick = useCallback(
    (event: React.MouseEvent) => {
      event.stopPropagation();
      if (ctx.displayMode === 'full-screen' || !ctx.onDisplayModeChange) return;
      toggleMaximize();
    },
    [ctx.displayMode, ctx.onDisplayModeChange, toggleMaximize]
  );

  return (
    <>
      {isFullScreen && (
        <Box
          onMouseEnter={handleSensorEnter}
          sx={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            height: HEADER_HOVER_ZONE_HEIGHT,
            zIndex: (theme.zIndex?.modal ?? 1300) + 2,
            backgroundColor: 'transparent',
            pointerEvents: 'auto',
          }}
        />
      )}
      <Box
        data-dialog-drag-handle="true"
        onPointerDown={dragHandlePointerDown}
        onDoubleClick={handleHeaderDoubleClick}
        onPointerLeave={handleHeaderMouseLeave}
        sx={(theme) => ({
          display: 'flex',
          alignItems: 'flex-start',
          justifyContent: 'space-between',
          padding: headerVisible ? theme.spacing(1.5, 2, 0.1, 2) : 0,
          borderBottom: '1px solid',
          borderBottomColor: headerVisible ? theme.palette.divider : 'transparent',
          userSelect: 'none',
          gap: theme.spacing(1.5),
          cursor: ctx.displayMode === 'full-screen' ? 'default' : 'move',
          backgroundColor:
            theme.palette.mode === 'dark'
              ? alpha(theme.palette.common.white, 0.04)
              : getDialogSurfaceColor(theme),
          opacity: headerVisible ? 1 : 0,
          maxHeight: headerVisible ? 240 : 0,
          transform: headerVisible ? 'translateY(0)' : 'translateY(-8px)',
          overflow: 'hidden',
          pointerEvents: headerVisible ? 'auto' : 'none',
          transition: [
            `background-color ${theme.transitions.duration.shorter}ms ${theme.transitions.easing.easeInOut}`,
            `opacity 200ms ${theme.transitions.easing.easeInOut} 0ms`,
            `transform 200ms ${theme.transitions.easing.easeInOut} 0ms`,
            `max-height 200ms ${theme.transitions.easing.easeInOut} 0ms`,
            `padding 200ms ${theme.transitions.easing.easeInOut} 0ms`,
            `border-color 200ms ${theme.transitions.easing.easeInOut} 0ms`,
          ].join(', '),
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
            spacing={1}
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
            <Box sx={{ minWidth: 0, display: 'flex', alignItems: 'center', gap: 0.5 }}>
              <Typography variant="h6" noWrap>
                {title}
              </Typography>
              {pluginDescription ? (
                <Tooltip title={pluginDescription}>
                  <IconButton
                    size="small"
                    sx={{ p: 0.25 }}
                    aria-label={pluginDescription}
                    onPointerDown={stopPointerPropagation}
                    onDoubleClick={stopPointerPropagation}
                  >
                    <InfoOutlinedIcon fontSize="small" />
                  </IconButton>
                </Tooltip>
              ) : null}
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
              onDoubleClick={stopPointerPropagation}
              onMouseEnter={stopPointerPropagation}
              onMouseLeave={stopPointerPropagation}
              onMouseMove={stopPointerPropagation}
              onMouseOver={stopPointerPropagation}
              onMouseOut={stopPointerPropagation}
            >
              <PluginDialogStepper
                steps={ctx.stepComponents.map((s) => ({ id: s.id, label: s.label }))}
                activeStepIndex={ctx.activeStepIndex}
                enabledStepIndices={ctx.enabledStepIndices}
                validatedStepIndices={ctx.validatedStepIndices}
                handleStepClick={handleStepClick}
                navigationLocked={navigationLocked}
                workerStepMap={workerStepMap}
                dialogState={dialogState}
                pendingAction={pendingAction}
                stepData={ctx.stepData as Record<string, unknown>}
                theme={theme}
              />
            </Box>
          )}
        </Stack>

        {hideFrameControls ? null : (
          <Stack
            direction="row"
            spacing={1.5}
            alignItems="center"
            onDoubleClick={stopPointerPropagation}
          >
            <Stack direction="row" spacing={0.5} alignItems="center">
              {canMinimize ? (
                <PluginDialogMinimizeButton
                  isMinimized={isMinimized}
                  onClick={toggleMinimize}
                  onPointerDown={stopPointerPropagation}
                />
              ) : null}
              <PluginDialogMaximizeButton
                displayMode={ctx.displayMode === 'maximize' ? 'maximize' : 'default'}
                onClick={toggleMaximize}
                onPointerDown={stopPointerPropagation}
                disabled={!ctx.onDisplayModeChange}
              />
              <PluginDialogFullScreenButton
                displayMode={ctx.displayMode === 'full-screen' ? 'full-screen' : 'default'}
                onClick={toggleFullscreen}
                onPointerDown={stopPointerPropagation}
                disabled={!ctx.onDisplayModeChange}
              />
              <PluginDialogCloseButton
                onClick={() => ctx.onRequestClose('close')}
                onPointerDown={stopPointerPropagation}
              />
            </Stack>
          </Stack>
        )}
      </Box>
    </>
  );
};

PluginDialogHeader.displayName = 'PluginDialogHeader';
