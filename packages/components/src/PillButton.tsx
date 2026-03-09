import { Button, type ButtonProps } from '@mui/material';
import { forwardRef } from 'react';

/**
 * A Button with pill-shaped (fully rounded) border radius.
 * Accepts all standard MUI ButtonProps.
 */
export const PillButton = forwardRef<HTMLButtonElement, ButtonProps>(
  function PillButton({ sx, ...rest }, ref) {
    return (
      <Button
        ref={ref}
        sx={[{ borderRadius: '9999px' }, ...(Array.isArray(sx) ? sx : sx ? [sx] : [])]}
        {...rest}
      />
    );
  },
);
