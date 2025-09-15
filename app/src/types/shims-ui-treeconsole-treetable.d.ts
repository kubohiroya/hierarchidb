declare module '@hierarchidb/ui-treeconsole-treetable' {
  export type TreeNodeInUI = {
    id: string;
    name: string;
    type?: string;
    nodeType?: string;
    hasChildren?: boolean;
    depth?: number;
  };
  export type TreeTableController = {
    data: readonly TreeNodeInUI[];
    rowSelection?: Record<string, boolean>;
    expandedRowIds?: Set<string>;
    startEdit?: (nodeId: string) => Promise<void> | void;
    finishEdit?: (nodeId: string, newValue: string, field?: 'name' | 'description') => void;
    cancelEdit?: () => void;
    onNodeClick?: (nodeId: string, node?: TreeNodeInUI) => void;
    onNodeSelect?: (nodeIds: string[], selected: boolean) => void;
    onNodeExpand?: (nodeId: string, expanded: boolean) => void;
    onMoveNodes?: (nodeIds: string[], targetParentId: string) => void;
  };
  export interface TreeTableCoreProps {
    controller: TreeTableController;
    viewHeight: number;
    viewWidth: number;
    useTrashColumns?: boolean;
    depthOffset?: number;
    disableDragAndDrop?: boolean;
    hideDragHandler?: boolean;
    rowClickAction?: 'Edit' | 'Select/Navigate';
    selectionMode?: 'single' | 'multiple';
  }
  export const TreeTableCore: React.FC<TreeTableCoreProps>;
}

