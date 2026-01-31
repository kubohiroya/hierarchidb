/**
 * React hook to get SpeedDial/Menu items based on console context
 */
import type { TreeId } from '@hierarchidb/core-types';
import { prefetchMuiIcons } from '@hierarchidb/ui-plugin-shell/ui-icon';
import { useEffect, useState } from 'react';
import type {
  PluginMenuItem as LoaderMenuItem,
  TreeContext,
} from '../plugin-loaders/menu-builders.ts';
// Local replicas of menu types to avoid hard dependency on virtual modules

export type PluginMenuItem = LoaderMenuItem;

type MenuBuildersCache = {
  buildMenuItemsForTreeId?: (treeId?: TreeId | null) => PluginMenuItem[];
  buildMenuItemsForContext?: (context: TreeContext) => PluginMenuItem[];
  normalizeContextFromTreeId?: (treeId?: TreeId | null) => TreeContext;
};

type MenuBuildersModule = Required<
  Pick<MenuBuildersCache, 'buildMenuItemsForTreeId' | 'buildMenuItemsForContext'>
> &
  Pick<MenuBuildersCache, 'normalizeContextFromTreeId'>;

const globalMenuBuilders = globalThis as typeof globalThis & {
  __HDB_MENU_BUILDERS__?: MenuBuildersCache;
};

export function usePluginMenuItems(treeId?: TreeId): PluginMenuItem[] {
  const [items, setItems] = useState<PluginMenuItem[]>([]);

  useEffect(() => {
    let active = true;

    async function load() {
      // 1) Try cached builders injected by root.tsx
      const cached = globalMenuBuilders.__HDB_MENU_BUILDERS__;
      if (cached) {
        if (cached.buildMenuItemsForTreeId || cached.buildMenuItemsForContext) {
          const list = cached.buildMenuItemsForTreeId
            ? cached.buildMenuItemsForTreeId(treeId)
            : (cached.buildMenuItemsForContext?.(
                cached.normalizeContextFromTreeId?.(treeId) ?? 'projects'
              ) ?? []);
          if (active) setItems(list);
          await prefetchMuiIcons(list.map((i) => i.icon?.muiIconName).filter(Boolean));
          return;
        }
      }

      // 2) Fallback: dynamic import (works in dev as well)
      try {
        const mod = (await import('../plugin-loaders/menu-builders.ts')) as MenuBuildersModule;
        const cache: MenuBuildersCache = {
          buildMenuItemsForTreeId: mod.buildMenuItemsForTreeId,
          buildMenuItemsForContext: mod.buildMenuItemsForContext,
          normalizeContextFromTreeId: mod.normalizeContextFromTreeId,
        };
        globalMenuBuilders.__HDB_MENU_BUILDERS__ = cache;
        const list = cache.buildMenuItemsForTreeId
          ? cache.buildMenuItemsForTreeId(treeId)
          : (cache.buildMenuItemsForContext?.(
              cache.normalizeContextFromTreeId?.(treeId) ?? 'projects'
            ) ?? []);
        if (active) setItems(list);
        await prefetchMuiIcons(list.map((i) => i.icon?.muiIconName).filter(Boolean));
        return;
      } catch (err) {
        console.warn('[usePluginMenuItems] Failed to load menu-builders:', err);
      }

      // 3) Last resort: empty list
      if (active) setItems([]);
    }

    load();
    return () => {
      active = false;
    };
  }, [treeId]);

  return items;
}
