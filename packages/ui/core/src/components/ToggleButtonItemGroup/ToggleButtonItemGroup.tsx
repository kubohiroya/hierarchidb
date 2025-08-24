import type { FC, MouseEvent } from 'react';
import { type SxProps, type Theme, ToggleButton, ToggleButtonGroup } from '@mui/material';
import { type ReactNode } from 'react';
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

export const ToggleButtonItemGroup: FC<ToggleButtonGrouprops> = ({
  buttonGroupSx,
  buttonSx,
  selectedValues,
  handleSelectedValues,
  items,
  orientation,
}) => {
  const onChange = (_: MouseEvent<HTMLElement>, newValues: string[]) => {
    handleSelectedValues(newValues);
  };

  return (
    <ToggleButtonGroup
      {...(orientation ? { orientation } : {})}
      onChange={onChange}
      size="small"
      value={selectedValues}
      sx={{
        ...buttonGroupSx,
        '&.Mui-selected': {},
      }}
    >
      {items.map((item, index) => (
        <ToggleButton sx={{ ...buttonSx }} aria-label={item.name} key={index} value={item.name}>
          {item.icon || item.name}
        </ToggleButton>
      ))}
    </ToggleButtonGroup>
  );
};
