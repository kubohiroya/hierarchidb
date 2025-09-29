import type React from 'react';
import type { TreeNodeData } from '../../../types/index.js';
export interface TreeTableColumn {
    readonly id: string;
    readonly label: string;
    readonly width?: number | string;
    readonly sortable?: boolean;
    readonly align?: 'left' | 'center' | 'right';
    readonly render?: (value: unknown, node: TreeNodeData) => React.ReactNode;
}
export interface TreeTableViewProps {
    readonly data: readonly TreeNodeData[];
    readonly columns: readonly TreeTableColumn[];
    readonly loading?: boolean;
    readonly error?: string;
    readonly selectedIds: readonly string[];
    readonly expandedIds: readonly string[];
    readonly sortBy?: string;
    readonly sortDirection?: 'asc' | 'desc';
    readonly onNodeClick?: (node: TreeNodeData) => void;
    readonly onNodeSelect?: (nodeIds: string[], selected: boolean) => void;
    readonly onNodeExpand?: (nodeId: string, expanded: boolean) => void;
    readonly onSort?: (columnId: string) => void;
    readonly multiSelect?: boolean;
    readonly showCheckboxes?: boolean;
    readonly showIcons?: boolean;
    readonly dense?: boolean;
    readonly maxHeight?: number | string;
    readonly stickyHeader?: boolean;
}
export declare const TreeTableView: React.NamedExoticComponent<TreeTableViewProps>;
//# sourceMappingURL=TreeTableView.d.ts.map