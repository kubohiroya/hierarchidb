import type { TreeId } from '@hierarchidb/core-types';
import type { HierarchicalTreeNode } from '@hierarchidb/ui-treeconsole-base';
import { useGlobalI18nTranslator } from '@hierarchidb/ui-plugin-shell/ui-i18n';
import type { IconDescriptorInput } from '@hierarchidb/components';
import { useIconRegistry } from '@hierarchidb/components';
import { useMemo } from 'react';
import {
  DynamicSpeedDial as BaseDynamicSpeedDial,
  type DynamicSpeedDialProps as BaseDynamicSpeedDialProps,
} from '@hierarchidb/ui-dynamic-speed-dial';
import type { TreeContext } from '~/plugin-loaders/menu-builders';
import { usePluginMenuItems } from '~/hooks/usePluginMenuItems';

export interface DynamicSpeedDialProps
  extends Omit<
    BaseDynamicSpeedDialProps<HierarchicalTreeNode>,
    'menuItems' | 'resolveIcon' | 'translateWithFallback'
  > {
  treeId?: TreeId;
  menuContext?: TreeContext;
}

export function DynamicSpeedDial({ treeId, menuContext, ...props }: DynamicSpeedDialProps) {
  const menuItems = usePluginMenuItems(treeId);
  const { t } = useGlobalI18nTranslator();
  const { resolveIcon } = useIconRegistry();

  void menuContext;

  const translateWithFallback = useMemo(
    () =>
      (key: string, fallback: string) => {
        const safeFallback = fallback?.trim?.() ?? '';
        const translated = t(key, safeFallback);
        if (translated === key) {
          return safeFallback || key;
        }
        return translated;
      },
    [t]
  );

  return (
    <BaseDynamicSpeedDial
      {...props}
      treeId={treeId}
      menuItems={menuItems}
      resolveIcon={({ nodeType, icon }) =>
        resolveIcon({
          nodeType,
          icon: icon as IconDescriptorInput['icon'],
        })
      }
      translateWithFallback={translateWithFallback}
    />
  );
}
