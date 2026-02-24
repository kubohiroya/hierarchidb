import type { TreeId } from '@hierarchidb/core-types';
import type { IconDescriptorInput } from '@hierarchidb/ui-icon';
import { useIconRegistry } from '@hierarchidb/ui-icon';
import { useDynamicSpeedDial as useBaseDynamicSpeedDial } from '@hierarchidb/ui-dynamic-speed-dial';
import { usePluginMenuItems } from '~/hooks/usePluginMenuItems';
import type { TreeContext } from '~/plugin-loaders/menu-builders';

export interface UseDynamicSpeedDialResult
  extends ReturnType<typeof useBaseDynamicSpeedDial> {}

export function useDynamicSpeedDial(params: {
  treeId?: TreeId;
  hidden?: boolean;
  onCreateAction: (
    action: string,
    node: unknown,
    options?: { openInNewTab?: boolean }
  ) => void;
  onSuppress?: () => void;
  menuContext?: TreeContext;
}): UseDynamicSpeedDialResult {
  const { treeId, hidden, onCreateAction, onSuppress, menuContext } = params;
  void menuContext;
  const menuItems = usePluginMenuItems(treeId);
  const { resolveIcon } = useIconRegistry();

  return useBaseDynamicSpeedDial({
    hidden,
    menuItems,
    onCreateAction,
    onSuppress,
    resolveIcon: ({ nodeType, icon }) => {
      return resolveIcon({
        nodeType,
        icon: icon as IconDescriptorInput['icon'],
      });
    },
  });
}
