/**
  * NodeContextMenu -
  * TreeTable
  * eria-cartographRowContextMenuMUI
  */
import { type ReactElement } from 'react';
export interface NodeContextMenuProps {
    anchorEl: HTMLElement | null;
    open: boolean;
    onClose: () => void;
    nodeId: string;
    nodeType?: string;
    nodeName?: string;
    canOpen?: boolean;
    canEdit?: boolean;
    canCreate?: boolean;
    canRemove?: boolean;
    canDuplicate?: boolean;
    onOpen?: () => void;
    onOpenFolder?: () => void;
    onPreview?: () => void;
    onEdit?: () => void;
    onCreate?: (type: string) => void;
    onDuplicate?: () => void;
    onRemove?: () => void;
    onCheckReference?: () => void;
    addMenuNodeTypes?: string[];
    isTrashRoot?: boolean;
    mode?: 'restore' | 'dispose';
    onRestoreToOriginal?: () => void;
    onRestoreToCurrent?: () => void;
}
/**
  * NodeContextMenu
 * eria-cartographRowContextMenuMUI
  */
export declare function NodeContextMenu(props: NodeContextMenuProps): ReactElement | null;
//# sourceMappingURL=NodeContextMenu.d.ts.map