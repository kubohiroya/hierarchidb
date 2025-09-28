/**
 * Generic Selection Matrix Component
 * Reusable checkbox matrix for multi-dimensional selection
 */
import type React from 'react';
export interface SelectionMatrixColumn {
    id: string;
    label: string;
    description?: string;
    width?: number;
}
export interface SelectionMatrixRow<T = any> {
    id: string;
    label: string;
    subLabel?: string;
    data: T;
    disabled?: boolean;
    tooltip?: string;
}
export interface SelectionMatrixProps<T = any> {
    rows: SelectionMatrixRow<T>[];
    columns: SelectionMatrixColumn[];
    state: boolean[][];
    onChange: (rowIndex: number, colIndex: number, checked: boolean) => void;
    onSelectAll?: (colIndex: number, checked: boolean) => void;
    onSelectRow?: (rowIndex: number, checked: boolean) => void;
    showRowSelection?: boolean;
    showColumnSelection?: boolean;
    showSelectionCount?: boolean;
    maxHeight?: number;
    stickyHeader?: boolean;
    dense?: boolean;
}
export declare function SelectionMatrix<T = any>({ rows, columns, state, onChange, onSelectAll, onSelectRow, showRowSelection, showColumnSelection, showSelectionCount, maxHeight, stickyHeader, dense, }: SelectionMatrixProps<T>): React.ReactElement;
export default SelectionMatrix;
//# sourceMappingURL=SelectionMatrix.d.ts.map