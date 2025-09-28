import type React from 'react';
import { type ReactNode } from 'react';
export interface TagChipsInputProps {
    value?: string[];
    onChange?: (tags: string[]) => void;
    placeholder?: string;
    label?: ReactNode;
    maxTags?: number;
    disabled?: boolean;
    helperText?: string;
    error?: boolean;
    required?: boolean;
    suggestions?: string[];
}
export declare const TagChipsInput: React.FC<TagChipsInputProps>;
export default TagChipsInput;
//# sourceMappingURL=TagChipsInput.d.ts.map