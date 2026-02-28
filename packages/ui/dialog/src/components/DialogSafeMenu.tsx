import Menu, { type MenuProps } from '@mui/material/Menu';
import type { JSX } from 'react';

export const DialogSafeMenu = (props: MenuProps): JSX.Element => {
  const { disableRestoreFocus = true, ...rest } = props;
  return <Menu {...rest} disableRestoreFocus={disableRestoreFocus} />;
};

