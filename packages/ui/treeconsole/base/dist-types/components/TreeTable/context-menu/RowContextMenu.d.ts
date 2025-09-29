import React from 'react';
export interface RowContextMenuProps {
    readonly nodeType: string;
    readonly addMenuNodeTypes: string[];
    readonly parentElem: HTMLElement | null;
    readonly onClose: () => void;
    readonly onOpen: () => void;
    readonly onOpenFolder: () => void;
    readonly onPreview: () => void;
    readonly onEdit: () => void;
    readonly onCreate: (type: string) => void;
    readonly onDuplicate: () => void;
    readonly onRemove: () => void;
    readonly onCheckReference: () => void;
    readonly canOpen: boolean;
    readonly canEdit: boolean;
    readonly canCreate: boolean;
    readonly canRemove: boolean;
    readonly canDuplicate: boolean;
    readonly isTrashRoot?: boolean;
    readonly mode?: 'restore' | 'dispose';
    readonly onRestoreToOriginal?: () => void;
    readonly onRestoreToCurrent?: () => void;
    /** Optional treeId for context-aware Create submenu (e.g., 'r'|'t'|'p') */
    readonly treeId?: string;
}
export declare const RowContextMenu: React.NamedExoticComponent<RowContextMenuProps>;
//# sourceMappingURL=RowContextMenu.d.ts.map