import { type SxProps, type Theme } from '@mui/material';
export interface TreeTableSearchInputProps {
    value: string;
    onChange: (value: string) => void;
    onClear: () => void;
    placeholder?: string;
    label?: string;
    autoFocus?: boolean;
    disabled?: boolean;
    sx?: SxProps<Theme>;
}
export declare const TreeTableSearchInput: import("react").NamedExoticComponent<TreeTableSearchInputProps>;
//# sourceMappingURL=SearchInput.d.ts.map