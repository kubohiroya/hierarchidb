import Popover, { type PopoverProps } from '@mui/material/Popover';
import type { JSX } from 'react';

export const DialogSafePopover = (props: PopoverProps): JSX.Element => {
  const { disableRestoreFocus = true, ...rest } = props;
  return <Popover {...rest} disableRestoreFocus={disableRestoreFocus} />;
};

