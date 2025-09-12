import type { ChangeEvent } from 'react';
import { SxProps, Theme } from '@mui/material';
interface IndeterminateCheckboxProps {
    id: string;
    checked?: boolean;
    cascadingSelected?: boolean;
    indeterminate?: boolean;
    onChange: (ev: ChangeEvent<HTMLInputElement>) => void;
    size?: 'small' | 'medium';
    sx?: SxProps<Theme>;
}
export declare function IndeterminateCheckbox({ id, checked, indeterminate, cascadingSelected, onChange, size, sx, }: IndeterminateCheckboxProps): JSX.Element;
export default IndeterminateCheckbox;
//# sourceMappingURL=IndeterminateCheckbox.d.ts.map