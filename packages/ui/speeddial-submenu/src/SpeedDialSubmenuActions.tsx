import {
  Box,
  Fab,
  Grow,
  MenuItem,
  MenuList,
  Paper,
  Popper,
  type PopperProps,
  SpeedDialAction,
} from '@mui/material';
import ArrowDownwardIcon from '@mui/icons-material/ArrowDownward';
import ArrowLeftIcon from '@mui/icons-material/ArrowLeft';
import ArrowRightIcon from '@mui/icons-material/ArrowRight';
import ArrowUpwardIcon from '@mui/icons-material/ArrowUpward';
import type { SxProps, Theme } from '@mui/material/styles';
import type { MouseEvent as ReactMouseEvent, ReactNode } from 'react';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

export interface SpeedDialSubmenuItem {
  id: string;
  label: string;
  icon: ReactNode;
  onClick: (event: ReactMouseEvent<HTMLElement>) => void;
  testId?: string;
}

export interface SpeedDialSubmenuAction {
  id: string;
  label: string;
  icon: ReactNode;
  tooltipTitle?: string;
  onClick?: (event: ReactMouseEvent<HTMLElement>) => void;
  children?: SpeedDialSubmenuItem[];
  backgroundColor?: string;
  hoverBackgroundColor?: string;
  testId?: string;
  submenuTestId?: string;
  submenuTriggerTestId?: string;
}

export interface SpeedDialSubmenuActionsProps {
  actions: SpeedDialSubmenuAction[];
  open: boolean;
  onRequestClose: () => void;
  submenuPlacement?: PopperProps['placement'];
  submenuOffsetPx?: number;
  submenuCloseDelayMs?: number;
  actionFabSx?: SxProps<Theme>;
}

const DEFAULT_SUBMENU_OFFSET_PX = 4;
const DEFAULT_SUBMENU_CLOSE_DELAY_MS = 140;

function hasChildren(action: SpeedDialSubmenuAction): action is SpeedDialSubmenuAction & {
  children: SpeedDialSubmenuItem[];
} {
  return Array.isArray(action.children) && action.children.length > 0;
}

function getPlacementDirection(placement: PopperProps['placement']): 'left' | 'right' | 'top' | 'bottom' {
  if (!placement) return 'left';
  if (placement.startsWith('right')) return 'right';
  if (placement.startsWith('top')) return 'top';
  if (placement.startsWith('bottom')) return 'bottom';
  return 'left';
}

function getSubmenuDirectionIcon(direction: 'left' | 'right' | 'top' | 'bottom') {
  if (direction === 'right') return <ArrowRightIcon fontSize="small" />;
  if (direction === 'top') return <ArrowUpwardIcon fontSize="small" />;
  if (direction === 'bottom') return <ArrowDownwardIcon fontSize="small" />;
  return <ArrowLeftIcon fontSize="small" />;
}

function getTriggerPositionSx(direction: 'left' | 'right' | 'top' | 'bottom'): SxProps<Theme> {
  if (direction === 'right') {
    return {
      right: -12,
      top: '50%',
      transform: 'translate(50%, -50%)',
    };
  }
  if (direction === 'top') {
    return {
      top: -12,
      left: '50%',
      transform: 'translate(-50%, -50%)',
    };
  }
  if (direction === 'bottom') {
    return {
      bottom: -12,
      left: '50%',
      transform: 'translate(-50%, 50%)',
    };
  }
  return {
    left: -12,
    top: '50%',
    transform: 'translate(-50%, -50%)',
  };
}

export function SpeedDialSubmenuActions({
  actions,
  open,
  onRequestClose,
  submenuPlacement = 'left-start',
  submenuOffsetPx = DEFAULT_SUBMENU_OFFSET_PX,
  submenuCloseDelayMs = DEFAULT_SUBMENU_CLOSE_DELAY_MS,
  actionFabSx,
}: SpeedDialSubmenuActionsProps) {
  const [activeParentId, setActiveParentId] = useState<string | null>(null);
  const [anchorEl, setAnchorEl] = useState<HTMLElement | null>(null);
  const closeTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const clearCloseTimer = useCallback(() => {
    if (closeTimerRef.current !== null) {
      clearTimeout(closeTimerRef.current);
      closeTimerRef.current = null;
    }
  }, []);

  const closeSubmenu = useCallback(() => {
    clearCloseTimer();
    setActiveParentId(null);
    setAnchorEl(null);
  }, [clearCloseTimer]);

  const scheduleCloseSubmenu = useCallback(() => {
    clearCloseTimer();
    closeTimerRef.current = setTimeout(() => {
      setActiveParentId(null);
      setAnchorEl(null);
      closeTimerRef.current = null;
    }, submenuCloseDelayMs);
  }, [clearCloseTimer, submenuCloseDelayMs]);

  useEffect(() => {
    return () => clearCloseTimer();
  }, [clearCloseTimer]);

  useEffect(() => {
    if (!open) {
      closeSubmenu();
    }
  }, [closeSubmenu, open]);

  const activeParent = useMemo(() => {
    if (!activeParentId) return null;
    const candidate = actions.find((action) => action.id === activeParentId);
    if (!candidate || !hasChildren(candidate)) return null;
    return candidate;
  }, [actions, activeParentId]);

  const submenuOpen = Boolean(open && anchorEl && activeParent);

  const handlePrimaryActionEnter = useCallback(
    (action: SpeedDialSubmenuAction, currentTarget: HTMLElement) => {
      if (!hasChildren(action)) {
        closeSubmenu();
        return;
      }
      clearCloseTimer();
      setActiveParentId(action.id);
      setAnchorEl(currentTarget);
    },
    [clearCloseTimer, closeSubmenu]
  );

  const handlePrimaryActionClick = useCallback(
    (action: SpeedDialSubmenuAction, event: ReactMouseEvent<HTMLElement>) => {
      action.onClick?.(event);
      closeSubmenu();
      onRequestClose();
    },
    [closeSubmenu, onRequestClose]
  );

  const handleSubmenuItemClick = useCallback(
    (item: SpeedDialSubmenuItem, event: ReactMouseEvent<HTMLElement>) => {
      item.onClick(event);
      closeSubmenu();
      onRequestClose();
    },
    [closeSubmenu, onRequestClose]
  );

  const submenuDirection = getPlacementDirection(submenuPlacement);
  const submenuDirectionIcon = getSubmenuDirectionIcon(submenuDirection);
  const triggerPositionSx = getTriggerPositionSx(submenuDirection);

  return (
    <>
      {actions.map((action) => {
        const parentOpen = submenuOpen && action.id === activeParentId;
        const tooltipTitle = action.tooltipTitle ?? action.label;
        const triggerTestId = action.submenuTriggerTestId ?? `${action.testId ?? action.id}-submenu-trigger`;
        return (
          <SpeedDialAction
            key={action.id}
            open={open}
            icon={
              <Box
                sx={{
                  position: 'relative',
                  width: '100%',
                  height: '100%',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                {action.icon}
                {hasChildren(action) ? (
                  <Fab
                    size="small"
                    color="default"
                    aria-label={`${action.label} submenu trigger`}
                    aria-haspopup="menu"
                    aria-expanded={parentOpen}
                    onMouseEnter={(event) =>
                      handlePrimaryActionEnter(action, event.currentTarget as HTMLElement)
                    }
                    onMouseLeave={scheduleCloseSubmenu}
                    onClick={(event) => {
                      event.preventDefault();
                      event.stopPropagation();
                    }}
                    data-testid={triggerTestId}
                    sx={{
                      position: 'absolute',
                      minWidth: 20,
                      minHeight: 20,
                      width: 20,
                      height: 20,
                      p: 0,
                      boxShadow: 2,
                      pointerEvents: 'auto',
                      ...triggerPositionSx,
                    }}
                  >
                    {submenuDirectionIcon}
                  </Fab>
                ) : null}
              </Box>
            }
            tooltipTitle={tooltipTitle}
            onClick={(event) => handlePrimaryActionClick(action, event)}
            FabProps={{
              size: 'medium',
              color: 'default',
              'aria-haspopup': hasChildren(action) ? 'menu' : undefined,
              'aria-expanded': hasChildren(action) ? parentOpen : undefined,
              sx: {
                pointerEvents: 'auto',
                touchAction: 'manipulation',
                transform: 'translate3d(0,0,0)',
                overflow: 'visible',
                bgcolor: action.backgroundColor,
                '&:hover': {
                  bgcolor: action.hoverBackgroundColor ?? action.backgroundColor,
                },
                ...actionFabSx,
              },
            }}
            tooltipPlacement="left"
            data-testid={action.testId}
          />
        );
      })}
      <Popper
        open={submenuOpen}
        anchorEl={anchorEl}
        placement={submenuPlacement}
        transition
        modifiers={[
          {
            name: 'offset',
            options: {
              offset: [0, submenuOffsetPx],
            },
          },
        ]}
        sx={{
          zIndex: 2147483001,
          pointerEvents: 'auto',
        }}
      >
        {({ TransitionProps }) => (
          <Grow {...TransitionProps} style={{ transformOrigin: 'right top' }}>
            <Paper
              elevation={8}
              onMouseEnter={clearCloseTimer}
              onMouseLeave={scheduleCloseSubmenu}
              data-testid={activeParent?.submenuTestId}
            >
              <MenuList dense>
                {activeParent?.children.map((item) => (
                  <MenuItem
                    key={item.id}
                    onClick={(event) => handleSubmenuItemClick(item, event)}
                    data-testid={item.testId}
                  >
                    {item.icon}
                    <span style={{ marginLeft: 8 }}>{item.label}</span>
                  </MenuItem>
                ))}
              </MenuList>
            </Paper>
          </Grow>
        )}
      </Popper>
    </>
  );
}
