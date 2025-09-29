export interface TreeTableToolbarProps {
    readonly title?: string;
    readonly searchTerm: string;
    readonly onSearchChange: (term: string) => void;
    readonly onSearchClear: () => void;
    readonly selectedCount: number;
    readonly totalCount: number;
    readonly canCreate: boolean;
    readonly canEdit: boolean;
    readonly canDelete: boolean;
    readonly onCreate: () => void;
    readonly onEdit: () => void;
    readonly onDelete: () => void;
    readonly onRefresh: () => void;
    readonly onExpandAll: () => void;
    readonly onCollapseAll: () => void;
    readonly isLoading?: boolean;
    readonly viewMode: 'list' | 'grid';
    readonly onViewModeChange: (mode: 'list' | 'grid') => void;
    readonly sortBy?: string;
    readonly sortDirection?: 'asc' | 'desc';
    readonly onSortChange: (field: string, direction: 'asc' | 'desc') => void;
    readonly filterBy?: string;
    readonly onFilterChange: (filter: string) => void;
    readonly availableFilters: readonly string[];
}
export declare const TreeTableToolbar: (props: TreeTableToolbarProps) => React.JSX.Element;
//# sourceMappingURL=TreeTableToolbar.d.ts.map