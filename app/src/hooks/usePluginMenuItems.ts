/**
 * React hook to get SpeedDial/Menu items based on tree context
 */
import { useMemo } from 'react';
// Local replicas of menu types to avoid hard dependency on virtual modules
export type TreeContext = 'resources' | 'projects';

export interface PluginMenuItem {
  key: string;
  nodeType: string;
  label: string;
  icon?: { muiIconName?: string; emoji?: string; color?: string };
  group?: 'basic' | 'container' | 'document' | 'advanced' | string;
  priority: number;
}

export function usePluginMenuItems(context: TreeContext): PluginMenuItem[] {
  return useMemo(() => {
    // Try dynamic import to avoid hard-failing when virtual modules are unavailable
    // If it fails, return empty array so caller can fallback to worker-based list
    try {
      // Note: dynamic import is async; we use a sync wrapper by peeking into a cached module if present
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const mod: any = (globalThis as any).__HDB_MENU_BUILDERS__;
      if (mod?.buildMenuItemsForContext) {
        return mod.buildMenuItemsForContext(context) as PluginMenuItem[];
      }
    } catch {
    }
    // No cached builders; return empty and let caller fallback
    return [] as PluginMenuItem[];
  }, [context]);
}
