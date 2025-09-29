export interface TreeTableFooterProps {
    readonly totalItems: number;
    readonly selectedItems: number;
    readonly visibleItems: number;
    readonly isLoading?: boolean;
    readonly loadingProgress?: number;
    readonly loadingMessage?: string;
    readonly error?: string;
    readonly warning?: string;
    readonly info?: string;
    readonly success?: string;
    readonly onRetry?: () => void;
    readonly onClearMessages?: () => void;
    readonly showDetails?: boolean;
    readonly onToggleDetails?: () => void;
}
export declare const TreeTableFooter: (props: TreeTableFooterProps) => React.JSX.Element;
//# sourceMappingURL=TreeTableFooter.d.ts.map