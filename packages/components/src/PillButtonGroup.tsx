import { ButtonGroup, type ButtonGroupProps } from '@mui/material';
import { forwardRef } from 'react';

/**
 * A ButtonGroup with pill-shaped (fully rounded) border radius.
 * Overrides MUI's hard-coded borderRadius:0 on firstButton/lastButton slots
 * so the group's borderRadius propagates to child buttons via inherit.
 */
export const PillButtonGroup = forwardRef<HTMLDivElement, ButtonGroupProps>(
  function PillButtonGroup({ sx, ...rest }, ref) {
    return (
      <ButtonGroup
        ref={ref}
        sx={[
          {
            borderRadius: '9999px',
            [`& .MuiButtonGroup-firstButton`]: {
              borderTopLeftRadius: 'inherit',
              borderBottomLeftRadius: 'inherit',
            },
            [`& .MuiButtonGroup-lastButton`]: {
              borderTopRightRadius: 'inherit',
              borderBottomRightRadius: 'inherit',
            },
          },
          ...(Array.isArray(sx) ? sx : sx ? [sx] : []),
        ]}
        {...rest}
      />
    );
  },
);
