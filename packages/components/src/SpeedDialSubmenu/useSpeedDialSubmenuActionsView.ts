import type { MouseEvent as ReactMouseEvent } from 'react';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { SpeedDialSubmenuAction, SpeedDialSubmenuItem } from './SpeedDialSubmenuActions.js';

function hasChildren(action: SpeedDialSubmenuAction): action is SpeedDialSubmenuAction & {
  children: SpeedDialSubmenuItem[];
} {
  return Array.isArray(action.children) && action.children.length > 0;
}

export interface UseSpeedDialSubmenuActionsViewParams {
  actions: SpeedDialSubmenuAction[];
  open: boolean;
  submenuCloseDelayMs: number;
  onRequestClose: () => void;
}

export interface UseSpeedDialSubmenuActionsViewResult {
  activeParentId: string | null;
  activeParent: (SpeedDialSubmenuAction & { children: SpeedDialSubmenuItem[] }) | null;
  anchorEl: HTMLElement | null;
  submenuOpen: boolean;
  clearCloseTimer: () => void;
  scheduleCloseSubmenu: () => void;
  handlePrimaryActionEnter: (action: SpeedDialSubmenuAction, currentTarget: HTMLElement) => void;
  handlePrimaryActionClick: (
    action: SpeedDialSubmenuAction,
    event: ReactMouseEvent<HTMLElement>
  ) => void;
  handleSubmenuItemClick: (item: SpeedDialSubmenuItem, event: ReactMouseEvent<HTMLElement>) => void;
  isActionWithChildren: (action: SpeedDialSubmenuAction) => boolean;
}

export function useSpeedDialSubmenuActionsView({
  actions,
  open,
  submenuCloseDelayMs,
  onRequestClose,
}: UseSpeedDialSubmenuActionsViewParams): UseSpeedDialSubmenuActionsViewResult {
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

  return {
    activeParentId,
    activeParent,
    anchorEl,
    submenuOpen,
    clearCloseTimer,
    scheduleCloseSubmenu,
    handlePrimaryActionEnter,
    handlePrimaryActionClick,
    handleSubmenuItemClick,
    isActionWithChildren: hasChildren,
  };
}
