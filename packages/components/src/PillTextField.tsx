import { TextField, type TextFieldProps } from '@mui/material';
import { forwardRef } from 'react';

/**
 * A TextField with pill-shaped (fully rounded) border radius on the outer fieldset.
 * Accepts all standard MUI TextFieldProps.
 */
export const PillTextField = forwardRef<HTMLDivElement, TextFieldProps>(function PillTextField(
  { sx, ...rest },
  ref
) {
  return (
    <TextField
      ref={ref}
      sx={[
        { '& .MuiOutlinedInput-root': { borderRadius: '9999px' } },
        ...(Array.isArray(sx) ? sx : sx ? [sx] : []),
      ]}
      {...rest}
    />
  );
});
