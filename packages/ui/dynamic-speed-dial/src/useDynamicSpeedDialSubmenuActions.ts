import { useMemo } from 'react';
import type { MouseEvent } from 'react';
import type {
  DynamicSpeedDialIconResolver,
  DynamicSpeedDialMenuItem,
  DynamicSpeedDialTranslator,
} from './types.js';
import type {
  SpeedDialSubmenuAction,
  SpeedDialSubmenuItem,
} from '@hierarchidb/components';

export interface UseDynamicSpeedDialSubmenuActionsParams {
  useVM: boolean;
  vmItems: readonly DynamicSpeedDialMenuItem[];
  language: string;
  resolveIcon: DynamicSpeedDialIconResolver;
  translateWithFallback: DynamicSpeedDialTranslator;
  handleVMActionClick: (createType: string, options?: { openInNewTab?: boolean }) => void;
}

export function useDynamicSpeedDialSubmenuActions({
  useVM,
  vmItems,
  language,
  resolveIcon,
  translateWithFallback,
  handleVMActionClick,
}: UseDynamicSpeedDialSubmenuActionsParams): SpeedDialSubmenuAction[] {
  return useMemo(() => {
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

    const toHoverBackgroundColor = (item: DynamicSpeedDialMenuItem) => {
      if (!item.icon || typeof item.icon !== 'object') return item.backgroundColor;
      const icon = item.icon as Record<string, unknown>;
      return typeof icon.color === 'string' ? `${icon.color}33` : item.backgroundColor;
    };

    const buildLeafAction = (item: DynamicSpeedDialMenuItem, testId: string): SpeedDialSubmenuItem => ({
      id: `create:${toCreateType(item)}:${language}`,
      label: buildItemLabel(item),
      icon: resolveIcon({ nodeType: item.nodeType, icon: item.icon }),
      onClick: (event: MouseEvent<HTMLElement>) =>
        handleVMActionClick(toCreateType(item), { openInNewTab: event.shiftKey }),
      testId,
    });

    for (const item of vmItems) {
      const children = item.children ?? [];
      const hasChildren = children.length > 0;
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
          hoverBackgroundColor: toHoverBackgroundColor(item),
          testId: `${testIdBase}-action`,
          submenuTestId: `${testIdBase}-submenu`,
          submenuTriggerTestId: `${testIdBase}-submenu-trigger`,
          children: children.map((child, childIndex) =>
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
          hoverBackgroundColor: toHoverBackgroundColor(item),
          testId: `${testIdBase}-action`,
        });
      }
    }

    return actions;
  }, [handleVMActionClick, language, resolveIcon, translateWithFallback, useVM, vmItems]);
}
