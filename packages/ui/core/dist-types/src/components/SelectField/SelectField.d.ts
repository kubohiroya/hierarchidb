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
import React from 'react';
import { FormLabelProps } from '@mui/material';
export declare const SelectField: ({ id, label, value, handleChange, helperText, items, formLabelProps, disabled, ...props }: {
    id: string;
    value: string;
    handleChange: (value: string) => void;
    label: string;
    helperText?: string | undefined;
    items: {
        name: string;
        value?: string | undefined;
    }[];
    formLabelProps: Omit<FormLabelProps, 'labelBackground'>;
    disabled?: boolean | undefined;
}) => React.ReactElement;
//# sourceMappingURL=SelectField.d.ts.map