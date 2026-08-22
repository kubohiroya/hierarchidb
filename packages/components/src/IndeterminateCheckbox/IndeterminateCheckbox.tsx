import { Checkbox, type SxProps, type Theme } from '@mui/material';
import type { ChangeEvent, ReactElement } from 'react';

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
}: IndeterminateCheckboxProps): ReactElement {
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
