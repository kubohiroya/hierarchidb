import {
  Grow,
  MenuItem,
  MenuList,
  Paper,
  Popper,
  type PopperProps,
  SpeedDialAction,
} from '@mui/material';
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
      if (hasChildren(action)) {
        handlePrimaryActionEnter(action, event.currentTarget as HTMLElement);
        return;
      }
      action.onClick?.(event);
      closeSubmenu();
      onRequestClose();
    },
    [closeSubmenu, handlePrimaryActionEnter, onRequestClose]
  );

  const handleSubmenuItemClick = useCallback(
    (item: SpeedDialSubmenuItem, event: ReactMouseEvent<HTMLElement>) => {
      item.onClick(event);
      closeSubmenu();
      onRequestClose();
    },
    [closeSubmenu, onRequestClose]
  );

  return (
    <>
      {actions.map((action) => {
        const parentOpen = submenuOpen && action.id === activeParentId;
        const tooltipTitle = action.tooltipTitle ?? action.label;
        return (
          <SpeedDialAction
            key={action.id}
            open={open}
            icon={action.icon}
            tooltipTitle={tooltipTitle}
            onMouseEnter={(event) =>
              handlePrimaryActionEnter(action, event.currentTarget as HTMLElement)
            }
            onMouseLeave={() => {
              if (hasChildren(action)) scheduleCloseSubmenu();
            }}
            onClick={(event) => handlePrimaryActionClick(action, event)}
            FabProps={{
              size: 'medium',
              color: 'default',
              'aria-haspopup': hasChildren(action) ? 'menu' : undefined,
              'aria-expanded': hasChildren(action) ? parentOpen : undefined,
              onMouseEnter: (event) =>
                handlePrimaryActionEnter(action, event.currentTarget as HTMLElement),
              onMouseLeave: () => {
                if (hasChildren(action)) scheduleCloseSubmenu();
              },
              sx: {
                pointerEvents: 'auto',
                touchAction: 'manipulation',
                transform: 'translate3d(0,0,0)',
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
