import { Box, Portal, SpeedDial, SpeedDialIcon } from '@mui/material';
import { useMemo } from 'react';
import type { MouseEvent } from 'react';
import type {
  DynamicSpeedDialIconResolver,
  DynamicSpeedDialMenuItem,
  DynamicSpeedDialTranslator,
} from './types.js';
import {
  type SpeedDialSubmenuAction,
  SpeedDialSubmenuActions,
  type SpeedDialSubmenuItem,
} from '@hierarchidb/ui-speeddial-submenu';
import { useDynamicSpeedDial } from './useDynamicSpeedDial.js';

export interface DynamicSpeedDialProps<TNode = unknown> {
  treeId?: string;
  onCreateAction: (
    action: string,
    node: TNode,
    options?: { openInNewTab?: boolean }
  ) => void;
  position?: {
    bottom?: number;
    right?: number;
    left?: number;
    top?: number;
  };
  hidden?: boolean;
  menuItems?: readonly DynamicSpeedDialMenuItem[];
  onSuppress?: () => void;
  resolveIcon: DynamicSpeedDialIconResolver;
  translateWithFallback: DynamicSpeedDialTranslator;
}

export function DynamicSpeedDial<TNode = unknown>(props: DynamicSpeedDialProps<TNode>) {
  const {
    onCreateAction,
    position = { bottom: 16, right: 16 },
    hidden = false,
    menuItems = [],
    onSuppress,
    resolveIcon,
    translateWithFallback,
  } = props;
  const {
    open,
    debugHitbox,
    hitboxes,
    useVM,
    vmItems,
    language,
    actionsPointerEvents,
    dialogOpen,
    containerRef,
    handleClose,
    toggleOpen,
    handleVMActionClick,
    transitionDuration,
  } = useDynamicSpeedDial<TNode>({
    hidden,
    menuItems,
    onCreateAction,
    onSuppress,
    resolveIcon,
  });

  const createLabel = translateWithFallback('treeConsole.contextMenu.create', 'Create');
  const effectiveHidden = hidden || dialogOpen;

  const submenuActions = useMemo<SpeedDialSubmenuAction[]>(() => {
    if (!useVM) return [];

    const actions: SpeedDialSubmenuAction[] = [];

    const buildItemLabel = (item: DynamicSpeedDialMenuItem) => {
      if (item.labelKey) {
        return translateWithFallback(item.labelKey, item.label);
      }
      return translateWithFallback(`plugins.${item.nodeType}.name`, item.label);
    };

    const buildTooltipLabel = (item: DynamicSpeedDialMenuItem) => {
      const localizedLabel = buildItemLabel(item);
      const localizedDescription = item.descriptionKey
        ? translateWithFallback(item.descriptionKey, (item.description ?? '').trim()).trim()
        : translateWithFallback(`plugins.${item.nodeType}.description`, (item.description ?? '').trim()).trim();
      const tooltipTemplate = translateWithFallback(
        'treeConsole.contextMenu.createTooltip',
        '{{label}}: {{description}}'
      );
      if (localizedDescription.length === 0) {
        return localizedLabel;
      }
      return tooltipTemplate
        .replace('{{label}}', localizedLabel)
        .replace('{{description}}', localizedDescription);
    };

    const toCreateType = (item: DynamicSpeedDialMenuItem) => item.createType ?? item.nodeType;

    const buildLeafAction = (item: DynamicSpeedDialMenuItem, testId: string): SpeedDialSubmenuItem => ({
      id: `create:${toCreateType(item)}:${language}`,
      label: buildItemLabel(item),
      icon: resolveIcon({ nodeType: item.nodeType, icon: item.icon }),
      onClick: (event: MouseEvent<HTMLElement>) =>
        handleVMActionClick(toCreateType(item), { openInNewTab: event.shiftKey }),
      testId,
    });

    for (const item of vmItems) {
      const hasChildren = Array.isArray(item.children) && item.children.length > 0;
      const testIdBase = `create-${item.nodeType}`;
      if (hasChildren) {
        actions.push({
          id: `create:${toCreateType(item)}:${language}`,
          label: buildItemLabel(item),
          icon: resolveIcon({ nodeType: item.nodeType, icon: item.icon }),
          tooltipTitle: buildTooltipLabel(item),
          onClick: (event: MouseEvent<HTMLElement>) =>
            handleVMActionClick(toCreateType(item), { openInNewTab: event.shiftKey }),
          backgroundColor: item.backgroundColor,
          hoverBackgroundColor: (() => {
            if (!item.icon || typeof item.icon !== 'object') return item.backgroundColor;
            const icon = item.icon as Record<string, unknown>;
            return typeof icon.color === 'string' ? `${icon.color}33` : item.backgroundColor;
          })(),
          testId: `${testIdBase}-action`,
          submenuTestId: `${testIdBase}-submenu`,
          submenuTriggerTestId: `${testIdBase}-submenu-trigger`,
          children: item.children!.map((child, childIndex) =>
            buildLeafAction(child, `${testIdBase}-submenu-action-${childIndex + 1}`)
          ),
        });
      } else {
        actions.push({
          id: `create:${toCreateType(item)}:${language}`,
          label: buildItemLabel(item),
          icon: resolveIcon({ nodeType: item.nodeType, icon: item.icon }),
          tooltipTitle: buildTooltipLabel(item),
          onClick: (event: MouseEvent<HTMLElement>) =>
            handleVMActionClick(toCreateType(item), { openInNewTab: event.shiftKey }),
          backgroundColor: item.backgroundColor,
          hoverBackgroundColor: (() => {
            if (!item.icon || typeof item.icon !== 'object') return item.backgroundColor;
            const icon = item.icon as Record<string, unknown>;
            return typeof icon.color === 'string' ? `${icon.color}33` : item.backgroundColor;
          })(),
          testId: `${testIdBase}-action`,
        });
      }
    }

    return actions;
  }, [handleVMActionClick, language, resolveIcon, translateWithFallback, useVM, vmItems]);

  if (effectiveHidden) {
    return null;
  }

  return (
    <Portal>
      <Box
        ref={containerRef}
        sx={{
          position: 'fixed',
          ...position,
          zIndex: open ? 2147483000 : 0,
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
          transitionDuration={transitionDuration}
          onClose={(_, reason?: string) => {
            if (reason === 'blur' || reason === 'mouseLeave') return;
            handleClose();
          }}
          FabProps={{
            onClick: toggleOpen,
            sx: { pointerEvents: 'auto' },
            title: createLabel,
            'aria-label': createLabel,
          }}
        >
          {useVM ? (
            <SpeedDialSubmenuActions
              actions={submenuActions}
              open={open}
              onRequestClose={handleClose}
              actionFabSx={{
                pointerEvents: 'auto',
                touchAction: 'manipulation',
                transform: 'translate3d(0,0,0)',
              }}
            />
          ) : null}
        </SpeedDial>

        {debugHitbox && (
          <>
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
