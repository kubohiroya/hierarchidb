/**
 * DynamicSpeedDial Component
 *
 * A SpeedDial component that dynamically loads plugin-loader from the registry
 * and displays them as creation actions, filtered by treeId.
 */

import { useEffect, useRef, useState } from 'react';
import { Box, SpeedDial, SpeedDialAction, SpeedDialIcon, Portal } from '@mui/material';
import { getMuiIconWithColor as getMuiIconComponent } from '@hierarchidb/ui-icon';
import { usePluginMenuItems } from '~/hooks/usePluginMenuItems.js';
import type { TreeContext } from '~/plugin-loader/menu-builders.js';
import type { TreeNodeData } from '@hierarchidb/ui-treeconsole-base';
import type { TreeId } from '@hierarchidb/common-types';

interface DynamicSpeedDialProps {
  treeId: TreeId | undefined;
  onCreateAction: (action: string, node: TreeNodeData) => void;
  position?: { bottom?: number; right?: number; left?: number; top?: number };
  hidden?: boolean;
  menuContext?: TreeContext; // Optional explicit context to build items from VM
}

type DynamicSpeedDialWindow = Window & {
  __HDB_SD_HITBOX__?: boolean;
};

export function DynamicSpeedDial({
                                   treeId,
                                   onCreateAction,
                                   position = { bottom: 16, right: 16 },
                                   hidden = false,
                                 }: DynamicSpeedDialProps) {
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const [debugHitbox, setDebugHitbox] = useState<boolean>(() => {
    try {
      // URL param sdHitbox=1 or debug=sd, or persisted flag
      const sp = typeof window !== 'undefined' ? new URLSearchParams(window.location.search) : null;
      const urlOn = sp?.get('sdHitbox') === '1' || sp?.get('debug') === 'sd';
      const persisted = typeof localStorage !== 'undefined' ? localStorage.getItem('hdb.sd.hitbox') === '1' : false;
      const globalOn = typeof window !== 'undefined' && (window as DynamicSpeedDialWindow).__HDB_SD_HITBOX__ === true;
      return urlOn || persisted || globalOn;
    } catch {
      return false;
    }
  });

  const [hitboxes, setHitboxes] = useState<{
    container?: DOMRect;
    fab?: DOMRect;
    actions: DOMRect[];
    topAtFab?: string;
  }>({ actions: [] });

  // If menuContext is provided, build items from virtual module definitions (VM-based path)
  const vmItems = usePluginMenuItems(treeId);
  // Use VM path only when we actually have menu items
  const useVM = vmItems.length > 0;

  const handleClose = () => setOpen(false);
  // const handleToggle = () => setOpen((v) => !v);

  // Custom outside-click behavior:
  // - Keep menu open on mouse leave/blur
  // - Close only when user clicks outside the SpeedDial container
  useEffect(() => {
    if (!open) return;
    const onDocPointerDown = (ev: Event) => {
      const root = containerRef.current;
      const target = ev.target as Node | null;
      if (!root) return;
      if (target && root.contains(target)) {
        // Clicked inside SpeedDial; action handlers will decide closing
        return;
      }
      // Clicked outside → close
      setOpen(false);
    };
    document.addEventListener('pointerdown', onDocPointerDown, true);
    return () => {
      document.removeEventListener('pointerdown', onDocPointerDown, true);
    };
  }, [open]);

  // VM-based click
  const handleVMActionClick = (nodeType: string) => {
    const action = `create:${nodeType}`;
    onCreateAction(action, {} as TreeNodeData);
    handleClose();
  };

  // Toggle debug with Alt+Shift+H
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.altKey && e.shiftKey && (e.key === 'h' || e.key === 'H')) {
        setDebugHitbox((v) => {
          const nv = !v;
          localStorage.setItem('hdb.sd.hitbox', nv ? '1' : '0');
          (window as DynamicSpeedDialWindow).__HDB_SD_HITBOX__ = nv;
          return nv;
        });
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  // Measure hitboxes while debug is on
  useEffect(() => {
    if (!debugHitbox) return;
    let raf = 0;
    let intervalId: number | undefined;
    const measure = () => {
      const root = containerRef.current;
      if (!root) return;
      const fab = root.querySelector('.MuiSpeedDial-fab') as HTMLElement | null;
      const actions = Array.from(root.querySelectorAll('.MuiSpeedDialAction-fab')) as HTMLElement[];
      const rectRoot = root.getBoundingClientRect();
      const rectFab = fab?.getBoundingClientRect();
      const rectActs = actions.map((a) => a.getBoundingClientRect());
      let topAtFab: string | undefined ;
      if (rectFab) {
        const cx = rectFab.left + rectFab.width / 2;
        const cy = rectFab.top + rectFab.height / 2;
        const el = document.elementFromPoint(cx, cy);
        if (el) {
          const cls = (el as HTMLElement).className?.toString?.() || '';
          const id = (el as HTMLElement).id ? `#${(el as HTMLElement).id}` : '';
          const tn = el.nodeName.toLowerCase();
          topAtFab = `${tn}${id}${cls ? '.' + cls.toString().split(' ').slice(0, 3).join('.') : ''}`;
        }
      }
      setHitboxes({ container: rectRoot, fab: rectFab, actions: rectActs, topAtFab });
    };
    const onScrollOrResize = () => {
      if (raf) cancelAnimationFrame(raf);
      raf = requestAnimationFrame(measure);
    };
    window.addEventListener('scroll', onScrollOrResize, true);
    window.addEventListener('resize', onScrollOrResize);
    // Keep updating periodically while open to catch layout animations
    intervalId = window.setInterval(measure, 300) as unknown as number;
    measure();
    return () => {
      if (raf) cancelAnimationFrame(raf);
      if (intervalId) window.clearInterval(intervalId);
      window.removeEventListener('scroll', onScrollOrResize, true);
      window.removeEventListener('resize', onScrollOrResize);
    };
  }, [debugHitbox, open]);

  // Don't render if hidden
  if (hidden) {
    return null;
  }

  // Compute pointer-events for actions to avoid invisible hitbox when closed
  const actionsPointerEvents = open ? 'auto' : 'none';

  return (
    <Portal>
      <Box
        ref={containerRef}
        sx={{
          position: 'fixed',
          ...position,
          // Keep above overlays only when open
          zIndex: open ? 2147483000 : 0,
          // Make only inner FAB/actions receive pointer events to avoid wrapper intercepts
          pointerEvents: 'none',
          outline: debugHitbox ? '2px solid rgba(0,255,255,0.6)' : undefined,
          outlineOffset: debugHitbox ? '0px' : undefined,
        }}
        data-testid="dynamic-speed-dial-container"
      >
        <SpeedDial
          ariaLabel="Create new item"
          sx={{
            position: 'static',
            '& .MuiSpeedDial-fab': {
              bgcolor: 'primary.main',
              color: 'white',
              '&:hover': {
                bgcolor: 'primary.dark',
              },
              // Ensure the visible icon and the hitbox align perfectly
              width: 56,
              height: 56,
              minWidth: 56,
              minHeight: 56,
              pointerEvents: 'auto',
              transform: 'translate3d(0,0,0)',
              willChange: 'transform',
              touchAction: 'manipulation',
              outline: debugHitbox ? '2px dashed rgba(0,255,0,0.9)' : undefined,
              outlineOffset: debugHitbox ? '0px' : undefined,
            },
            '& .MuiSpeedDial-actions': {
              pointerEvents: actionsPointerEvents,
            },
            '& .MuiSpeedDialAction-fab': {
              pointerEvents: actionsPointerEvents,
              outline: debugHitbox ? '2px dashed rgba(255,165,0,0.9)' : undefined,
              outlineOffset: debugHitbox ? '0px' : undefined,
            },
            '& .MuiSpeedDial-actionsClosed': {
              pointerEvents: 'none',
            },
          }}
          icon={<SpeedDialIcon />}
          direction="up"
          open={open}
          onClose={(_, reason?: string) => {
            // Ignore auto-close reasons we don’t want (blur/mouseLeave)
            if (reason === 'blur' || reason === 'mouseLeave') return;
            // Allow toggle, escape, clickAway to close
            handleClose();
          }}
          FabProps={{
            onClick: () => setOpen((v) => !v),
            sx: { pointerEvents: 'auto' },
          }}
        >
          {useVM
            ? vmItems.map((item) => (
              <SpeedDialAction
                key={item.key}
                icon={getMuiIconComponent(item.icon?.muiIconName, item.icon?.emoji, item.icon?.color)}
                tooltipTitle={item.label}
                onClick={() => handleVMActionClick(item.nodeType)}
                sx={{
                  '& .MuiTooltip-tooltip': {
                    maxWidth: 300,
                    fontSize: '0.875rem',
                  },
                }}
                FabProps={{
                  size: 'medium',
                  color: 'default',
                  sx: {
                    pointerEvents: 'auto',
                    touchAction: 'manipulation',
                    transform: 'translate3d(0,0,0)',
                    // Keep background accent with slight transparency to improve contrast
                    bgcolor: item.icon?.color ? `${item.icon.color}1A` : undefined, // ~10% opacity
                    '&:hover': { bgcolor: item.icon?.color ? `${item.icon.color}33` : undefined },
                  },
                }}
                tooltipPlacement="left"
                data-testid={`create-${item.nodeType}-action`}
              />
            ))
            : null}
        </SpeedDial>

        {/* Debug overlays: fixed boxes showing current hitboxes and top element at FAB center */}
        {debugHitbox && (
          <>
            {/* FAB center marker and info label */}
            {hitboxes.fab && (
              <Box
                sx={{
                  position: 'fixed',
                  left: hitboxes.fab.left + hitboxes.fab.width / 2 - 4,
                  top: hitboxes.fab.top + hitboxes.fab.height / 2 - 4,
                  width: 8,
                  height: 8,
                  borderRadius: '50%',
                  backgroundColor: 'rgba(0,255,0,0.9)',
                  pointerEvents: 'none',
                }}
              />
            )}
            {(hitboxes.fab || hitboxes.container) && (
              <Box
                sx={{
                  position: 'fixed',
                  left: (hitboxes.fab?.left ?? hitboxes.container!.left),
                  top: (hitboxes.fab?.top ?? hitboxes.container!.top) - 22,
                  px: 1,
                  py: 0.25,
                  fontSize: 11,
                  bgcolor: 'rgba(0,0,0,0.7)',
                  color: '#fff',
                  borderRadius: 1,
                  pointerEvents: 'none',
                }}
              >
                SD hitbox debug — topAtFab: {hitboxes.topAtFab || 'n/a'}
              </Box>
            )}
            {/* Action boxes outline rendered via CSS; extra fixed rectangles to visualize area explicitly */}
            {hitboxes.actions.map((r, idx) => (
              <Box key={idx}
                   sx={{
                     position: 'fixed',
                     left: r.left,
                     top: r.top,
                     width: r.width,
                     height: r.height,
                     border: '1px dotted rgba(255,165,0,0.9)',
                     pointerEvents: 'none',
                   }}
              />
            ))}
          </>
        )}
      </Box>
    </Portal>
  );
}
