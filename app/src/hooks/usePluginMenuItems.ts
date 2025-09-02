/**
 * React hook to get SpeedDial/Menu items based on tree context
 */
import { useMemo } from 'react';
import {
  buildMenuItemsForContext,
  type TreeContext,
  type PluginMenuItem,
} from '~/plugins/menu-builders';

export function usePluginMenuItems(context: TreeContext): PluginMenuItem[] {
  return useMemo(() => buildMenuItemsForContext(context), [context]);
}

