import type React from 'react';
export type Tag = {
    id: string;
    name: string;
    color?: string;
};
export interface TagInputProps {
    value?: Tag[];
    onChange?: (tags: Tag[]) => void;
    placeholder?: string;
}
/**
 * Minimal TagInput implementation for plugin consumers.
 * Replace with a richer component when ready.
 */
export declare const TagInput: React.FC<TagInputProps>;
export default TagInput;
//# sourceMappingURL=TagInput.d.ts.map