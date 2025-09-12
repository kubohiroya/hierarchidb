import React from 'react';
export interface CategorySelectorOption {
    value: string;
    label: string;
}
export interface CategorySelectorProps {
    value?: string;
    options?: CategorySelectorOption[];
    onChange?: (value: string) => void;
    placeholder?: string;
}
/**
 * Minimal CategorySelector implementation for plugin consumers.
 */
export declare const CategorySelector: React.FC<CategorySelectorProps>;
export default CategorySelector;
//# sourceMappingURL=CategorySelector.d.ts.map