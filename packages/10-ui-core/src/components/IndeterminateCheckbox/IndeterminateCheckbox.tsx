import type { ChangeEvent } from 'react';
import { Checkbox, SxProps, Theme } from '@mui/material';

interface IndeterminateCheckboxProps {
  id: string;
  checked?: boolean;
  cascadingSelected?: boolean;
  indeterminate?: boolean;
  onChange: (ev: ChangeEvent<HTMLInputElement>) => void;
  size?: 'small' | 'medium';
  sx?: SxProps<Theme>;
}

export function IndeterminateCheckbox({
  id,
  checked,
  indeterminate,
  cascadingSelected,
  onChange,
  size,
  sx,
}: IndeterminateCheckboxProps) {
  return (
    <Checkbox
      id={id}
      checked={checked}
      color={cascadingSelected ? 'default' : 'primary'}
      indeterminate={indeterminate}
      onChange={onChange}
      size={size}
      sx={sx}
    />
  );
}

export default IndeterminateCheckbox;
