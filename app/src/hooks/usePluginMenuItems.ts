/**
 * React hook to get SpeedDial/Menu items based on tree context
 */
import { TreeId } from '@hierarchidb/common-type';
import { useEffect, useState } from 'react';
import { prefetchMuiIcons } from '@hierarchidb/ui-icon';
// Local replicas of menu types to avoid hard dependency on virtual modules

export interface PluginMenuItem {
  key: string;
  nodeType: string;
  label: string;
  icon?: { muiIconName?: string; emoji?: string; color?: string };
  group?: 'basic' | 'container' | 'document' | 'advanced' | string;
  priority: number;
}

export function usePluginMenuItems(treeId?: TreeId): PluginMenuItem[] {
  const [items, setItems] = useState<PluginMenuItem[]>([]);

  useEffect(() => {
    let active = true;

    async function load() {
      // 1) Try cached builders injected by root.tsx
      try {
        const cached: any = (globalThis as any).__HDB_MENU_BUILDERS__;
        if (cached) {
          const builder = cached.buildMenuItemsForTreeId || cached.buildMenuItemsForContext;
          if (typeof builder === 'function') {
            // If using context-builder, normalize from treeId when helper is available
            const arg = cached.buildMenuItemsForTreeId
              ? treeId
              : (cached.normalizeContextFromTreeId?.(treeId) ?? treeId);
            const list = builder(arg) as PluginMenuItem[];
            if (active) setItems(list);
            // Warm icon chunks for smoother first open
            try {
              await prefetchMuiIcons(list.map((i) => i.icon?.muiIconName));
            } catch {}
            return;
          }
        }
      } catch {
        // Fall through to dynamic import
      }

      // 2) Fallback: dynamic import (works in dev as well)
      try {
        const mod = await import('~/plugins/menu-builders');
        (globalThis as any).__HDB_MENU_BUILDERS__ = mod; // cache for next time
        // Prefer a treeId-aware builder if available
        const builder = (mod as any).buildMenuItemsForTreeId || (mod as any).buildMenuItemsForContext;
        const list = builder(treeId) as PluginMenuItem[];
        if (active) setItems(list);
        try {
          await prefetchMuiIcons(list.map((i: PluginMenuItem) => i.icon?.muiIconName));
        } catch {}
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
