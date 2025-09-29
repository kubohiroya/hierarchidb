import type { ComponentProps, ReactElement } from 'react';
import type { TreeTableColumn } from './TreeTable/index.js';
import { TreeConsoleBreadcrumb } from '@hierarchidb/ui-treeconsole-breadcrumb';
import type { TreeNodeData } from '../types/index.js';
type PanelBreadcrumbNode = {
    treeNodeId?: string;
    id?: string;
    nodeType?: string;
    type?: string;
    name?: string;
    parentId?: string | null;
};
type DefaultBreadcrumbProps = ComponentProps<typeof TreeConsoleBreadcrumb>;
export interface TreeConsolePanelBreadcrumbRendererProps {
    readonly items: readonly PanelBreadcrumbNode[];
    readonly defaultRendererProps: DefaultBreadcrumbProps;
    readonly defaultRenderer: () => ReactElement;
}
export interface TreeConsolePanelProps {
    readonly title?: string;
    /** Optional treeId for context-aware menus (e.g., 'r'|'t'|'p') */
    readonly treeId?: string;
    /**
     * Page context root (formerly called rootNodeId in this component).
     * Keep naming aligned with app layer that uses `pageNodeId`.
     */
    readonly pageNodeId?: string;
    readonly data: readonly TreeNodeData[];
    readonly columns: readonly TreeTableColumn[];
    readonly breadcrumbItems: readonly PanelBreadcrumbNode[];
    readonly loading?: boolean;
    readonly error?: string;
    readonly selectedIds: readonly string[];
    readonly expandedIds: readonly string[];
    readonly searchTerm: string;
    readonly sortBy?: string;
    readonly sortDirection?: 'asc' | 'desc';
    readonly filterBy?: string;
    readonly availableFilters: readonly string[];
    readonly viewMode: 'list' | 'grid';
    readonly canCreate: boolean;
    readonly canEdit: boolean;
    readonly canDelete: boolean;
    readonly showNavigationButtons?: boolean;
    readonly maxHeight?: number | string;
    readonly dense?: boolean;
    readonly onNodeClick?: (node: TreeNodeData) => void;
    readonly onNodeSelect?: (nodeIds: string[], selected: boolean) => void;
    readonly onNodeExpand?: (nodeId: string, expanded: boolean) => void;
    readonly onSearchChange: (term: string) => void;
    readonly onSearchClear: () => void;
    readonly onCreate: () => void;
    readonly onEdit: () => void;
    readonly onDelete: () => void;
    readonly onRefresh: () => void;
    readonly onExpandAll: () => void;
    readonly onCollapseAll: () => void;
    readonly onSort: (columnId: string) => void;
    readonly onFilterChange: (filter: string) => void;
    readonly onViewModeChange: (mode: 'list' | 'grid') => void;
    readonly onBreadcrumbNavigate: (nodeId: string, node?: PanelBreadcrumbNode) => void;
    readonly onNavigateBack?: () => void;
    readonly onNavigateForward?: () => void;
    readonly canGoBack?: boolean;
    readonly canGoForward?: boolean;
    readonly onContextMenuAction: (action: string, node: TreeNodeData) => void;
    readonly onStartTour?: () => void;
    readonly onMoveNodes?: (nodeIds: string[], targetParentId: string) => void;
    /** Optional: For column-width persistence, provide treeId to scope keys */
    readonly treeIdForPersistence?: string;
    /** Row click action behavior */
    readonly rowClickAction?: 'Edit' | 'Select/Navigate';
    /** Enable trash-specific columns and behaviours */
    readonly useTrashColumns?: boolean;
    readonly trashAction?: 'restore' | 'empty';
    /**
     * Whether to render the built-in static SpeedDial.
     * Set to false when an external DynamicSpeedDial is provided by the host app.
     */
    readonly renderBuiltInSpeedDial?: boolean;
    /** Hide the drag handle column when true (e.g., Trash dialog). */
    readonly hideDragHandler?: boolean;
    /** Optional custom breadcrumb renderer for host-specific presentation. */
    readonly breadcrumbRenderer?: (props: TreeConsolePanelBreadcrumbRendererProps) => ReactElement;
}
export declare const TreeConsolePanel: import("react").NamedExoticComponent<TreeConsolePanelProps>;
export {};
//# sourceMappingURL=TreeConsolePanel.d.ts.map