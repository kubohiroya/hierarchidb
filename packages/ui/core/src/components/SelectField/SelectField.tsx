/**
 * @file SelectField.tsx
 * @description A reusable form select field component that wraps Material-UI's Select
 * with consistent styling and behavior. Provides label, helper text, and item mapping
 * functionality for dropdown selections.
 *
 * @module components/ui/SelectField
 *
 * @usage
 * - UI mode selectors (UIModeSelector)
 * - Map style selectors (StyleURLSelector)
 * - Projection mode selectors (ProjectionModeSelector)
 * - Form dropdown fields throughout the application
 *
 * @dependencies
 * - @mui/material: FormControl, Select, MenuItem, InputLabel, FormHelperText containers
 * - React: SelectChangeEvent type for event handling
 */

import {
  FormControl,
  FormHelperText,
  FormLabelProps,
  InputLabel,
  MenuItem,
  Select,
  type SelectChangeEvent,
} from '@mui/material';

export const SelectField = ({
  id,
  label,
  value,
  handleChange,
  helperText,
  items,
  formLabelProps,
  disabled,
  ...props
}: {
  id: string;
  value: string;
  handleChange: (value: string) => void;
  label: string;
  helperText?: string;
  items: { name: string; value?: string }[];
  formLabelProps: Omit<FormLabelProps, 'labelBackground'>;
  disabled?: boolean;
}) => {
  const handleSelectedValue = (event: SelectChangeEvent) => {
    handleChange(event.target.value);
  };
  // id={labelId}
  return (
    <FormControl {...props}>
      <InputLabel {...formLabelProps} htmlFor={id} aria-label={id}>
        {label}
      </InputLabel>
      <Select
        inputProps={{
          name: id,
          id: id,
        }}
        size="small"
        onChange={handleSelectedValue}
        value={value}
        disabled={disabled}
      >
        {items.map((item, index) => (
          <MenuItem key={index} value={item.value ?? item.name} aria-label={item.name}>
            {item.name}
          </MenuItem>
        ))}
      </Select>
      {!!helperText && <FormHelperText>{helperText}</FormHelperText>}
    </FormControl>
  );
};
