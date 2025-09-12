import type { FC } from 'react';
import { type ReactNode } from 'react';
import { type SxProps, type Theme } from '@mui/material';
export type ButtonGroupItemType = {
    icon?: ReactNode;
    name: string;
};
export interface ToggleButtonGrouprops {
    buttonGroupSx: SxProps<Theme>;
    buttonSx: SxProps<Theme>;
    selectedValues: string[];
    handleSelectedValues: (newValues: string[]) => void;
    items: ButtonGroupItemType[];
    orientation?: 'horizontal' | 'vertical';
}
export declare const ToggleButtonItemGroup: FC<ToggleButtonGrouprops>;
//# sourceMappingURL=ToggleButtonItemGroup.d.ts.map