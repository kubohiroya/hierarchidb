/**
 * DynamicSpeedDial Component
 *
 * A SpeedDial component that dynamically loads plugin-loaders from the registry
 * and displays them as creation actions, filtered by treeId.
 */

import type { TreeId } from '@hierarchidb/common-types';
import type { HierarchicalTreeNode } from '@hierarchidb/ui-treeconsole-base';
import { Box, Portal, SpeedDial, SpeedDialAction, SpeedDialIcon } from '@mui/material';
import type { PluginMenuItem, TreeContext } from '~/plugin-loaders/menu-builders.js';
import { useDynamicSpeedDial } from './useDynamicSpeedDial.js';

interface DynamicSpeedDialProps {
  treeId: TreeId | undefined;
  onCreateAction: (action: string, node: HierarchicalTreeNode) => void;
  position?: { bottom?: number; right?: number; left?: number; top?: number };
  hidden?: boolean;
  menuContext?: TreeContext; // Optional explicit context to stage items from VM
  onSuppress?: () => void;
}

export function DynamicSpeedDial({
  treeId,
  onCreateAction,
  position = { bottom: 16, right: 16 },
  hidden = false,
  onSuppress,
}: DynamicSpeedDialProps) {
  const {
    open,
    debugHitbox,
    hitboxes,
    useVM,
    vmItems,
    language,
    actionsPointerEvents,
    containerRef,
    resolveIcon,
    translateWithFallback,
    handleClose,
    toggleOpen,
    handleVMActionClick,
    transitionDuration,
  } = useDynamicSpeedDial({ treeId, hidden, onCreateAction, onSuppress });
  const createLabel = translateWithFallback('treeConsole.contextMenu.create', 'Create');

  // Don't render if hidden
  if (hidden) {
    return null;
  }

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
          ariaLabel={createLabel}
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
          icon={
            <SpeedDialIcon />
          }
          direction="up"
          open={open}
          transitionDuration={transitionDuration}
          onClose={(_, reason?: string) => {
            // Ignore auto-close reasons we don’t want (blur/mouseLeave)
            if (reason === 'blur' || reason === 'mouseLeave') return;
            // Allow toggle, escape, clickAway to close
            handleClose();
          }}
          FabProps={{
            onClick: toggleOpen,
            sx: { pointerEvents: 'auto' },
            title: createLabel,
            'aria-label': createLabel,
          }}
        >
            {useVM
              ? vmItems.map((item: PluginMenuItem) => {
                  const localizedLabel = translateWithFallback(
                    `plugins.${item.nodeType}.name`,
                    item.label
                  );
                  const localizedDescription = translateWithFallback(
                    `plugins.${item.nodeType}.description`,
                    (item.description ?? '').trim()
                  ).trim();
                  const tooltipTemplate = translateWithFallback(
                    'treeConsole.contextMenu.createTooltip',
                    '{{label}}: {{description}}'
                  );
                  const tooltipLabel =
                    localizedDescription.length > 0
                      ? tooltipTemplate
                          .replace('{{label}}', localizedLabel)
                          .replace('{{description}}', localizedDescription)
                      : localizedLabel;

                  return (
                    <SpeedDialAction
                      key={`${item.key}-${language}`}
                      icon={resolveIcon({ nodeType: item.nodeType, icon: item.icon })}
                      tooltipTitle={tooltipLabel}
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
                          bgcolor: item.backgroundColor,
                          '&:hover': {
                            bgcolor: item.icon?.color ? `${item.icon.color}33` : item.backgroundColor,
                          },
                        },
                      }}
                      tooltipPlacement="left"
                      data-testid={`create-${item.nodeType}-action`}
                    />
                  );
                })
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
                  left: hitboxes.fab?.left ?? hitboxes.container?.left,
                  top: (hitboxes.fab?.top ?? hitboxes.container?.top ?? 0) - 22,
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
              <Box
                key={`${r.left}-${r.top}-${r.width}-${r.height}-${idx}`}
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
